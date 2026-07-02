## Terraform

- Remote state always: S3 + DynamoDB locking (never local)
- Pin provider versions: `~> 5.0` (not `>= 5.0`)
- Resource names: `{project}-{env}-{resource}`
- `sensitive = true` on all secret outputs
- No secrets in `.tf` or `terraform.tfvars` — use Vault/SSM
- IAM: no wildcard `*` actions or resources
- Review plan for `forces replacement` before apply
- `.gitignore`: `*.tfstate`, `*.tfstate.backup`, `.terraform/`
- `terraform fmt` + `terraform validate` before every PR
