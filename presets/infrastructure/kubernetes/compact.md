## Kubernetes

- Always set resource `requests` + `limits` (CPU + memory)
- `readinessProbe` required — no traffic until ready
- `livenessProbe` required — restart on deadlock
- `runAsNonRoot: true` + `allowPrivilegeEscalation: false` always
- `readOnlyRootFilesystem: true` where possible
- `maxUnavailable: 0` for zero-downtime rolling updates
- Secrets via External Secrets Operator — never commit base64 YAML
- NetworkPolicy: deny-all default + explicit allow rules
- Never `latest` image tag — always pinned digest or semver
- `terminationGracePeriodSeconds: 30` minimum
