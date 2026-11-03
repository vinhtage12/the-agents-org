# Daemon module layers

Applies to `apps/daemon/src/modules/<domain>/**`.

Every domain module separates code by responsibility. A controller is an HTTP
adapter, not a place for request models, business logic, persistence, or
third-party integration. Keep each concern in its matching layer; create an
optional layer only when that concern exists.

```text
<domain>/
  <domain>.module.ts          # Nest composition: imports, controllers, providers, exports
  controllers/                # HTTP routes, guards, request/response mapping
  dtos/                       # Validated request and response data classes
  services/                   # Use cases, business rules, and orchestration
  clients/                    # Outbound API/SDK adapters, when needed
  gateways/                   # WebSocket adapters, when needed
  entities/                   # Prisma-backed model classes, when needed
  utils/                      # Stateless domain helpers, when needed
```

| Concern | Required location |
| --- | --- |
| Route decorators, HTTP status handling, params/body extraction | `controllers/` |
| `class-validator` / Swagger request or response classes | `dtos/` |
| Business rules, Prisma access, transactions, and use-case orchestration | `services/` |
| Calls to external APIs or SDKs | `clients/` |
| Socket event handling | `gateways/` |
| Prisma model implementations returned by endpoints | `entities/` |

Controllers call services and translate HTTP input/output. Services may depend
on clients and Prisma, but must not depend on controllers. DTOs do not contain
business logic. Keep a source file and its `*.spec.ts` together in the same
layer.

For a new endpoint, add or reuse a DTO in `dtos/`, keep the route handler in
`controllers/`, and place its work in `services/`. A small read-only endpoint
may call a service method directly, but it does not make the controller a
service. Do not put DTO classes, Prisma queries, business rules, or external
client calls in a controller just because the endpoint is small or urgent.

When changing an existing all-in-one controller, move only the responsibilities
needed by the current task unless a broader cleanup is explicitly requested.
Preserve routes, validation, and behavior while relocating code.
