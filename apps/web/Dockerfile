# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=true pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ARG APP_ENV=production
RUN test -f ".env.${APP_ENV}" && pnpm build --mode "${APP_ENV}"

FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
