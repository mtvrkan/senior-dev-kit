# DevOps Security Guide

Reference for `devops-guard` — Dockerfile hardening, GitHub Actions security, IaC checklists, rollback strategies, SBOM.

---

## Dockerfile security

Multi-stage build template:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER app
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Required checks:

- Specific version tag (never `:latest` — mutable, breaks reproducibility)
- Multi-stage (discard build tools from final image)
- Non-root user (never `USER root` in final stage)
- HEALTHCHECK present (required for orchestrators to know if container is healthy)
- No secrets in any layer (build args, ENV, RUN commands)
- `.dockerignore` excludes: `.git`, `node_modules`, `.next`, `dist`, `*.env`, `*.log`

Platform base images:

- Node / Bun: `node:22-alpine` or `oven/bun:1-alpine`
- Python: `python:3.12-slim`
- Go: `gcr.io/distroless/static-debian12` (zero shell, minimal attack surface)
- Java: `eclipse-temurin:21-jre-alpine`
- .NET: `mcr.microsoft.com/dotnet/runtime:8.0-alpine`

---

## GitHub Actions security

SHA pinning (mandatory since August 2025):

```yaml
# WRONG — tag is mutable, can be hijacked
- uses: actions/checkout@v4

# RIGHT — immutable SHA
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

OIDC for cloud auth:

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@[SHA]
    with:
      role-to-assume: arn:aws:iam::ACCOUNT:role/GitHubActionsRole
      aws-region: us-east-1
```

Secret handling rules:

- NEVER `echo ${{ secrets.KEY }}` — leaks in logs
- NEVER `${{ github.event.pull_request.head.sha }}` with `pull_request_target` trigger
- ALWAYS use secrets only in `env:` or `with:` blocks
- Production deploy: require manual approval via GitHub Environments

---

## IaC security

Scanning tools:

- Checkov: `checkov -d . --soft-fail false` — preferred (Terraform + K8s + ARM)
- Trivy config scan: `trivy config .` — K8s manifests
- tfsec is deprecated (merged into Trivy). Terrascan is archived.

Terraform checklist:

- Remote backend (S3/GCS/Terraform Cloud) — never local state
- State NOT committed to git (add `*.tfstate` to `.gitignore`)
- `terraform plan` reviewed before `terraform apply`
- Sensitive outputs: `sensitive = true`
- IAM: no `"*"` wildcards in actions or resources
- No hardcoded credentials in `.tf` files

Kubernetes checklist:

- `runAsNonRoot: true` in Pod SecurityContext
- Resource limits (`limits.memory` + `limits.cpu`) on every container
- No `privileged: true`
- Network policies: deny-all default + explicit allow
- Secrets from K8s Secrets or external secret manager (not ConfigMap)

---

## Rollback strategies by type

| Change type | Rollback method | Time |
| --- | --- | --- |
| Container deploy | Roll back to previous image tag | <2 min |
| K8s deployment | `kubectl rollout undo deployment/[name]` | <1 min |
| Terraform | `terraform apply -target=[resource] -var restore=true` | varies |
| DB migration | Reverse migration script (expand/contract pattern) | plan before deploy |
| GitHub Actions | Revert workflow file commit | immediate |

Database migrations must be reversible. If not reversible (destructive), take backup before deploy and document the manual recovery procedure.

---

## SBOM and container scanning

On every release:

```bash
# Generate SBOM
syft dir:. -o cyclonedx-json > sbom.cdx.json   # vulnerability tracking
syft dir:. -o spdx-json > sbom.spdx.json        # license compliance

# Scan SBOM for vulnerabilities
grype sbom:sbom.cdx.json

# Scan container image
trivy image --severity CRITICAL,HIGH --exit-code 1 myimage:tag
```

Upload SBOM as release artifact. Attach to GitHub Release.
