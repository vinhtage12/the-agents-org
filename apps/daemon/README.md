<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Herdr Agent Bridge

The daemon connects to a running Herdr session on the same machine. On Unix-like
systems it defaults to `$XDG_CONFIG_HOME/herdr/herdr.sock` (or
`~/.config/herdr/herdr.sock` when unset); set `HERDR_SOCKET_PATH` to
override the socket. On Windows, set it to Herdr's named-pipe path. If `herdr`
is not on the daemon's `PATH`, set `HERDR_BIN_PATH` to its executable path.

The API listens on `127.0.0.1`. `GET /api/v1/agents` lists detected agents,
`GET /api/v1/agents/:id` reads one agent, and
`POST /api/v1/agents/:id/prompts` accepts `{ "prompt": "..." }`. Agent
updates use Socket.IO namespace `/api/v1/agents` with engine path
`/api/v1/socket.io`. Connect with `auth: { agentId: "w1:p2" }` and listen for
the `agent-event` event. Events include status and terminal output frames
(`output.data` is base64 encoded ANSI data). Agent IDs are Herdr pane IDs.

Create a pane and start an agent with `POST /api/v1/agents` and a JSON body such
as `{ "agent": "claude", "parentPaneId": "w1:p2", "direction": "right" }`.
`parentPaneId` and `direction` are optional; without a parent ID, Herdr splits
the currently focused pane. Supported values are `claude`, `codex`, `copilot`,
and `antigravity` (`agy` in Herdr). The response includes the new `paneId`, a
generated agent name, readiness status, and `ready` boolean.

Request bodies are transformed and validated with DTO classes. Unknown body
fields are rejected; prompt bodies require non-blank text of at most 30000
characters.

Install the matching Herdr integrations for Claude Code, Codex, Copilot, and
Antigravity if you need session restoration after a Herdr restart.

## Dashboard API

Workspace endpoints: GET/POST `/api/v1/workspaces`, GET `/api/v1/workspaces/:id`, POST `/api/v1/workspaces/:id/projects`, GET `/api/v1/workspaces/:id/projects/:projectId`. Create bodies contain `name` and `code`; duplicate codes return 409.

GET `/api/v1/system/docker` runs Docker CLI with the daemon user's context and permissions. It only reads container status and stats.

GET `/api/v1/system/agent-usage` reads optional quota caches. Configure `CODEX_USAGE_CACHE_PATH`, `CLAUDE_USAGE_CACHE_PATH`, `COPILOT_USAGE_CACHE_PATH`, `ANTIGRAVITY_USAGE_CACHE_PATH`; defaults are `~/.<provider>/usage-cache.json`. Expected JSON: `{"windows":[{"label":"weekly","usedPercent":25,"resetsAt":"2026-11-01T00:00:00Z"}]}`. File modification time is reported as sample time. Without an explicit Codex cache, the daemon reads the latest rate-limit events from `$CODEX_HOME/sessions` (default `~/.codex/sessions`). Reads are bounded to eight recent log tails, one MiB each, and cached for 60 seconds. Claude, Copilot and Antigravity currently require an explicit quota cache because their inspected local sources do not expose verified quota windows; absent caches are reported unavailable. No credentials are read.

### Dashboard tests

Run `pnpm --filter daemon test --runInBand` for unit tests. For PostgreSQL HTTP tests, migrate a **dedicated test database**, set `TEST_DATABASE_URL`, then run `pnpm --filter daemon test:e2e --runInBand workspaces`. The suite creates uniquely named records and removes only its own records. It is skipped when `TEST_DATABASE_URL` is absent.

### Workspace/project CRUD and moves

- `PATCH /api/v1/workspaces/:id`: partial `{name?, code?}`.
- `DELETE /api/v1/workspaces/:id`: 204 on success, 409 when projects remain (no cascading deletion).
- `PATCH /api/v1/workspaces/:id/projects/:projectId`: partial `{name?, code?, workspaceId?}`; `workspaceId` moves the project to an existing workspace. The source path must match the current owner; stale source paths return 404.
- `DELETE /api/v1/workspaces/:id/projects/:projectId`: 204 on success.

Moves preserve project ID/code and update ownership atomically. Invalid update values return 400; duplicate codes return 409. No Prisma migration is required.

Docker snapshots include nullable `cpuPercent`, `memoryUsageBytes`, `memoryLimitBytes`, and `memoryPercent` alongside the original display strings. CPU is per-core and may exceed 100%; memory percentage is relative to each container limit. Missing stats remain null. Charts display the current sample, not historical data. Web dates use local time with `DD/MM/YYYY HH:mm` regardless of language.
