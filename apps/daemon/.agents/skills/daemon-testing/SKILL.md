---
name: daemon-testing
description: Use when adding, updating, or running unit, e2e, or coverage tests in apps/daemon.
---

# Test the daemon

Unit tests are `*.spec.ts` beside their source under `src/`. Use
`Test.createTestingModule` from `@nestjs/testing` for Nest injection/module tests.
Register the controller or service under test and supply mock dependencies through
`{ provide: PrismaService, useValue: prismaMock }` or the equivalent client token.
Import PrismaService from `src/database/prisma.service.ts`, using a relative path
from the test. Keep real database/network calls out of unit tests.

Create fresh mocks or reset them before each case. Assert observable results and
meaningful Prisma/client calls, including error cases. For a new feature or bug
fix, run the focused test and see it fail before implementing, then run it and the
whole daemon suite. Close TestingModule instances or applications in cleanup.

E2e tests live in `test/*.e2e-spec.ts`, use Supertest, and import AppModule from
`src/modules/app.module.ts`. Configure the same validation/prefix as production
when testing API contracts. Health e2e needs local PostgreSQL configured in
`.env.development`; workspace tests additionally require `TEST_DATABASE_URL`.
Use a local/test database and remove only test-created records in cleanup. Never
point these tests at production. Tests needing Unix/HTTP sockets may require the
execution environment's permission to bind local sockets.

From this skill directory:

```sh
python3 scripts/run_tests.py
python3 scripts/run_tests.py unit tickets
python3 scripts/run_tests.py e2e
python3 scripts/run_tests.py cov jira
python3 scripts/run_tests.py unit tickets --dry-run
```

The runner invokes the package's pnpm test scripts from the daemon directory,
passes an optional Jest path pattern as an argument, preserves environment
variables and exit status, and never installs dependencies. Jest configuration
already disables Watchman. Database-dependent skipped tests are not verification
of database behavior; report skipped tests and missing prerequisites explicitly.

Runner self-check, from this skill directory:

```sh
python3 scripts/test_run_tests.py
```
