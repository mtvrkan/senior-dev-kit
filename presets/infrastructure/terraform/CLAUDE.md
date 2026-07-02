# Project Preset — Terraform (IaC)

## Module structure

```text
infra/
├── environments/
│   ├── staging/
│   │   ├── main.tf          ← instantiates modules
│   │   ├── variables.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf       ← remote state config
│   └── production/
│       ├── main.tf
│       ├── variables.tf
│       ├── terraform.tfvars
│       └── backend.tf
└── modules/
    ├── vpc/
    ├── rds/
    ├── ecs-service/
    └── s3-bucket/
```

## Remote state — mandatory

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "myapp-terraform-state"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "myapp-terraform-locks"   # state locking
  }
}
```

Never: local state file committed to git (leaks infrastructure details + no locking).

## Resource naming convention

```hcl
# {project}-{environment}-{resource}
resource "aws_s3_bucket" "myapp_prod_uploads" { ... }
resource "aws_rds_cluster" "myapp_prod_db" { ... }
resource "aws_ecs_service" "myapp_prod_api" { ... }
```

Always use `locals` for repeated name patterns:

```hcl
locals {
  prefix = "${var.project}-${var.environment}"
}
resource "aws_s3_bucket" "uploads" {
  bucket = "${local.prefix}-uploads"
}
```

## Variables — typed with validation

```hcl
variable "environment" {
  type        = string
  description = "Deployment environment"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be staging or production."
  }
}

variable "db_instance_class" {
  type    = string
  default = "db.t3.medium"
}
```

Never hardcode environment-specific values in modules — always accept as variables.

## Sensitive outputs

```hcl
output "db_password" {
  value     = random_password.db.result
  sensitive = true    # REQUIRED for secrets — redacted in plan output
}
```

Never: non-sensitive output for secrets (leaks to state file readers and CI logs).

## IAM — least privilege

```hcl
# WRONG: wildcard actions
resource "aws_iam_policy" "app" {
  policy = jsonencode({
    Statement = [{ Effect = "Allow", Action = "*", Resource = "*" }]
  })
}

# RIGHT: exact actions on specific resources
resource "aws_iam_policy" "app" {
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject", "s3:PutObject"]
      Resource = "${aws_s3_bucket.uploads.arn}/*"
    }]
  })
}
```

## Zero-downtime change checklist

Before any `terraform apply` that modifies existing resources:

- [ ] `terraform plan` reviewed — check for `forces replacement` (destroys resource)
- [ ] Database changes: add fields before removing, never rename in place
- [ ] Auto Scaling Group update: use `instance_refresh` not immediate replacement
- [ ] Load balancer: add new target group first, shift traffic, remove old
- [ ] Secrets rotation: deploy new secret version before removing old

Dangerous plan signals:

```text
# These will cause downtime — investigate before applying:
aws_rds_cluster.db must be replaced
aws_ecs_service.api  will be destroyed
```

## Provider version pinning

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"   # allow 5.x patches, not 6.x
    }
  }
}
```

## Pre-apply workflow

```bash
terraform fmt -recursive     # format
terraform validate           # syntax + type check
terraform plan -out=plan.tfplan   # save plan
# Review plan output — especially 'will be destroyed' lines
terraform apply plan.tfplan  # apply ONLY the reviewed plan
```

CI/CD: always use `terraform plan` with `-detailed-exitcode` (exit 2 = changes) to detect drift.

## Security checklist

- [ ] No secrets in `.tf` files or `terraform.tfvars` (use Vault/SSM/Secrets Manager)
- [ ] State file encrypted at rest (S3 + KMS)
- [ ] State file access restricted (only CI role + senior engineers)
- [ ] No wildcard `*` in IAM actions or resources
- [ ] `sensitive = true` on all secret outputs
- [ ] `.gitignore` includes: `*.tfstate`, `*.tfstate.backup`, `*.tfvars` (if secrets), `.terraform/`

## Anti-patterns

- Local state (no locking, gets committed accidentally)
- Hardcoded account IDs, ARNs, or region strings (use `data` sources + variables)
- `terraform destroy` without explicit backup + approval
- Monolithic root module (everything in one directory)
- No module versioning (`source = "git::https://..."` without `?ref=v1.2.3`)
- `ignore_changes` to silence drift without documenting why
