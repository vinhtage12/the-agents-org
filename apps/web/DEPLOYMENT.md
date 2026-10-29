# Web environments and deployment

`.env.development`, `.env.staging`, and `.env.production` contain public build configuration. Set the browser-accessible daemon URL in each file before deployment. The checked-in URLs are local defaults. Never store secrets in `VITE_*` variables.

```sh
pnpm --filter web dev:development
pnpm --filter web build:staging
pnpm --filter web preview:staging
```

The same commands support `development`, `staging`, and `production`. Vite also supports `pnpm --filter web build --mode <environment>`. `preview` serves the existing build; build the matching environment first.

From `apps/web`, deploy with:

```sh
export NPMRC="@truyenmoinhu:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}"
docker compose --env-file .env.production up -d --build
```

The token needs read access to the private packages. BuildKit mounts npm configuration as a secret during dependency installation; it is not copied into the image. The multi-stage image serves only the built site through Nginx. `WEB_PORT` selects the published port; `APP_ENV` selects the build environment. Rebuild after changing `VITE_*` values. Nginx handles client-side route fallback and caches hashed assets.

Stop with `docker compose --env-file .env.production down`. For simultaneous environments pass a distinct `--project-name` and `WEB_PORT` for each deployment.
