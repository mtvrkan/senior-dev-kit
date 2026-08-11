# Project Preset — Terraform / OpenTofu

> Tier 3 (`devops-guard`) on every change, Tier 4 when the plan contains a destroy. The plan
> output is the review artifact — no apply is proposed without it.

## State is the thing that can actually ruin your day

- Remote backend with locking from day one: S3 + DynamoDB, GCS, or Terraform/HCP Cloud. Local
  state on one laptop means two people applying at once silently corrupt it.
- **State contains secrets in plaintext** — every database password and generated key the
  providers returned. Encrypt the bucket, restrict read access, and never commit `*.tfstate` or
  `*.tfstate.backup`.
- `terraform import` to adopt existing infrastructure; never hand-edit state. If you think you
  need `state rm`, say so out loud first — it orphans real resources.

## Layout

```text
environments/{dev,staging,prod}/   # thin: backend config, provider, module calls, tfvars
modules/<name>/                    # main.tf · variables.tf · outputs.tf · versions.tf
```

- Separate state per environment. One state file holding dev and prod means a dev mistake can
  plan a prod destroy.
- Pin everything: `required_version`, provider version constraints, and module `ref` pinned to a
  tag or commit — not a branch. Commit the lock file.

```hcl
terraform {
  required_version = "~> 1.13"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
}
```

## Variables and outputs

- Every variable gets a `type` and a `description`; add `validation` blocks for anything with a
  real constraint. Defaults only where a default is genuinely safe — never for an environment
  name or an account id.
- `sensitive = true` on secret variables and outputs so they don't print in logs. This hides them
  from CLI output only; they are still plaintext in state.
- Secrets come from a secret manager or a CI secret, never a committed `.tfvars`.

## Writing resources

- `for_each` over `count` for anything keyed: `count` is index-addressed, so removing the middle
  element re-creates every resource after it.
- `moved` blocks to rename or restructure without a destroy/create.
- `lifecycle { prevent_destroy = true }` on databases, buckets with data, and anything else whose
  replacement is an incident.
- Avoid `depends_on` unless there is a genuine hidden dependency; implicit references order things
  correctly and stay accurate as the code changes.
- Never `local-exec` with a shell string built from a variable — that is shell injection into
  your own pipeline.

## The plan is the review

```bash
terraform init -backend-config=env/prod.backend
terraform validate
terraform fmt -check -recursive
terraform plan -out=tf.plan          # ALWAYS to a file
terraform show -json tf.plan | jq '.resource_changes[] | select(.change.actions[] | . == "delete")'
terraform apply tf.plan              # apply the reviewed plan, not a fresh one
```

Applying without `-out` re-plans at apply time — you approve one thing and apply another. Any
plan containing `destroy` or `replace` on a stateful resource stops and gets explicit approval.

## CI

- OIDC federation for cloud credentials — no long-lived access keys in the runner.
- `plan` on pull requests with the output posted; `apply` only from the default branch, gated.
- `tflint`, `trivy config` and `checkov` in the pipeline; drift detection on a schedule. Scanner
  selection and the pipeline hardening around it (SHA-pinned Actions, OIDC, pinned scanner
  versions, which scanners are retired) are `rules/600-devops.md`'s IaC section, which co-loads
  for every `*.tf` and `*.tfvars` — don't re-decide them here.

## Anti-patterns

- Local state, or state without locking.
- `*.tfstate` or a populated `.tfvars` committed.
- Unpinned provider or module versions; a module sourced from a branch.
- `count` where `for_each` belongs.
- `terraform apply` with no saved plan; `-auto-approve` outside a gated pipeline.
- `prevent_destroy` missing on stateful resources.
- Hand-edited state, or `state rm` used to make an error go away.
- One state file spanning environments.
