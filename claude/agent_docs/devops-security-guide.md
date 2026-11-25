# DevOps Security Guide

Canonical home for Dockerfile hardening, GitHub Actions SHA-pinning/OIDC, IaC checklists,
SBOM/container-scan commands is `rules/600-devops.md` — it auto-loads the moment any
Dockerfile/CI/IaC file is read, so devops-guard always has it in context during a review.
This guide holds only what 600 doesn't: the rollback-strategy table by change type.

---

## Rollback strategies by type

| Change type | Rollback method | Time |
| --- | --- | --- |
| Container deploy | Roll back to previous image tag | <2 min |
| K8s deployment | `kubectl rollout undo deployment/[name]` | <1 min |
| Terraform | Revert the config commit, then `terraform plan` → review → `terraform apply`. There is no rollback command: state moves forward only, so the previous config re-applied *is* the rollback. | varies |
| DB migration | Reverse migration script (expand/contract pattern) | plan before deploy |
| GitHub Actions | Revert workflow file commit | immediate |

Database migrations must be reversible. If not reversible (destructive), take backup before
deploy and document the manual recovery procedure.
