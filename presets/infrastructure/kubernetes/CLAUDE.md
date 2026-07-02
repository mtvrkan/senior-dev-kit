# Project Preset — Kubernetes

## Manifest structure (per app)

```text
k8s/
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/
    │   └── kustomization.yaml    ← patch replica count, image tag
    └── production/
        └── kustomization.yaml
```

## Deployment — required fields

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  labels:
    app: api
    version: "1.0.0"
spec:
  replicas: 2                    # minimum 2 for zero-downtime rollout
  selector:
    matchLabels:
      app: api
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0          # zero-downtime: never kill pod before new one is ready
  template:
    metadata:
      labels:
        app: api
    spec:
      securityContext:
        runAsNonRoot: true       # REQUIRED — never run as root
        runAsUser: 1000
        fsGroup: 2000
      containers:
        - name: api
          image: registry.example.com/api:$(IMAGE_TAG)
          ports:
            - containerPort: 3000
          resources:
            requests:             # REQUIRED — scheduler needs this
              cpu: "100m"
              memory: "128Mi"
            limits:               # REQUIRED — OOM kill protection
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:         # REQUIRED — traffic only when ready
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:          # REQUIRED — restart on deadlock
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: db-password
          envFrom:
            - configMapRef:
                name: api-config
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: [ALL]
      terminationGracePeriodSeconds: 30
```

## Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: ClusterIP        # never LoadBalancer for internal services
```

## Ingress (with TLS)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
    - hosts: [api.example.com]
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
```

## Secrets — never commit to git

```yaml
# Reference external secret (External Secrets Operator or Sealed Secrets)
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: aws-secrets-manager
  target:
    name: api-secrets
  data:
    - secretKey: db-password
      remoteRef:
        key: production/api
        property: db-password
```

Never: `kubectl create secret` with plain text in shell history. Never commit `Secret` YAML with base64 values.

## ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-config
data:
  NODE_ENV: production
  LOG_LEVEL: info
  DB_HOST: postgres.default.svc.cluster.local
  # Never put secrets in ConfigMap — only non-sensitive config
```

## HPA — Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Network Policy — deny-all default

```yaml
# Deny all ingress/egress by default
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]

# Then explicitly allow what's needed
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Egress]
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - port: 5432
```

## Verification commands

```bash
kubectl apply --dry-run=server -f k8s/     # validate manifests
kubectl rollout status deployment/api       # watch rollout
kubectl rollout history deployment/api      # audit history
kubectl rollout undo deployment/api         # rollback
```

## Anti-patterns

- No resource limits (one bad pod starves the node)
- No readinessProbe (traffic routed to unready pod)
- `runAsRoot: true` or missing securityContext
- Secrets in ConfigMap or env literals
- No NetworkPolicy (flat network = lateral movement risk)
- `latest` image tag (non-deterministic deploys)
- `maxUnavailable > 0` without testing data migration compatibility
