---
description: "DevOps rules — Docker security, GitHub Actions SHA pinning, OIDC, SBOM, IaC safety. Auto-loads for Dockerfile/CI/IaC files."
paths:
  - "**/Dockerfile*"
  - "**/.github/**"
  - "**/*.tf"
  - "**/docker-compose*"
  - "**/kubernetes/**"
  - "**/*.k8s.*"
  - "**/helm/**"
  - "**/.gitlab-ci.yml"
  - "**/railway.toml"
  - "**/fly.toml"
---

## HARD RULE — all CI/CD/IaC changes escalate

ANY change to Dockerfile, GitHub Actions, GitLab CI, Terraform, K8s manifests, Helm charts →
`ESCALATE TO: devops-guard — infrastructure/CI change detected`

devops-guard runs the checklist below and approves before implementation.

## DOCKERFILE SECURITY CHECKLIST

```dockerfile
# PATTERN: multi-stage, non-root, pinned, health-checked
FROM node:24-alpine AS builder          # ✓ Specific version tag
WORKDIR /app
COPY package*.json ./
RUN npm ci                              # ✓ ALL deps — build tools (tsc/vite/webpack) live in devDependencies
COPY . .
RUN npm run build

FROM node:24-alpine AS runner           # ✓ Multi-stage: discard build tools + devDependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force  # ✓ production deps only in the final image (--omit=dev, not the deprecated --only=production)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup  # ✓ Non-root user
COPY --from=builder /app/dist ./dist
USER appuser                            # ✓ Run as non-root
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \     # ✓ Health check
  CMD wget -qO- http://localhost:3000/health || exit 1
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Checklist:

- [ ] Specific version tag (not `:latest`) — or image digest
- [ ] Multi-stage build (builder + minimal final)
- [ ] Non-root user (`adduser` or `USER` directive)
- [ ] `HEALTHCHECK` instruction present
- [ ] Secrets NOT in any layer (build args, ENV, COPY) — use runtime secrets
- [ ] `.dockerignore` excludes: `node_modules` `.next` `dist` `.git` `*.env` `*.log`
- [ ] No unnecessary packages in final image (distroless or alpine preferred)
- [ ] `apt-get clean && rm -rf /var/lib/apt/lists/*` after apt-get install

Platform-specific base images:

- Node/Bun: `node:24-alpine` or `oven/bun:1-alpine`
- Python: `python:3.12-slim`
- Go: `gcr.io/distroless/static-debian12` (final stage, zero shell)
- Java: `eclipse-temurin:21-jre-alpine`
- .NET: `mcr.microsoft.com/dotnet/runtime:8.0-alpine`

## GITHUB ACTIONS SECURITY

### Action pinning (opt-in org policy since Aug 2025 — not a global default, always pin regardless)

ALWAYS pin to full commit SHA — never mutable version tags:

```yaml
# WRONG (exploitable if tag is hijacked):
uses: actions/checkout@v4

# RIGHT (immutable SHA):
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
```

Reference incident: tj-actions/changed-files (2025) — mutable tag modified to exfiltrate secrets.

### OIDC for cloud auth (MANDATORY for AWS/GCP/Azure)

```yaml
permissions:
  id-token: write
  contents: read

steps:
  - uses: aws-actions/configure-aws-credentials@[SHA]
    with:
      role-to-assume: arn:aws:iam::123456789012:role/GitHubActions
      aws-region: us-east-1
# No long-lived AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY needed
```

Never: long-lived cloud credentials in GitHub Secrets for cloud deployments.

### Branch protection + deploy gates

```yaml
# Production deploy: require manual approval
environment:
  name: production
  # Require reviewer in GitHub Environment settings

# Never: auto-deploy to prod on push to main without approval
```

### Secret handling in Actions

NEVER: `echo ${{ secrets.SECRET }}` (leaks in logs)
NEVER: `${{ github.event.pull_request.head.sha }}` with `pull_request_target` (RCE risk)
ALWAYS: use `${{ secrets.NAME }}` only in `env:` or `with:` blocks

### Caching by language

```yaml
# Node (npm)
- uses: actions/setup-node@[SHA]
  with: { node-version: '24', cache: 'npm' }

# Python (pip)  
- uses: actions/setup-python@[SHA]
  with: { python-version: '3.12', cache: 'pip' }

# Go
- uses: actions/setup-go@[SHA]
  with: { go-version: '1.23', cache: true }

# Rust
- uses: Swatinem/rust-cache@[SHA]

# Flutter
- uses: subosito/flutter-action@[SHA]
  with: { channel: 'stable', cache: true }
```

## IaC SECURITY (Terraform/K8s)

Tools: Checkov (Terraform + K8s + ARM) — preferred, pin to a specific released version (e.g. `checkov==3.2.x`), never `latest`.
Trivy `--scanners config` for K8s — pin the container tag to a specific release (e.g. `aquasec/trivy:0.55.x`), not `:latest`.
tfsec is deprecated (merged into Trivy). Terrascan is archived — do not add either to a new pipeline.

```yaml
# CI: scan before plan — Action pinned to full SHA per the rule above,
# Checkov's own version pinned separately since the Action wraps a pip package
# that updates independently of the Action's release tag.
- name: Run Checkov
  uses: bridgecrewio/checkov-action@[SHA]
  with: { directory: '.', soft_fail: false, version: '3.2.x' }
```

Terraform checklist:

- [ ] State stored in remote backend (S3/GCS/Terraform Cloud) — never local
- [ ] State file NOT committed to git
- [ ] `terraform plan` reviewed before `terraform apply`
- [ ] Sensitive outputs marked `sensitive = true`
- [ ] IAM: least privilege — no `*:*` wildcards
- [ ] No hardcoded credentials in `.tf` files (use variables + secrets)

Kubernetes checklist:

- [ ] Pod SecurityContext: `runAsNonRoot: true`
- [ ] Resource limits: `limits.memory` + `limits.cpu` on every container
- [ ] No `privileged: true` containers
- [ ] Network policies defined (deny-all default + explicit allow)
- [ ] Secrets from K8s Secrets or external secret manager (not ConfigMap)

## SBOM GENERATION

Generate SBOM on every release:

```bash
# CycloneDX (for vulnerability tracking) + SPDX (for license compliance)
syft dir:. -o cyclonedx-json > sbom.cdx.json
syft dir:. -o spdx-json > sbom.spdx.json

# Vulnerability scan on SBOM
grype sbom:sbom.cdx.json

# Container image SBOM
syft oven/bun:1-alpine -o cyclonedx-json > base-image-sbom.cdx.json
```

Upload SBOM as GitHub Actions artifact. Attach to release.

## CONTAINER SCANNING

```yaml
- name: Scan image with Trivy
  uses: aquasecurity/trivy-action@[SHA]
  with:
    image-ref: ${{ env.IMAGE_TAG }}
    format: sarif
    output: trivy-results.sarif
    severity: CRITICAL,HIGH
    exit-code: '1'  # Fail on CRITICAL/HIGH

- name: Upload results
  uses: github/codeql-action/upload-sarif@[SHA]
  with: { sarif_file: trivy-results.sarif }
```

## ROLLBACK STRATEGY

Every prod deploy plan must include:

- How to detect failure (health check, error rate)
- How to rollback (previous image tag, `terraform apply -target`, DB rollback plan)
- Time to rollback (<5 min for stateless, defined timeline for stateful)
- Who approves rollback decision

Database rollback: zero-downtime migrations must be reversible. If not reversible, backup required before deploy.
