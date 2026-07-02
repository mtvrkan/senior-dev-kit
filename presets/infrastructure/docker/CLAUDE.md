# Infrastructure Preset — Docker / Docker Compose

## Compose files

- Treat `docker-compose.yml` and `docker-compose.override.yml` as protected — do not modify unless explicitly requested.
- Keep service definitions minimal and reproducible.
- Use named volumes for persistent data; do not use bind mounts for production data.
- Keep dev and prod configs separate (override files or profiles).

## Dockerfiles

- Use multi-stage builds to keep image size small.
- Pin base image versions — do not use `latest` tags in production Dockerfiles.
- Run as non-root user in production images.
- Copy only what is needed — use `.dockerignore`.
- Do not bake secrets or credentials into images.

## Networking

- Use internal Docker networks; expose only ports that must be public.
- Do not expose database ports to the host in production.
- Use service names for inter-container communication.

## Secrets / env

- Use environment variables or Docker secrets — never hardcode in Dockerfiles or Compose files.
- `.env` files are for local dev only — document required vars for production.

## Security

- Scan images before shipping: `docker scout cves` or `trivy image <name>`.
- Keep base images updated.
- Do not run privileged containers unless required.

## Verification

- `docker compose config` — validate and resolve compose file (also shows the effective config without running)
- `docker compose build` — build images
- `docker scout cves <image>` or `trivy image <image>` — security scan

## Anti-patterns

- `latest` tag in production.
- Secrets in Dockerfiles or committed `.env` files.
- Running as root in production containers.
- Exposing database ports to the public network.
- Bind-mounting source code in production.
