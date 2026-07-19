# Infrastructure Preset — Docker / Docker Compose

## Compose files

- Treat `docker-compose.yml` and `docker-compose.override.yml` as protected — do not modify unless explicitly requested.
- Keep service definitions minimal and reproducible.
- Use named volumes for persistent data; do not use bind mounts for production data.
- Keep dev and prod configs separate (override files or profiles).

## Dockerfiles

The hardening checklist (multi-stage, version-pinned base, non-root user, `HEALTHCHECK`, no
baked secrets, `.dockerignore`, image scan) lives in `rules/600-devops.md`, which auto-loads
for every `Dockerfile*`/`docker-compose*` file — follow it there; this preset only adds what
600 doesn't cover.

## Networking

- Use internal Docker networks; expose only ports that must be public.
- Do not expose database ports to the host in production.
- Use service names for inter-container communication.

## Secrets / env

- Use environment variables or Docker secrets — never hardcode in Dockerfiles or Compose files.
- `.env` files are for local dev only — document required vars for production.

## Security

- Keep base images updated.
- Do not run privileged containers unless required.

## Verification

- `docker compose config` — validate and resolve compose file (also shows the effective config without running)
- `docker compose build` — build images
- `docker scout cves <image>` or `trivy image <image>` — security scan

## Anti-patterns (beyond 600-devops's Dockerfile checklist)

- Exposing database ports to the public network.
- Bind-mounting source code in production.
- Privileged containers without a documented reason.
