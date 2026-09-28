# Infrastructure Preset — Docker / Docker Compose

## Scope

The Dockerfile hardening checklist — multi-stage, version-pinned base, non-root user,
`HEALTHCHECK`, no baked secrets, `.dockerignore`, image scan — lives in `rules/600-devops.md`,
which auto-loads for every `Dockerfile*` / `docker-compose*` / `compose.yaml` / `compose.yml` file. Follow it there. This preset
covers what 600 doesn't: Compose topology, and the runtime behaviour of the containers.

The Compose files are protected — `compose.yaml` / `compose.yml` (the current default names) and
the legacy `docker-compose.yml`, plus their `.override` variants. Do not modify unless the change
was explicitly requested.

## Compose

In this file: the database port is published host-local ONLY (see the port note below); data
lives in a named volume, not a bind mount; the api reaches the database by service name, not
`localhost`; the secret is mounted at `/run/secrets/db_password` and its source file is never
committed.

```yaml
services:
  db:
    image: postgres:17-alpine
    ports: ["127.0.0.1:5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped
    logging:
      driver: json-file
      options: { max-size: "10m", max-file: "3" }

  api:
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://app@db:5432/app
    secrets: [db_password]
    deploy:
      resources:
        limits: { memory: 512M }

volumes:
  pgdata:
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

- **A published port bypasses the host firewall.** Docker writes its own iptables rules, so
  `ports: ["5432:5432"]` is reachable from the internet even with UFW denying 5432. Bind to
  `127.0.0.1:` or don't publish at all — containers on the same Compose network reach each other
  by service name without any published port.
- `depends_on` without `condition: service_healthy` only orders container *start* — plain
  `depends_on: [db]` waits for START, not READY. The app boots against a database that isn't
  accepting connections yet, and it looks like a flaky app.
- The json-file log driver's default rotates never, so disks fill — set `max-size`/`max-file`.
- Set a memory limit: an unbounded container OOM-kills its neighbours.
- Named volumes for persistent data. A bind mount for source code is a dev-only convenience; in
  production it means the image is not what actually runs.
- Keep dev and prod separate with override files or profiles rather than branching inside one file.
- The top-level `version:` key is obsolete in the Compose Specification — Compose v2 ignores it and
  warns.

## Secrets and env

- Runtime env vars or Compose/Docker secrets — never a credential in a Dockerfile, an image layer,
  or a committed Compose file. A build arg is visible in `docker history`.
- `.env` is local-dev only. Document the variables production needs; do not ship the file.
- Anything mounted from `secrets:` lands at `/run/secrets/<name>` and stays out of the image.

## Runtime

- Keep base images updated and rebuilt — a pinned base with no rebuild cadence is a pinned CVE.
- No `privileged: true`, no `--cap-add` beyond what the process demonstrably needs, no mounted
  Docker socket in an app container (it is root on the host).
- One concern per container; process managers inside a container hide crashes from the restart
  policy.

## Verification

`docker compose config` resolves overrides and env into the effective config. After `up`, the
`ps` STATUS must show `(healthy)`, not just `Up`. `hadolint` lints the Dockerfile; `trivy image`
can be swapped for `docker scout cves <image>`.

```bash
docker compose config
docker compose build
docker compose up -d && docker compose ps
docker compose logs --tail=50 api
hadolint Dockerfile
trivy image <image>
```

## Anti-patterns (beyond 600-devops's Dockerfile checklist)

- Publishing a database port to `0.0.0.0` — public despite the host firewall.
- `depends_on` with no health condition.
- Bind-mounting source code in production.
- Persistent data in an anonymous volume or in the container's writable layer.
- No log rotation on the json-file driver.
- No memory limit on any service.
- Secrets in `environment:` in a committed file, or in a build arg.
- `privileged: true`, or mounting `/var/run/docker.sock`, without a documented reason.
- `docker compose down -v` as a habit — `-v` deletes the named volumes, and the data with them.
