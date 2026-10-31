# Kanban 02 — Agent run + bước Spec: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kéo card To Do → In Spec để sinh agent Spec trong Herdr (đúng repo, provider, model, effort). Agent báo xong bằng callback, card tự sang In Review Spec. Chủ dự án xem, sửa, feedback và approve spec trong dialog. Board cập nhật realtime.

**Architecture:** Daemon thêm module `agent-runs`. Module này tạo hoặc dùng lại pane Herdr, lưu `AgentRun`, nhận callback hoàn thành và phát sự kiện board qua Socket.IO namespace `/api/v1/board`. `TicketsModule` import module này để làm các chuyển trạng thái và API dialog. Web bật kéo thả trên board, thêm nhãn card và dialog card.

**Tech Stack:** NestJS 11, Prisma 7 + Postgres, Jest, Socket.IO; React 19, TanStack Router/Query, `@truyenmoinhu/*`, `socket.io-client`, thêm `react-markdown`.

**Spec:** `docs/superpowers/specs/2026-10-30-kanban-board-design.md` (Plan trước: `docs/superpowers/plans/2026-10-30-kanban-01-tickets-foundation.md`)

### Phạm vi
- **Có:** spec mục 4.2 (dòng To Do, In Spec, In Review Spec), 4.3, 4.6, 4.6b, 4.7 (nhãn card), mục 5 (phiên bản spec, chặn khi thiếu file agent, khoá đổi agent/repo khi đang chạy, dùng lại pane cho feedback, "cần bạn" khi agent chờ người, đổi project khi còn To Do).
- **Để Plan 03:** In Progress, In Testing, In Review, Done, Canceled khi sync, test case, cảnh báo trùng repo, đóng pane khi Done/Canceled, terminal nhúng trong dialog. Plan 02 hiện pane ID trong dialog để chủ dự án mở pane đó trong Herdr.

### Quyết định cho spec mục 6
- **Tín hiệu "đã xong":** prompt bảo agent ghi kết quả vào `<runDir>/output.md`, rồi chạy `curl` gọi `POST /api/v1/agent-runs/:id/complete` với header `x-run-token`. Run id, token và runDir nằm ngay trong prompt. Vì vậy một pane dùng lại cho nhiều run mà không cần đổi env. Trạng thái idle của Herdr **không** bao giờ được coi là xong.
- **Model/effort:** truyền qua `args` của `agent.start` (bảng ở Task 3). Skills và chỉ dẫn của role đi trong prompt đầu tiên, giống nhau cho mọi provider.
- **Realtime:** daemon phát `board-changed { projectId }`, web invalidate query board và query chi tiết ticket.

## Global Constraints

- Giữ mọi Global Constraints của Plan 01 (lệnh test/verify, rules web, 8 trạng thái đúng thứ tự, App không ghi Jira, không chạy git).
- Module daemon mới phải tạo bằng script `apps/daemon/.agents/skills/daemon-create-module/scripts/create_module.py`. Schema đổi thì phải có migration, chạy `db:generate` và cập nhật entity (`apps/daemon/.agents/rules/daemon-migrations.md`).
- Thư mục run: `RUNS_DIR` hoặc `~/.the-agents-org/runs`; mỗi run một thư mục `<RUNS_DIR>/<runId>/`. Agent không được để lại file trong repo.
- URL callback: `http://127.0.0.1:${PORT}/api/v1` (daemon chỉ listen `127.0.0.1`).
- Agent Spec không được sửa file trong repo; nó chỉ đọc code và viết spec.
- Trước khi sửa `pnpm-lock.yaml` (thêm `react-markdown`), đợi các pane khác đang chạm file này rảnh (AGENTS.md gốc).

## Review Focus

1. **Kéo To Do → In Spec hai lần liền** (double drop, hai tab) → chỉ một run, lần sau 409 (Task 5: `starts only one spec run for concurrent moves`).
2. **Herdr lỗi hoặc agent kẹt ở màn hình hỏi lúc khởi động** → ticket quay về cột cũ, run `FAILED`, pane được giữ để xem; thử lại dùng lại pane đó (Task 4: `reverts the ticket when the agent cannot start`, `reuses a live pane from a failed run`).
3. **Callback sai token, gọi hai lần, hoặc `output.md` trống/thiếu** → 403 / 409 / 400, ticket không đổi cột, run vẫn `RUNNING` khi thiếu file để agent gọi lại (Task 4: `rejects bad callbacks`).
4. **Agent đang hỏi lại giữa chừng** (idle hoặc blocked mà chưa callback) → nhãn "cần bạn", không phải "đang chạy" (Task 5: `labels idle running agents as needs_you`).
5. **Feedback sau khi chủ dự án đã sửa tay spec** → prompt chứa bản đã sửa, không phải bản agent viết (Task 3: `includes the hand-edited spec and feedback`).

---

### Task 1: Schema `AgentRun`, `SpecVersion` và trường mới của Ticket

**Files:**
- Modify: `apps/daemon/prisma/schema.prisma`, `apps/daemon/src/modules/tickets/entities/ticket.entity.ts`
- Create: `apps/daemon/prisma/migrations/<timestamp>_agent_runs_spec/migration.sql` (sinh bằng lệnh), `apps/daemon/src/modules/tickets/entities/spec-version.entity.ts`. `AgentRunEntity` được tạo ở Task 4, sau khi scaffold module `agent-runs`.

**Interfaces:**
- Produces:
  - `enum AgentStep { SPEC DEV TEST }`, `enum AgentRunStatus { RUNNING COMPLETED FAILED STOPPED }`
  - `AgentRun { id Int, ticketId Int, step AgentStep, agentSlug String @db.VarChar(128), paneId String? @db.VarChar(128), token String @db.VarChar(64), status AgentRunStatus @default(RUNNING), feedback String? @db.Text (feedback đã gửi khi start run), error String? @db.Text, startedAt DateTime @default(now()), finishedAt DateTime? }`, map `agent_runs`, `@@index([ticketId, step])`, ticket `onDelete: Cascade`.
  - `SpecVersion { id Int, ticketId Int, version Int, content String @db.Text, feedback String? @db.Text, editedAt DateTime?, createdAt DateTime @default(now()) }`, map `spec_versions`, `@@unique([ticketId, version])`, ticket `onDelete: Cascade`. `feedback` là feedback đã dẫn tới phiên bản này; `editedAt` khác null khi chủ dự án đã sửa tay.
  - `Ticket` thêm: `specApprovedAt DateTime?`, `extraInstructions String @default("") @db.Text`, `extraSkills String[] @default([])`, `runs AgentRun[]`, `specs SpecVersion[]`.
  - Cột snake_case qua `@map`.

- [ ] **Step 1: Sửa `schema.prisma` và các entity theo Interfaces** (entity `implements` model sinh ra, `@ApiProperty` cho enum, theo mẫu `ticket.entity.ts`)
- [ ] **Step 2: Sinh migration và client**

Run: `pnpm --filter daemon db:migrate:dev --name agent_runs_spec && pnpm --filter daemon db:generate`
Expected: SQL tạo `agent_runs`, `spec_versions`, hai enum, ba cột mới ở `tickets`; không có lệnh `DROP`.

- [ ] **Step 3: Build và test**

Run: `pnpm --filter daemon build && pnpm --filter daemon test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/daemon/prisma apps/daemon/src/modules/tickets/entities
git commit -m "Add agent run and spec version schema"
```

---

### Task 2: Herdr — `cwd`, `args`, đóng pane, export service

**Files:**
- Modify: `apps/daemon/src/modules/herdr/services/herdr.service.ts`, `apps/daemon/src/modules/herdr/herdr.module.ts`
- Test: `apps/daemon/src/modules/herdr/services/herdr.service.spec.ts`

**Interfaces:**
- Produces:
  - `CreateAgentInput` thêm `cwd?: string; args?: string[]`. `cwd` truyền vào `pane.split`, `args` vào `agent.start` (mặc định `[]`).
  - **Sửa lỗi có sẵn:** schema Herdr (`herdr api schema --json`, `PaneSplitParams`) gọi target là `target_pane_id`, không phải `pane_id`. `parentPaneId` phải map sang `target_pane_id`.
  - `HerdrService.closeAgent(paneId: string): Promise<void>` gọi `pane.close { pane_id }`. Lỗi `not_found` thì bỏ qua, lỗi khác thì qua `rethrowHerdrError`. `closePane` riêng tư hiện có giữ nguyên hành vi nuốt lỗi.
  - `HerdrService.subscribeAgent(paneId: string, onChange: () => void): () => void` bọc `herdr.subscribe([paneId], …)`. Nó gọi `onChange` với mọi event trừ `subscription_started`, và cả khi subscription lỗi hoặc đóng. Hàm trả về hàm huỷ.
  - `HerdrModule` thêm `exports: [HerdrService]`.
  - `CreateAgentDto` (HTTP) **không** thêm `cwd`/`args`: chỉ code trong daemon được truyền chúng.

- [ ] **Step 1: Viết test hỏng**

```ts
it('passes cwd to pane.split and args to agent.start', async () => {
  herdr.request
    .mockResolvedValueOnce({ pane: { pane_id: 'w1:p9' } })
    .mockResolvedValueOnce({ agent: { pane_id: 'w1:p9', agent: 'claude', agent_status: 'idle' } });
  await service.createAgent({ agent: 'claude', cwd: '/repos/ff-web', args: ['--model', 'opus'], parentPaneId: 'w1:p1' });
  expect(herdr.request).toHaveBeenNthCalledWith(1, 'pane.split', { direction: 'right', cwd: '/repos/ff-web', target_pane_id: 'w1:p1' });
  expect(herdr.request).toHaveBeenNthCalledWith(2, 'agent.start', expect.objectContaining({ pane_id: 'w1:p9', args: ['--model', 'opus'] }), 35000);
});
it('closeAgent ignores panes that are already gone', async () => {
  herdr.request.mockRejectedValueOnce(new HerdrApiError('gone', 'not_found'));
  await expect(service.closeAgent('w1:p9')).resolves.toBeUndefined();
  herdr.request.mockRejectedValueOnce(new HerdrApiError('boom', 'herdr_error'));
  await expect(service.closeAgent('w1:p9')).rejects.toBeInstanceOf(BadGatewayException);
});
it('subscribeAgent reports changes but not the start ack', () => {
  const onChange = jest.fn();
  service.subscribeAgent('w1:p9', onChange);
  const [, onEvent, onError] = herdr.subscribe.mock.calls[0];
  onEvent({ type: 'subscription_started' });
  onEvent({ event: 'pane.agent_status_changed' });
  onError(new Error('closed'));
  expect(onChange).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- herdr.service`
Expected: FAIL (`target_pane_id`/`cwd` không có trong lời gọi, `closeAgent is not a function`)

- [ ] **Step 3: Cài đặt theo Interfaces**
- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm --filter daemon test -- herdr`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/modules/herdr
git commit -m "Support cwd, args and closing panes in Herdr service"
```

---

### Task 3: Tham số provider và prompt Spec (hàm thuần)

**Files:**
- Create: `apps/daemon/src/modules/agent-runs/utils/agent-args.ts`, `apps/daemon/src/modules/agent-runs/utils/spec-prompt.ts`
- Test: `apps/daemon/src/modules/agent-runs/utils/agent-args.spec.ts`, `apps/daemon/src/modules/agent-runs/utils/spec-prompt.spec.ts`

**Interfaces:**
- Consumes: `AgentProfile` (`agent-profiles.service.ts`).
- Produces:
  - `buildAgentArgs(profile: AgentProfile, runsDir: string): string[]`. Bảng cờ, đã đối chiếu `--help` của CLI cài trên máy:

    | provider | model | effort | cho phép ghi runsDir |
    |---|---|---|---|
    | `claude` | `--model <m>` | `--effort <e>` | `--add-dir <runsDir>` |
    | `codex` | `-m <m>` | `-c model_reasoning_effort=<e>` | `--add-dir <runsDir>`, `-c sandbox_workspace_write.network_access=true` (để `curl` callback) |
    | `copilot` | `--model <m>` | `--reasoning-effort <e>` | `--add-dir <runsDir>` |
    | `agy` | `--model <m>` | `--effort <e>` | (không có) |

    Bỏ cờ khi profile không có `model`/`effort`. Vì pane được dùng lại cho nhiều run, `--add-dir` trỏ vào `RUNS_DIR` (thư mục cha) chứ không trỏ thư mục của run đầu.
  - `interface SpecPromptInput { profile: AgentProfile; ticket: { jiraKey: string; summary: string; description: string; jiraUrl: string; extraInstructions: string; extraSkills: string[] }; repoPath: string; run: { id: number; token: string; dir: string; callbackUrl: string }; previous?: { version: number; content: string; feedback: string } }`
  - `buildSpecPrompt(input: SpecPromptInput): string`. Ghép theo thứ tự: chỉ dẫn role (`profile.instructions`), `extraInstructions`, dòng `Skills: a, b` (gộp `profile.skills` + `extraSkills`, bỏ trùng, bỏ cả dòng khi rỗng), ticket (key, summary, url, description), repo path, nhiệm vụ, khối `previous` nếu có, và hợp đồng đầu ra. Nhiệm vụ lấy từ spec 4.2: làm rõ mục đích, use case, business rules, scope, chỗ xung đột với codebase, rồi viết spec gồm các bước thực hiện; viết bằng tiếng Việt; không sửa file nào trong repo; được hỏi lại chủ dự án nếu thiếu thông tin. Hợp đồng đầu ra, đúng nguyên văn:

    ```text
    When the spec is final:
    1. Write the full spec as markdown to <dir>/output.md (overwrite it).
    2. Run: curl -fsS -X POST -H 'x-run-token: <token>' <callbackUrl>/agent-runs/<id>/complete
    Do not run the command before output.md is complete. If it fails, fix the problem and run it again.
    ```

- [ ] **Step 0: Scaffold module `agent-runs`**

Run: `python3 apps/daemon/.agents/skills/daemon-create-module/scripts/create_module.py agent-runs --dry-run`, rồi chạy lại không có `--dry-run`.
Expected: có `apps/daemon/src/modules/agent-runs/agent-runs.module.ts`, module được import vào `app.module.ts`.

- [ ] **Step 1: Viết test hỏng**

```ts
const profile = { slug: 'analyst', name: 'Analyst', provider: 'claude', model: 'claude-opus-5-5', effort: 'high', skills: ['brainstorming'], instructions: 'Think hard.' } as const;
it('maps model, effort and run dir per provider', () => {
  expect(buildAgentArgs(profile, '/runs')).toEqual(['--model', 'claude-opus-5-5', '--effort', 'high', '--add-dir', '/runs']);
  expect(buildAgentArgs({ ...profile, provider: 'codex' }, '/runs')).toEqual(['-m', 'claude-opus-5-5', '-c', 'model_reasoning_effort=high', '--add-dir', '/runs', '-c', 'sandbox_workspace_write.network_access=true']);
  expect(buildAgentArgs({ ...profile, provider: 'agy', model: undefined, effort: undefined }, '/runs')).toEqual([]);
});
it('builds the first spec prompt with the callback contract', () => {
  const text = buildSpecPrompt({ profile, ticket: { jiraKey: 'FMS-1', summary: 'Login', description: 'Users log in', jiraUrl: 'https://j/browse/FMS-1', extraInstructions: 'Use SSO.', extraSkills: ['brainstorming', 'jira'] }, repoPath: '/repos/ff-web', run: { id: 7, token: 'tok', dir: '/runs/7', callbackUrl: 'http://127.0.0.1:3005/api/v1' } });
  expect(text).toContain('Think hard.');
  expect(text).toContain('Use SSO.');
  expect(text).toContain('Skills: brainstorming, jira');
  expect(text).toContain('/runs/7/output.md');
  expect(text).toContain("curl -fsS -X POST -H 'x-run-token: tok' http://127.0.0.1:3005/api/v1/agent-runs/7/complete");
  expect(text).not.toContain('Feedback');
});
it('includes the hand-edited spec and feedback', () => {
  const text = buildSpecPrompt({ /* như trên */ previous: { version: 2, content: '# Spec\nEdited by owner', feedback: 'Split step 3' } } as never);
  expect(text).toContain('Edited by owner');
  expect(text).toContain('Split step 3');
  expect(text).toContain('v2');
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- agent-runs/utils`
Expected: FAIL, module not found

- [ ] **Step 3: Cài đặt hai hàm**
- [ ] **Step 4: Chạy test, xác nhận pass** — cùng lệnh, Expected: PASS
- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/modules/agent-runs apps/daemon/src/modules/app.module.ts
git commit -m "Add provider args and spec prompt builders"
```

---

### Task 4: Module `agent-runs` — chạy agent Spec, callback, board gateway

**Files:**
- Create (trong module đã scaffold ở Task 3): `services/agent-runs.service.ts`, `controllers/agent-runs.controller.ts`, `gateways/board.gateway.ts`, `entities/agent-run.entity.ts` (`implements` model `AgentRun`, theo mẫu `ticket.entity.ts`)
- Test: `services/agent-runs.service.spec.ts`, `controllers/agent-runs.controller.spec.ts`
- Modify: `apps/daemon/src/configuration/env.validation.ts` (`RUNS_DIR?: string`), `apps/daemon/.env.example`, `apps/daemon/src/modules/app.module.ts`, `apps/daemon/src/modules/app.module.spec.ts`

**Interfaces:**
- Consumes: `HerdrService.createAgent/sendPrompt/listAgents/closeAgent/subscribeAgent` (Task 2), `buildAgentArgs`, `buildSpecPrompt` (Task 3), `AgentProfilesService.get` (Plan 01), `assertRepoPath` (`projects/controllers/project-settings.controller.ts`).
- Produces:
  - `AgentRunsModule` imports `HerdrModule`, `AgentProfilesModule`; exports `AgentRunsService`, `BoardGateway`.
  - `BoardGateway`: namespace `/api/v1/board`, `path: '/api/v1/socket.io'`, `transports: ['websocket']`, kiểm tra origin y như `HerdrGateway.afterInit`. `emitChanged(projectId: number): void` phát `board-changed` với `{ projectId }` cho mọi client.
  - `AgentRunsService.startSpec(ticketId: number, previous?: { version: number; content: string; feedback: string }): Promise<AgentRunEntity>`. Nó **không** đổi `ticket.status`; việc đó do caller (Task 5) làm. Thuật toán:
    1. Đọc ticket kèm `repo`. Thiếu `repoId` thì `BadRequestException('Ticket has no repo')`. Thiếu `specAgent` thì `BadRequestException('Ticket has no spec agent')`. Sau đó chạy `assertRepoPath(repo.path)` và `profiles.get(specAgent)`; slug không còn thì `NotFoundException` lan ra (spec mục 5: chặn bước, không tự thay agent).
    2. Có run `SPEC` `RUNNING` của ticket thì `ConflictException('Spec agent is already running')`.
    3. Tạo run (`token = randomBytes(24).toString('hex')`, `feedback = previous?.feedback`), `mkdir -p <RUNS_DIR>/<id>`.
    4. **Dùng lại pane:** run `SPEC` mới nhất có `paneId` (mọi status), `agentSlug === specAgent`, và pane đó còn trong `listAgents()` thì `sendPrompt(paneId, prompt)`. Nếu không, tạo pane mới: `createAgent({ agent: profile.provider, cwd: repo.path, args: buildAgentArgs(profile, RUNS_DIR) })`, rồi `sendPrompt`. Nếu pane cũ còn sống mà agent đã đổi, `closeAgent(paneId cũ)` trước.
    5. `createAgent` trả `ready: false`, hoặc bất kỳ bước nào throw: cập nhật run `FAILED` + `error` + `paneId` (nếu có), **không** đóng pane, rồi throw `ConflictException` có kèm pane ID khi `ready: false`, còn lại rethrow.
    6. Thành công: lưu `paneId`, `subscribeAgent(paneId, () => board.emitChanged(projectId))`. Hàm huỷ giữ trong `Map<runId, () => void>`.
  - `AgentRunsService.complete(runId: number, token: string): Promise<void>`. Không có run thì 404. Token sai thì `ForbiddenException` (so bằng `timingSafeEqual`, độ dài khác thì cũng 403). Run không `RUNNING` thì `ConflictException`. Đọc `<RUNS_DIR>/<id>/output.md`: thiếu hoặc chỉ có khoảng trắng thì `BadRequestException('output.md is missing or empty')`, run giữ `RUNNING`. Nếu hợp lệ, trong một `$transaction`: ticket phải đang `IN_SPEC`, không thì run `STOPPED` và trả về. Tạo `SpecVersion` với `version = max + 1`, `content`, `feedback = run.feedback`. Cập nhật ticket `IN_REVIEW_SPEC`, `specApprovedAt null`, run `COMPLETED` + `finishedAt`. Sau đó huỷ subscription và `emitChanged`.
  - `AgentRunsService.liveStatuses(): Promise<Map<string, string>>` trả `paneId → status` từ `listAgents()`; Herdr lỗi thì trả `Map` rỗng (board vẫn tải được).
  - `onModuleInit`: subscribe lại mọi run `RUNNING` có `paneId` (daemon restart mất subscription). Herdr lỗi thì chỉ log.
  - HTTP: `POST /api/v1/agent-runs/:id/complete`, header `x-run-token`, 204.

- [ ] **Step 2: Viết test hỏng** (Prisma, HerdrService, AgentProfilesService, BoardGateway là mock; `RUNS_DIR` = `fs.mkdtemp`; repo path = `os.tmpdir()`)

```ts
it('creates a pane in the ticket repo with profile args', async () => {
  await service.startSpec(10);
  expect(herdr.createAgent).toHaveBeenCalledWith({ agent: 'claude', cwd: repoDir, args: expect.arrayContaining(['--model', 'claude-opus-5-5']) });
  expect(herdr.sendPrompt).toHaveBeenCalledWith('w1:p9', expect.stringContaining('/agent-runs/1/complete'));
  expect(prisma.agentRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paneId: 'w1:p9' }) }));
});
it('reuses a live pane from a failed run', async () => {
  prisma.agentRun.findFirst.mockResolvedValue({ id: 3, paneId: 'w1:p4', agentSlug: 'analyst', status: 'FAILED' });
  herdr.listAgents.mockResolvedValue([{ paneId: 'w1:p4', status: 'idle' }]);
  await service.startSpec(10);
  expect(herdr.createAgent).not.toHaveBeenCalled();
  expect(herdr.sendPrompt).toHaveBeenCalledWith('w1:p4', expect.any(String));
});
it('opens a new pane and closes the old one when the agent changed', async () => { /* run cũ agentSlug 'old' còn sống → closeAgent('w1:p4') rồi createAgent */ });
it('reverts the ticket when the agent cannot start', async () => {
  herdr.createAgent.mockResolvedValue({ paneId: 'w1:p9', ready: false, message: 'trust folder?' });
  await expect(service.startSpec(10)).rejects.toThrow('w1:p9');
  expect(prisma.agentRun.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', paneId: 'w1:p9' }) }));
  expect(herdr.closeAgent).not.toHaveBeenCalled();
});
it('blocks when the agent file is gone', async () => {
  profiles.get.mockRejectedValue(new NotFoundException('Unknown agent: analyst'));
  await expect(service.startSpec(10)).rejects.toBeInstanceOf(NotFoundException);
  expect(herdr.createAgent).not.toHaveBeenCalled();
});
it('rejects bad callbacks', async () => {
  await expect(service.complete(1, 'wrong')).rejects.toBeInstanceOf(ForbiddenException);
  // output.md không tồn tại
  await expect(service.complete(1, 'tok')).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.agentRun.update).not.toHaveBeenCalled();
  // run COMPLETED
  await expect(service.complete(2, 'tok')).rejects.toBeInstanceOf(ConflictException);
});
it('stores a new spec version and moves the ticket to review', async () => {
  // output.md = '# Spec', specVersion max = 1, ticket IN_SPEC
  await service.complete(1, 'tok');
  expect(tx.specVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ticketId: 10, version: 2, content: '# Spec' }) });
  expect(tx.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'IN_REVIEW_SPEC', specApprovedAt: null } }));
  expect(board.emitChanged).toHaveBeenCalledWith(3);
});
```

- [ ] **Step 3: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- agent-runs`
Expected: FAIL

- [ ] **Step 4: Cài đặt service, controller, gateway, env; cập nhật `app.module.spec.ts`** để kiểm tra `AgentRunsModule` export `AgentRunsService` và `BoardGateway`
- [ ] **Step 5: Chạy toàn bộ test và build**

Run: `pnpm --filter daemon test && pnpm --filter daemon build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/daemon/src/modules/agent-runs apps/daemon/src/modules/app.module*.ts apps/daemon/src/configuration apps/daemon/.env.example
git commit -m "Add agent runs with completion callback and board events"
```

---

### Task 5: API ticket — chuyển cột, dialog, spec, nhãn board

**Files:**
- Modify: `apps/daemon/src/modules/tickets/services/tickets.service.ts`, `controllers/tickets.controller.ts`, `tickets.module.ts` (import `AgentRunsModule`, `AgentProfilesModule`)
- Create: `apps/daemon/src/modules/tickets/utils/transitions.ts`, `apps/daemon/src/modules/tickets/utils/board-label.ts`, DTO `move-ticket.dto.ts`, `update-ticket.dto.ts`, `update-spec.dto.ts`, `spec-feedback.dto.ts`
- Test: `tickets.service.spec.ts` (mở rộng), `utils/transitions.spec.ts`, `utils/board-label.spec.ts`

**Interfaces:**
- Consumes: `AgentRunsService.startSpec/liveStatuses`, `BoardGateway.emitChanged` (Task 4), `AgentProfilesService.assertExists`.
- Produces:
  - `assertTransition(from: TicketStatus, to: TicketStatus): void` — bảng cho phép `{ TODO: ['IN_SPEC'] }`; ngoài bảng thì `ConflictException('Cannot move ticket from <from> to <to>')`. Plan 03 mở rộng bảng này.
  - `type BoardLabel = 'running' | 'approved' | 'needs_you' | null`
  - `boardLabel(input: { status: TicketStatus; specApprovedAt: Date | null; run: { status: AgentRunStatus; paneId: string | null; startedAt: Date } | null; paneStatus: string | undefined; now: Date }): BoardLabel` — `run` là run mới nhất của ticket. Luật:
    - run `RUNNING` + `paneStatus` là `working` → `running`.
    - run `RUNNING` + bắt đầu chưa quá 15 giây → `running` (agent chưa kịp sang working).
    - run `RUNNING` với mọi trạng thái pane khác (`idle`, `done`, `blocked`, `unknown`, không còn pane) → `needs_you`.
    - run `FAILED` và ticket đang ở `IN_SPEC` → `needs_you`.
    - `IN_REVIEW_SPEC` + đã approve → `approved`. Còn lại → `null`.
  - `BoardTicket` thêm `label: BoardLabel`, `specVersion: number | null`. `board()` gọi `liveStatuses()` đúng một lần cho cả board.
  - `POST /tickets/:id/move` body `MoveTicketDto { to: TicketStatus }`. Với `TODO → IN_SPEC`: `updateMany({ where: { id, status: 'TODO' }, data: { status: 'IN_SPEC' } })`; `count !== 1` thì 409. Sau đó `startSpec(id)`; lỗi thì đặt lại `TODO` rồi rethrow. Thành công hay lỗi đều `emitChanged`. Trả `BoardTicket`.
  - `GET /tickets/:id` → `TicketDetail = { id, jiraKey, summary, description, jiraUrl, status, projectId, repoId, specAgent, devAgent, testAgent, extraInstructions, extraSkills, specApprovedAt, label, spec: { version, content, editedAt, feedback } | null, repos: { id, name, path }[], projects: { id, name, code }[] (chỉ khi status TODO, cùng workspace), runs: { id, step, agentSlug, status, paneId, error, startedAt, finishedAt }[] (mới nhất trước, tối đa 20) }`.
  - `PATCH /tickets/:id` body `UpdateTicketDto { projectId?; repoId?: number | null; specAgent?: string | null; devAgent?; testAgent?; extraInstructions?: string (≤ 20000); extraSkills?: string[] (≤ 50, mỗi cái `/^[A-Za-z0-9:._-]{1,128}$/`) }`. Các luật:
    - `projectId` chỉ đổi được khi `TODO`, không thì 409. Đổi project thì đặt lại `repoId` và ba agent theo mặc định của project mới.
    - `repoId` phải thuộc project của ticket (400). Đổi repo khi có run `RUNNING` bất kỳ thì 409.
    - Đổi `specAgent` khi có run `SPEC` `RUNNING` thì 409 (Plan 03 áp dụng tương tự cho Dev/Test).
    - Slug lạ thì 400 qua `assertExists`.
    - Trả `TicketDetail` và `emitChanged`.
  - `PUT /tickets/:id/spec` body `{ content: string (1–200000) }`. Chỉ khi `IN_REVIEW_SPEC` có spec (409 nếu không). Ghi đè `content` của phiên bản mới nhất, `editedAt = now`, `specApprovedAt = null` (sửa sau khi duyệt thì phải duyệt lại).
  - `POST /tickets/:id/spec/feedback` body `{ feedback: string (1–20000) }`. Chỉ khi `IN_REVIEW_SPEC`. Chuyển có điều kiện sang `IN_SPEC` như `move`, `specApprovedAt = null`, rồi `startSpec(id, { version, content, feedback })` với spec mới nhất (gồm cả phần sửa tay). Lỗi thì quay về `IN_REVIEW_SPEC`.
  - `POST /tickets/:id/spec/approve` — chỉ khi `IN_REVIEW_SPEC` có spec; đặt `specApprovedAt = now`; ticket không đổi cột.

- [ ] **Step 1: Viết test hỏng**

```ts
it('only allows TODO → IN_SPEC in this plan', () => {
  expect(() => assertTransition('TODO', 'IN_SPEC')).not.toThrow();
  expect(() => assertTransition('IN_REVIEW_SPEC', 'IN_PROGRESS')).toThrow(ConflictException);
  expect(() => assertTransition('IN_SPEC', 'TODO')).toThrow(ConflictException);
});
it('labels idle running agents as needs_you', () => {
  const now = new Date('2026-10-31T10:00:00Z');
  const run = { status: 'RUNNING', paneId: 'w1:p9', startedAt: new Date('2026-10-31T09:59:00Z') } as const;
  expect(boardLabel({ status: 'IN_SPEC', specApprovedAt: null, run, paneStatus: 'working', now })).toBe('running');
  expect(boardLabel({ status: 'IN_SPEC', specApprovedAt: null, run, paneStatus: 'idle', now })).toBe('needs_you');
  expect(boardLabel({ status: 'IN_SPEC', specApprovedAt: null, run, paneStatus: undefined, now })).toBe('needs_you');
  expect(boardLabel({ status: 'IN_SPEC', specApprovedAt: null, run: { ...run, startedAt: new Date('2026-10-31T09:59:50Z') }, paneStatus: 'idle', now })).toBe('running');
  expect(boardLabel({ status: 'IN_REVIEW_SPEC', specApprovedAt: now, run: null, paneStatus: undefined, now })).toBe('approved');
});
it('starts only one spec run for concurrent moves', async () => {
  prisma.ticket.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
  await service.move(10, 'IN_SPEC');
  await expect(service.move(10, 'IN_SPEC')).rejects.toBeInstanceOf(ConflictException);
  expect(agentRuns.startSpec).toHaveBeenCalledTimes(1);
});
it('moves the ticket back to TODO when the spec agent fails to start', async () => {
  agentRuns.startSpec.mockRejectedValue(new BadRequestException('Ticket has no repo'));
  await expect(service.move(10, 'IN_SPEC')).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.ticket.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { status: 'TODO' } });
});
it('sends the edited spec with feedback', async () => {
  // spec mới nhất { version: 2, content: 'edited', editedAt: date }
  await service.feedback(10, 'Split step 3');
  expect(agentRuns.startSpec).toHaveBeenCalledWith(10, { version: 2, content: 'edited', feedback: 'Split step 3' });
});
it('editing an approved spec clears the approval', async () => { /* update data chứa specApprovedAt: null, editedAt: expect.any(Date) */ });
it('locks the repo while an agent runs', async () => { /* agentRun.count → 1; update({ repoId: 6 }) → ConflictException */ });
it('locks the project after TODO', async () => { /* status IN_SPEC; update({ projectId: 4 }) → ConflictException */ });
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- tickets`
Expected: FAIL

- [ ] **Step 3: Cài đặt utils, service, DTO, controller** (`@ApiOkResponse` schema cho `BoardTicket` mới, theo mẫu hiện có)
- [ ] **Step 4: Chạy toàn bộ test và build**

Run: `pnpm --filter daemon test && pnpm --filter daemon build && pnpm --filter daemon check`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/modules/tickets
git commit -m "Add ticket moves, spec review API and board labels"
```

---

### Task 6: Web — kéo thả To Do → In Spec, nhãn card, realtime

**Files:**
- Modify: `apps/web/src/modules/tickets/{ProjectBoard.tsx,BoardColumn.tsx,BoardCard.tsx,hooks.ts,constants.ts,types.ts,index.ts}`, locale `vi`/`en`
- Create: `apps/web/src/modules/tickets/socket.ts`

**Interfaces:**
- Consumes: `POST /tickets/:id/move`, `BoardTicket.label/specVersion` (Task 5), `board-changed` (Task 4).
- Produces:
  - `IBoardTicket` thêm `label: BoardLabel | null`, `specVersion: number | null`; `type BoardLabel = 'running' | 'approved' | 'needs_you'`.
  - `MOVABLE: Partial<Record<TicketStatus, TicketStatus[]>> = { TODO: ['IN_SPEC'] }` trong `constants.ts` — card chỉ kéo được, cột chỉ nhận thả, theo bảng này (khớp `assertTransition` của daemon).
  - `useMoveTicket()` — mutation `{ ticketId, to }`, invalidate `[TICKET_QUERY_KEYS.board]` và `[TICKET_QUERY_KEYS.detail]` cả khi lỗi; lỗi hiện `UIUtils.notify` với message từ daemon (ví dụ "Ticket has no repo").
  - `openBoardEvents(onChanged: (projectId: number) => void): Socket` trong `socket.ts`, dùng cùng `apiBase`/`path` như `openAgentEvents` (`modules/agents/api.ts`), namespace `/board`.
  - `useBoardEvents(projectId: number)` trong `hooks.ts` — mở socket trong `useEffect`, khi `projectId` khớp thì invalidate board + detail, đóng socket khi unmount.
  - `TICKET_QUERY_KEYS.detail = generateQueryKey('ticket-detail')` (Task 7 dùng).
  - `BoardCard` thêm prop `onOpen: (ticketId: number) => void` (Task 7 nối dialog), hiện `TmnBadge` theo nhãn (`running` xanh dương, `approved` xanh lá, `needs_you` cam) và `v<n>` khi có `specVersion`.
- Kéo thả bằng `TmnDnD` theo mẫu `StoreColumn`/`StoreTicketCard`. Khi đang pending thì card hiện loading và không kéo lại được.

- [ ] **Step 1: Cài đặt theo Interfaces, i18n** `ticket.label.running|approved|needs_you`
- [ ] **Step 2: Chạy bộ verify web**

Run: `pnpm --filter web audit:codestyle && pnpm --filter web typecheck && pnpm --filter web exec biome check . && pnpm --filter web build`
Expected: tất cả exit 0

- [ ] **Step 3: Kiểm tra trên trình duyệt (skill `web-browser-testing`)**
  - Kéo một card To Do sang In Spec: thấy nhãn "đang chạy" và pane mới mở trong Herdr đúng thư mục repo.
  - Kéo card To Do sang cột khác thì không thả được.
  - Ticket chưa có repo: thấy thông báo lỗi, card vẫn ở To Do.
  - Mở hai tab: tab kia tự cập nhật khi card đổi cột.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/modules/tickets apps/web/src/i18n
git commit -m "Enable moving tickets into spec with live board updates"
```

---

### Task 7: Web — dialog card (spec, sửa, feedback, approve, cài đặt ticket)

**Files:**
- Create: `apps/web/src/modules/tickets/TicketDialog.tsx`, `SpecPanel.tsx`, `TicketSettingsForm.tsx`, `RunList.tsx`
- Modify: `apps/web/src/modules/tickets/{ProjectBoard.tsx,hooks.ts,types.ts,index.ts}`, locale `vi`/`en`, `apps/web/package.json` + `pnpm-lock.yaml` (`pnpm --filter web add react-markdown`)

**Interfaces:**
- Consumes: `GET/PATCH /tickets/:id`, `PUT /tickets/:id/spec`, `POST /tickets/:id/spec/feedback`, `POST /tickets/:id/spec/approve` (Task 5); `useAgentProfiles` (`#modules/projects`); `onOpen` (Task 6).
- Produces:
  - `ITicketDetail` khớp `TicketDetail` của Task 5.
  - Hooks:
    - `useTicketDetail(ticketId: number | null)` (tắt khi null).
    - `useUpdateTicket()`, `useSaveSpec()`, `useSpecFeedback()`, `useApproveSpec()`: mỗi cái invalidate detail + board sau khi thành công.
  - `TicketDialog` (props `ITicketDialogProps { ticketId: number | null; onClose: () => void }`), dùng popup/dialog của `@truyenmoinhu/uikit` (`TmnPopupProps`) và `TmnTab`. `ProjectBoard` giữ `openTicketId` trong state.
- UI theo mockup A:
  - Header: key, link Jira gốc (mở tab mới), cột hiện tại, nhãn.
  - Tab **Spec**: `react-markdown` (không bật raw HTML) hiện spec mới nhất, kèm `v<n>`, "đã sửa tay" khi có `editedAt`, và "đã duyệt" khi có `specApprovedAt`.
  - Tab **Sửa**: textarea markdown, nút **Lưu chỉnh sửa**.
  - Dưới spec: ô feedback + **Gửi feedback** (disabled khi rỗng), nút **Approve** (ẩn khi đã duyệt). Các hành động này chỉ hiện khi `IN_REVIEW_SPEC`. Khi chưa có spec thì hiện empty state.
  - Tab **Cài đặt**:
    - Select project (chỉ khi `TODO`), select repo, ba select agent lấy từ `useAgentProfiles`.
    - Agent không còn trong danh sách thì hiện "không tìm thấy" bằng `TmnCallout`.
    - Input skills thêm (phân tách bằng dấu phẩy), textarea rules/mô tả thêm, nút Lưu.
    - Select repo và select agent Spec bị disabled khi `runs` có run `RUNNING` (daemon cũng chặn bằng 409).
  - Tab **Agent**: `RunList` (bước, agent, trạng thái, pane ID để mở trong Herdr, lỗi, thời gian).
  - Lỗi 409/400 từ daemon hiện tại chỗ, giữ nguyên dữ liệu đang nhập.

- [ ] **Step 1: Thêm `react-markdown`** (đợi pane khác rảnh `pnpm-lock.yaml`)
- [ ] **Step 2: Cài đặt component, hooks, i18n**
- [ ] **Step 3: Chạy bộ verify web như Task 6** — Expected: tất cả exit 0
- [ ] **Step 4: Kiểm tra end-to-end với agent thật** (skill `web-browser-testing`; tạo trước một file agent Claude trong `~/.the-agents-org/agents/`)
  1. Kéo ticket sang In Spec.
  2. Agent viết spec và gọi callback; card tự sang In Review Spec với nhãn `v1`.
  3. Mở dialog, sửa một dòng ở tab Sửa rồi Lưu.
  4. Gửi feedback: card về In Spec, prompt gửi vào **cùng pane** có dòng đã sửa. Agent viết lại thành `v2`.
  5. Approve: card ở yên In Review Spec với nhãn "đã duyệt".
  6. Đổi repo khi agent đang chạy: bị chặn.
  7. Cho agent hỏi lại giữa chừng: card hiện "cần bạn".
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/tickets apps/web/src/i18n apps/web/package.json pnpm-lock.yaml
git commit -m "Add ticket dialog with spec review"
```
