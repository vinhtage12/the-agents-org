# Infrastructure

Requires Docker Compose, GNU Make, and Python 3.

Each service directory contains `docker-compose.yml`, `.env.example`, and local `.env.<environment>` files. Copy the example before running commands and set credentials and an absolute, dedicated `VOLUME_PATH`, e.g. `/srv/the-agents-org/development/postgres`. The parent directory must be writable by your user.

```sh
cd apps/infrastructure
cp postgres/.env.example postgres/.env.development
make up-postgres -- --development
make down-postgres -- --development
make remove-postgres -- --development
```

`down` retains data. `remove` stops the Compose project and deletes its data directory. `up` creates the directory only when missing. All commands require the selected environment file. Use separate volume paths for each environment.

To add a service, create a sibling directory with the same layout. For persistent data declare `x-volume-path: ${VOLUME_PATH:?VOLUME_PATH is required}` in Compose and use that path as the bind source. Services without persistent data may omit it. No Makefile changes are needed.

Postgres has no published host port. Its internal port is `5432`. Inspect its current IP with:

```sh
docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$(docker compose --project-name agents-postgres-development --env-file postgres/.env.development -f postgres/docker-compose.yml ps -q postgres)"
```

Set the daemon `DATABASE_URL` using that address and port 5432. The IP may change when recreating the container. A daemon in another container must join the same Compose network (then it can also resolve `postgres`). Host access to the bridge IP depends on the Docker platform; Docker Desktop does not expose Linux container IPs directly to the host.
