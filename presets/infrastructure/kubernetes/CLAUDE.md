# Project Preset — Kubernetes

> Every change here is Tier 3 (`devops-guard`): a manifest edit is a production change with no
> compile step between you and the cluster. Plan first, and say which environment it lands in.

## Every workload declares these or it doesn't ship

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3                          # >1, with a PodDisruptionBudget, or a node drain is an outage
  template:
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        fsGroup: 10001
        seccompProfile: { type: RuntimeDefault }
      containers:
        - name: api
          image: registry/api@sha256:...     # digest, not `:latest` — a tag is mutable
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities: { drop: ["ALL"] }
          resources:
            requests: { cpu: 100m, memory: 128Mi }   # scheduling depends on these
            limits:   { memory: 512Mi }              # memory limit yes; CPU limit usually no
          livenessProbe:                              # restarts a hung process
            httpGet: { path: /health, port: 8080 }
            initialDelaySeconds: 10
          readinessProbe:                             # gates traffic — different check
            httpGet: { path: /health/ready, port: 8080 }
          startupProbe:                               # slow boot: protects liveness from killing it
            httpGet: { path: /health, port: 8080 }
            failureThreshold: 30
```

- **No resource requests** means the scheduler is guessing and your pod is first to be evicted.
- **A CPU limit throttles** rather than kills — a limit set equal to the request causes latency
  spikes that look like application bugs. Set memory limits; set CPU requests and be deliberate
  about CPU limits.
- **Liveness and readiness are not the same probe.** Pointing liveness at a check that fails when
  a dependency is down turns a dependency blip into a restart storm.

## Secrets

- A `Secret` is base64, **not encryption** — anyone with read access to the namespace has the
  plaintext. Use External Secrets Operator, Sealed Secrets, or the cloud provider's CSI driver.
- Never commit a rendered `Secret`. Never put credentials in a `ConfigMap`, an env literal, or an
  image layer.
- Mount as files rather than env vars where possible: env vars leak into crash dumps, child
  processes and `kubectl describe`.

## Networking and blast radius

- Default-deny `NetworkPolicy` per namespace, then allow what's needed. A flat cluster network
  means one compromised pod reaches every database.
- One namespace per environment with `ResourceQuota` and `LimitRange`.
- A dedicated `ServiceAccount` per workload with a minimal `Role` —
  `automountServiceAccountToken: false` unless the pod actually calls the API server.

## Rollouts

- `maxUnavailable: 0` + `maxSurge: 1` for zero-downtime; verify the app handles two versions at
  once (that constraint is the same expand-then-contract rule as a DB migration).
- `terminationGracePeriodSeconds` longer than the longest in-flight request, and a `preStop`
  sleep so the endpoint deregisters before the process exits — otherwise you drop requests on
  every deploy.
- `kubectl rollout undo` is the rollback plan, and it must be stated before applying.

## Verification

```bash
kubectl apply --dry-run=server -f manifests/   # validates against the real API + admission
kubeconform -strict -summary manifests/        # schema check in CI
kubectl diff -f manifests/                     # what would actually change
helm template . | kubeconform -strict -         # for charts
trivy config manifests/                         # misconfiguration scan
kubectl rollout status deploy/api --timeout=120s
```

## Anti-patterns

- `image: app:latest`, or any mutable tag.
- No resource requests; a CPU limit equal to the request.
- Same endpoint for liveness and readiness; missing startup probe on a slow-booting app.
- `runAsRoot`, `privileged: true`, or no `securityContext` at all.
- Plaintext `Secret` in git.
- No `NetworkPolicy`; the `default` ServiceAccount with an auto-mounted token.
- `replicas: 1` for anything that is supposed to be available.
- `kubectl edit` / `kubectl patch` against a cluster whose state is in git — the next apply
  silently reverts it.
