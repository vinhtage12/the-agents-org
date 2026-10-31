# Kanban 03 — Dev ↔ Testing + Canceled: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kéo card đã duyệt spec sang In Progress để agent Dev code và agent Testing viết test case song song. Dev xong thì Testing chạy hết test case, gom lỗi và trả về Dev, tối đa 2 vòng sửa. Hết lỗi thì card sang In Review rồi Done. Ticket bị gỡ assign khi Sync thì agent bị dừng trước, rồi ticket mới sang Canceled.

**Architecture:**
- `AgentRunsService` (Plan 02) được tổng quát cho mọi bước: khởi động run, kiểm callback, dừng run, đóng pane.
- Luồng trạng thái Dev/Testing nằm trong `TicketFlowService` mới, cũng thuộc module `agent-runs`. Service này cũng nhận callback của bước Spec.
- `TicketsService` lo chuyển cột và API của dialog. `JiraSyncService` gọi đóng pane trước khi chuyển ticket sang Canceled.
- Web mở rộng bảng kéo thả, thêm tab Test, form feedback chung, nút dừng agent, tab Terminal và cảnh báo trùng repo.

**Tech Stack:** NestJS 11, Prisma 7 + Postgres, Jest, Socket.IO; React 19, TanStack Query, `@truyenmoinhu/*`. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-10-30-kanban-board-design.md` (Plan trước: `2026-10-30-kanban-01-tickets-foundation.md`, `2026-10-31-kanban-02-agent-run-spec.md`)

### Phạm vi
- **Có:**
  - Spec mục 4.2: các dòng In Progress, In Testing, In Review, Done, Canceled.
  - Spec mục 4.4, 4.5, 4.6c.
  - Spec mục 5: test case/lỗi/kết quả lưu DB và xem trong dialog; agent Testing không sửa code và tắt dev server; feedback ở In Review đặt lại bộ đếm; hai lựa chọn sau vòng sửa thứ 2; đóng pane khi Done/Canceled; cảnh báo trùng repo; terminal trong dialog; khoá đổi agent Dev/Testing khi bước đó đang chạy.
  - Các Minor từ Plan 02 nằm ở code mà plan này chạm vào: callback gọi đồng thời trả 500; `assertExists` kiểm cả agent không đổi; `assertRepoPath` nằm trong file controller.
- **Không:** ghi lên Jira, chạy git (agent cũng được dặn không commit, push hay đổi nhánh). Không thêm thư viện terminal: tab Terminal hiện text đọc qua `agent.read` và có ô gửi câu trả lời.

### Quyết định cho spec mục 6
- **Test case** là kịch bản lưu trong DB (`TestCase`).
  - Agent Testing ghi `output.json` dạng `{"cases":[{"title","steps","expected"}]}` khi viết case.
  - Khi chạy case, nó ghi `{"results":[{"position","passed","detail"}]}`.
  - JSON sai thì callback trả 400, run vẫn `RUNNING` để agent sửa và gọi lại.
- **Công cụ trình duyệt:** dùng công cụ trình duyệt mà agent có sẵn (ví dụ Playwright MCP), khai báo trong `skills` của file agent Testing. App không cài thêm gì.
- **Một bước Testing, hai chế độ:** `AgentRun.testMode` là `WRITE_CASES` hoặc `RUN_CASES`. Cả hai dùng `testAgent` và cùng một pane, giống cách feedback dùng chung pane ở Plan 02.

## Global Constraints

- Giữ mọi Global Constraints của Plan 01 và Plan 02: lệnh test/verify, rules web, 8 trạng thái đúng thứ tự, không ghi Jira, không chạy git, `RUNS_DIR`, URL callback, header `x-agents-org-client` cho mọi request ghi.
- Giới hạn vòng sửa: `MAX_FIX_ROUNDS = 2` (spec 4.4). Feedback ở In Review, hoặc ở In Testing đã dừng, đặt `fixRound = 0` (spec mục 5).
- Agent Testing không sửa code, không để lại file trong repo, tự khởi động dev server và tắt nó sau khi test (spec 4.6c, mục 5). Agent Dev và agent Testing chạy ở hai pane riêng.
- Agent Dev và Testing không được commit, push hay đổi nhánh: chủ dự án tự lo git (spec mục 2).
- Web: không dùng `·` làm dấu phân cách (rule mới trong `apps/web/.agents/rules/web-ui-forms.md`).
- Schema đổi thì phải có migration, chạy `db:generate` và cập nhật entity (`apps/daemon/.agents/rules/daemon-migrations.md`).

## Review Focus

1. **Dev xong trước khi Testing viết xong test case** → card sang In Testing và chờ; case viết xong thì tự chạy, đúng một lần (Task 5: `runs cases once both dev and case writing are done`).
2. **Vòng test thứ 3 vẫn lỗi** → dừng ở In Testing với "cần bạn", không có vòng sửa thứ 3 (Task 5: `stops after two fix rounds`).
3. **Sync hủy ticket khi agent đang chạy** → pane bị đóng trước khi ticket thành Canceled. Callback đến muộn chỉ đánh dấu run `STOPPED`, không đổi cột (Task 7: `stops agents before canceling`; Task 5: `ignores late callbacks for tickets that left the step`).
4. **Agent Testing ghi JSON sai** (thiếu case, trùng position, không phải JSON) → 400, run giữ `RUNNING`, không ghi gì vào DB (Task 3: các test `parseTestCases`/`parseTestResults`; Task 5: `rejects malformed test output`).
5. **Feedback ở In Review** → `fixRound` về 0, Dev nhận feedback trong pane cũ, sau đó chạy lại vòng Testing (Task 6: `review feedback resets fix rounds`).

---

### Task 1: Schema test case, kết quả test, vòng sửa

**Files:**
- Modify: `apps/daemon/prisma/schema.prisma`, `apps/daemon/src/database/tickets-schema.spec.ts`, `apps/daemon/src/modules/tickets/entities/ticket.entity.ts`, `apps/daemon/src/modules/agent-runs/entities/agent-run.entity.ts`
- Create: migration `<timestamp>_dev_testing` (sinh bằng lệnh), `apps/daemon/src/modules/tickets/entities/test-case.entity.ts`, `apps/daemon/src/modules/tickets/entities/test-result.entity.ts`

**Interfaces:**
- Produces:
  - `enum TestMode { WRITE_CASES RUN_CASES }`
  - `AgentRun.testMode TestMode? @map("test_mode")`, thêm relation `results TestResult[]`.
  - `Ticket.fixRound Int @default(0) @map("fix_round")`, thêm relation `testCases TestCase[]`.
  - `TestCase { id Int, ticketId Int, position Int, title String @db.VarChar(512), steps String @db.Text, expected String @db.Text, createdAt DateTime @default(now()) }`, `@@unique([ticketId, position])`, map `test_cases`, ticket `onDelete: Cascade`, relation `results TestResult[]`.
  - `TestResult { id Int, agentRunId Int, testCaseId Int, passed Boolean, detail String @default("") @db.Text }`, `@@unique([agentRunId, testCaseId])`, map `test_results`. Cả hai FK đều `onDelete: Cascade`.

- [ ] **Step 1: Viết test hỏng** — thêm `describe('dev testing schema contract')` vào `tickets-schema.spec.ts`, theo mẫu Plan 02:

```ts
expect(schema).toMatch(/enum TestMode\s*{\s*WRITE_CASES\s+RUN_CASES\s*}/);
expect(schema).toMatch(/fixRound\s+Int\s+@default\(0\)/);
expect(schema).toContain('@@map("test_cases")');
expect(schema).toContain('@@unique([ticketId, position])');
expect(schema).toContain('@@map("test_results")');
expect(schema).toContain('@@unique([agentRunId, testCaseId])');
```

- [ ] **Step 2: Chạy test, xác nhận hỏng** — `pnpm --filter daemon test -- tickets-schema`, Expected: FAIL
- [ ] **Step 3: Sửa schema, sinh migration và client, cập nhật entity**

Run: `pnpm --filter daemon db:migrate:dev --name dev_testing && pnpm --filter daemon db:generate`
Expected: SQL tạo enum `TestMode`, bảng `test_cases`, `test_results`, cột `test_mode` và `fix_round`; không có `DROP`.

- [ ] **Step 4: Test và build** — `pnpm --filter daemon test && pnpm --filter daemon build`, Expected: PASS
- [ ] **Step 5: Commit** — `git add apps/daemon/prisma apps/daemon/src/database apps/daemon/src/modules/*/entities`, message `Add test case, test result and fix round schema`

---

### Task 2: Herdr — đọc output của agent

**Files:**
- Modify: `apps/daemon/src/modules/herdr/services/herdr.service.ts`, `controllers/herdr.controller.ts`
- Test: `services/herdr.service.spec.ts`

**Interfaces:**
- Produces:
  - `HerdrService.readAgent(id: string, lines: number): Promise<string>`. Gọi `getAgent(id)` trước để trả 404 nếu agent không còn. Sau đó gọi `agent.read` với `{ target: id, source: 'recent', lines, strip_ansi: true }`.
  - Kết quả theo `PaneReadResult` của schema Herdr: lấy `text`. Đối chiếu tên khoá bọc ngoài (ví dụ `read`) bằng lệnh `herdr agent read <pane> --lines 5` với pane thật trước khi viết code, rồi ghi tên khoá vào test.
  - Lỗi đi qua `rethrowHerdrError`.
  - HTTP: `GET /api/v1/agents/:id/output?lines=200` → `{ text: string }`. `lines` là số nguyên 1–1000, mặc định 200, validate bằng `ParseIntPipe` + `DefaultValuePipe`; ngoài khoảng thì 400.

- [ ] **Step 1: Viết test hỏng** — `reads recent agent output as text` (agent.list trả pane, agent.read trả text → `'hello'`, kiểm tham số gọi) và `rejects reading an unknown agent` (→ `NotFoundException`, không gọi `agent.read`).
- [ ] **Step 2: Chạy test, xác nhận hỏng** — `pnpm --filter daemon test -- herdr.service`, Expected: FAIL `readAgent is not a function`
- [ ] **Step 3: Cài đặt service và route**
- [ ] **Step 4: Chạy test, xác nhận pass** — cùng lệnh, Expected: PASS
- [ ] **Step 5: Commit** — `Read agent terminal output through Herdr`

---

### Task 3: Prompt Dev/Testing và parser kết quả test (hàm thuần)

**Files:**
- Create: `apps/daemon/src/modules/agent-runs/utils/prompt-parts.ts`, `dev-prompt.ts`, `test-prompts.ts`, `test-output.ts` cùng các file `*.spec.ts` cạnh chúng
- Modify: `apps/daemon/src/modules/agent-runs/utils/spec-prompt.ts` (dùng `prompt-parts`), `apps/daemon/src/modules/agent-runs/utils/constants.ts`

**Interfaces:**
- Consumes: `SpecPromptInput` (Plan 02).
- Produces:
  - `type RunContext = SpecPromptInput['run']` và `type PromptBase = Omit<SpecPromptInput, 'previous'>` trong `prompt-parts.ts`.
  - `promptHeader(input: PromptBase): string[]` — các phần chung, tách nguyên văn từ `buildSpecPrompt`: chỉ dẫn role, `extraInstructions`, dòng `Skills:`, khối ticket, `Repository:`.
  - `outputContract(run: RunContext, file: 'output.md' | 'output.json', what: string): string` — khối hợp đồng của Plan 02, chỉ thay `the full spec as markdown` bằng `what` và `output.md` bằng `file`. **Các test của `spec-prompt.spec.ts` phải pass mà không sửa.**
  - `constants.ts` thêm `MAX_FIX_ROUNDS = 2`.
  - `interface TestFailure { position: number; title: string; detail: string }`
  - `buildDevPrompt(input: PromptBase & { spec: string; failures?: TestFailure[]; feedback?: string }): string`:
    - Không có `failures`/`feedback`: "implement the approved spec".
    - Có `failures`: "fix ALL of these failures in one pass" kèm danh sách `#<position> <title>: <detail>`.
    - Có `feedback`: "address the owner's feedback" kèm nội dung feedback.
    - Luôn có: spec, "Do not commit, push or switch branches.", và `outputContract(run, 'output.md', 'a short summary of what you changed')`.
  - `buildWriteCasesPrompt(input: PromptBase & { spec: string }): string`:
    - Viết kịch bản test bao phủ spec, gồm cả thao tác trên trình duyệt.
    - Không sửa và không tạo file trong repo.
    - Hợp đồng `output.json` với nội dung `{"cases":[{"title":"...","steps":"...","expected":"..."}]}`.
  - `buildRunCasesPrompt(input: PromptBase & { cases: { position: number; title: string; steps: string; expected: string }[] }): string`:
    - Tự khởi động dev server, chạy **tất cả** case kể cả trên trình duyệt, gom mọi lỗi, không sửa code, không để lại file trong repo, tắt dev server khi xong.
    - Hợp đồng `output.json` với nội dung `{"results":[{"position":1,"passed":true,"detail":""}]}`.
  - `parseTestCases(raw: string): { title: string; steps: string; expected: string }[]`. Throw `Error` với message rõ khi: không phải JSON, không có mảng `cases`, có 0 hoặc hơn 100 case, hoặc field không phải chuỗi khác rỗng sau khi trim.
  - `parseTestResults(raw: string, positions: number[]): { position: number; passed: boolean; detail: string }[]`. Mỗi `position` trong `positions` phải xuất hiện đúng một lần. Thiếu, thừa, trùng hoặc `passed` không phải boolean thì throw. `detail` thiếu thì thành `''`.

- [ ] **Step 1: Viết test hỏng**

```ts
it('asks dev to fix every failure in one pass', () => {
  const text = buildDevPrompt({ ...base, spec: '# S', failures: [{ position: 2, title: 'Login', detail: 'button missing' }] });
  expect(text).toContain('#2 Login: button missing');
  expect(text).toContain('Do not commit, push or switch branches.');
  expect(text).toContain(`${base.run.dir}/output.md`);
});
it('tells the testing agent not to touch code and to stop the dev server', () => {
  const text = buildRunCasesPrompt({ ...base, cases: [{ position: 1, title: 'T', steps: 'S', expected: 'E' }] });
  expect(text).toMatch(/do not (modify|change) (any )?code/i);
  expect(text).toMatch(/stop the dev server/i);
  expect(text).toContain(`${base.run.dir}/output.json`);
});
it('parses test cases and rejects malformed ones', () => {
  expect(parseTestCases('{"cases":[{"title":" A ","steps":"s","expected":"e"}]}')).toEqual([{ title: 'A', steps: 's', expected: 'e' }]);
  expect(() => parseTestCases('nope')).toThrow('JSON');
  expect(() => parseTestCases('{"cases":[]}')).toThrow('cases');
  expect(() => parseTestCases('{"cases":[{"title":"","steps":"s","expected":"e"}]}')).toThrow('title');
});
it('requires exactly one result per case', () => {
  expect(parseTestResults('{"results":[{"position":1,"passed":false,"detail":"x"},{"position":2,"passed":true}]}', [1, 2]))
    .toEqual([{ position: 1, passed: false, detail: 'x' }, { position: 2, passed: true, detail: '' }]);
  expect(() => parseTestResults('{"results":[{"position":1,"passed":true}]}', [1, 2])).toThrow('2');
  expect(() => parseTestResults('{"results":[{"position":1,"passed":true},{"position":1,"passed":true}]}', [1])).toThrow('1');
  expect(() => parseTestResults('{"results":[{"position":1,"passed":"yes"}]}', [1])).toThrow('passed');
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng** — `pnpm --filter daemon test -- agent-runs/utils`, Expected: FAIL (module not found)
- [ ] **Step 3: Cài đặt** (tách phần chung khỏi `spec-prompt.ts` mà không đổi chuỗi đầu ra)
- [ ] **Step 4: Chạy test, xác nhận pass** — cùng lệnh, Expected: PASS, kể cả `spec-prompt.spec.ts` không đổi
- [ ] **Step 5: Commit** — `Add dev and testing prompts and test output parsers`

---

### Task 4: `AgentRunsService` cho mọi bước

**Files:**
- Modify: `apps/daemon/src/modules/agent-runs/services/agent-runs.service.ts` và `.spec.ts`
- Create: `apps/daemon/src/modules/projects/utils/repo-path.ts` (chuyển `assertRepoPath` từ controller sang; controller import lại, test hiện có giữ nguyên)

**Interfaces:**
- Consumes: `PromptBase`, `RunContext` (Task 3).
- Produces:
  - `type PromptBuilder = (base: PromptBase) => string`
  - `start(ticketId: number, step: AgentStep, build: PromptBuilder, options?: { feedback?: string; testMode?: TestMode }): Promise<AgentRunEntity>`. Đây là thuật toán `startSpec` của Plan 02, tổng quát theo `step`:
    - Slot agent: `SPEC → specAgent`, `DEV → devAgent`, `TEST → testAgent`. Thiếu agent thì `BadRequestException('Ticket has no <step> agent')`, `<step>` viết thường.
    - Kiểm run `RUNNING` và tìm pane để dùng lại đều lọc theo `ticketId` **và** `step`.
    - Lưu `testMode` vào run.
  - `startSpec(ticketId, previous?)` giữ nguyên chữ ký và hành vi, chỉ gọi `start(..., 'SPEC', base => buildSpecPrompt({ ...base, previous }), { feedback: previous?.feedback })`. Test Plan 02 không đổi.
  - `claim(runId: number, token: string): Promise<{ run: AgentRunEntity; output: string }>`:
    - Giữ đúng các kiểm tra 404/403/409 của `complete` Plan 02.
    - Đọc `output.md` với bước `SPEC`/`DEV`, `output.json` với bước `TEST`. Thiếu hoặc rỗng thì 400.
    - Không đổi trạng thái gì.
  - `finish(tx: Prisma.TransactionClient, runId: number, status: 'COMPLETED' | 'STOPPED'): Promise<void>` — `updateMany({ where: { id: runId, status: 'RUNNING' }, data: { status, finishedAt } })`; `count === 0` thì `ConflictException('Agent run is not running')`. Đây là sửa lỗi Minor callback đồng thời.
  - `afterFinish(runId: number, projectId: number | null): void` — huỷ subscription và `emitChanged`.
  - `stop(ticketId: number, step?: AgentStep): Promise<number>` — tổng quát `stopSpec`. Bỏ `step` thì dừng mọi bước.
  - `closeTicketPanes(ticketId: number): Promise<void>` — `stop(ticketId)`, rồi `closeAgent` từng `paneId` khác nhau của run của ticket. Lỗi đóng pane chỉ log, không throw.
  - Bỏ `complete()`: Task 5 chuyển logic của nó sang `TicketFlowService`. Các test `complete` hiện có chuyển theo sang Task 5.

- [ ] **Step 1: Viết test hỏng**
  - `starts a dev run with the dev agent in its own pane`: `devAgent: 'fe-dev'`; một run `SPEC` còn sống trong cùng repo **không** được dùng lại cho `DEV`.
  - `stores the test mode on the run`.
  - `claim reads output.json for testing runs`.
  - `finish rejects a run that is no longer running` (`updateMany` trả `{ count: 0 }` → `ConflictException`).
  - `closeTicketPanes stops runs and closes each pane once` (hai run cùng pane `w1:p4` và một pane `w1:p5` → `closeAgent` được gọi đúng 2 lần; `closeAgent` throw thì không lan ra).
- [ ] **Step 2: Chạy test, xác nhận hỏng** — `pnpm --filter daemon test -- agent-runs.service`, Expected: FAIL
- [ ] **Step 3: Cài đặt**
- [ ] **Step 4: Chạy toàn bộ test daemon** — `pnpm --filter daemon test`, Expected: PASS. Các test `complete` cũ tạm `skip` kèm comment `moved to ticket-flow (Task 5)`, và Task 5 phải bỏ `skip` hết.
- [ ] **Step 5: Commit** — `Generalize agent runs across spec, dev and testing steps`

---

### Task 5: `TicketFlowService` — vòng Dev ↔ Testing và callback

**Files:**
- Create: `apps/daemon/src/modules/agent-runs/services/ticket-flow.service.ts` và `.spec.ts`
- Modify: `agent-runs.module.ts` (provider + export `TicketFlowService`), `controllers/agent-runs.controller.ts` (callback gọi `TicketFlowService.complete`) và spec của controller

**Interfaces:**
- Consumes: `start`, `claim`, `finish`, `afterFinish` (Task 4); builders và parsers (Task 3); `MAX_FIX_ROUNDS`.
- Produces:
  - `complete(runId: number, token: string): Promise<void>` — gọi `claim`, rồi xử lý theo loại run. Mọi thay đổi trạng thái nằm trong **một** `$transaction` có `finish(tx, ...)`. Ticket không còn ở cột mong đợi thì chỉ `finish(tx, id, 'STOPPED')`.

    | Run | Cột mong đợi | Khi hợp lệ |
    |---|---|---|
    | `SPEC` | `IN_SPEC` | như Plan 02: tạo `SpecVersion` mới, sang `IN_REVIEW_SPEC`, bỏ duyệt |
    | `DEV` | `IN_PROGRESS` | sang `IN_TESTING` |
    | `TEST` `WRITE_CASES` | mọi cột trừ `DONE`/`CANCELED` | `parseTestCases`; thay toàn bộ `TestCase` của ticket bằng `position` 1..n |
    | `TEST` `RUN_CASES` | `IN_TESTING` | `parseTestResults(output, positions)`; tạo `TestResult`; sau đó xem bảng dưới |

    Parser throw thì `BadRequestException(message)` **trước** transaction: run giữ `RUNNING`, không ghi gì.

    `RUN_CASES` sau khi lưu kết quả:
    - Không có lỗi → `IN_REVIEW`.
    - Có lỗi và `fixRound < MAX_FIX_ROUNDS` → `fixRound + 1`, sang `IN_PROGRESS`. Sau transaction thì `startDev(ticketId, { failures })`.
    - Có lỗi và `fixRound >= MAX_FIX_ROUNDS` → giữ `IN_TESTING`; nhãn "cần bạn" do Task 6 tính.

    Sau transaction: `afterFinish`, rồi `maybeRunCases(ticketId)` với `DEV` và `WRITE_CASES`.
  - `startDevelopment(ticketId: number, input: { feedback?: string }): Promise<void>`:
    - Gọi `startDev(ticketId, input)`.
    - Nếu ticket chưa có `TestCase` nào và không có run `TEST` đang chạy, gọi thêm `start(..., 'TEST', buildWriteCasesPrompt, { testMode: 'WRITE_CASES' })`.
    - Lỗi khởi động case không làm hỏng Dev: chỉ log, run tương ứng đã là `FAILED` từ `start`.
  - `startDev(ticketId, input: { feedback?: string; failures?: TestFailure[] })` (private) — spec mới nhất (`content`) cộng `buildDevPrompt`. Dùng chung pane `DEV` qua `start`.
  - `maybeRunCases(ticketId: number): Promise<void>` — khởi động `RUN_CASES` khi **cùng lúc** thoả:
    - ticket ở `IN_TESTING`;
    - không có run `TEST` `RUNNING`;
    - ticket có ít nhất một `TestCase`;
    - run `DEV` `COMPLETED` mới nhất có `id` lớn hơn run `RUN_CASES` mới nhất (hoặc chưa có `RUN_CASES` nào).

    Thiếu điều kiện nào thì không làm gì.

- [ ] **Step 1: Viết test hỏng** (chuyển các test `complete` từ Task 4 sang và bỏ `skip`)
  - `moves to In Testing when dev completes and runs cases if they exist`
  - `runs cases once both dev and case writing are done`: dev xong trước thì chưa có `RUN_CASES`. `WRITE_CASES` xong sau thì `start` được gọi đúng 1 lần với `testMode: 'RUN_CASES'`. Gọi `maybeRunCases` lần nữa thì không tạo thêm.
  - `sends every failure back to dev and counts the round`: `fixRound` 0 → 1, `startDev` nhận cả 2 failure.
  - `stops after two fix rounds`: `fixRound` 2 cộng có lỗi thì ticket ở `IN_TESTING` và không `start` `DEV`.
  - `moves to In Review when every case passes`
  - `rejects malformed test output` → 400, không gọi `$transaction`.
  - `ignores late callbacks for tickets that left the step`: ticket `CANCELED` → run `STOPPED`, không tạo `TestResult`.
  - `starts dev and case writing in parallel the first time`; `does not rewrite cases that already exist`.
- [ ] **Step 2: Chạy test, xác nhận hỏng** — `pnpm --filter daemon test -- ticket-flow`, Expected: FAIL
- [ ] **Step 3: Cài đặt service, nối controller và module**
- [ ] **Step 4: Chạy toàn bộ test và build** — `pnpm --filter daemon test && pnpm --filter daemon build`, Expected: PASS, không còn test `skip`
- [ ] **Step 5: Commit** — `Run the dev and testing loop with a two-round fix limit`

---

### Task 6: API ticket — chuyển cột, feedback, dừng, Done, trùng repo, nhãn

**Files:**
- Modify: `apps/daemon/src/modules/tickets/services/tickets.service.ts`, `controllers/tickets.controller.ts`, `utils/transitions.ts`, `utils/board-label.ts` cùng các spec
- Create: `dtos/feedback.dto.ts` (dùng lại cho `spec/feedback`, thay `spec-feedback.dto.ts`)
- Modify (web, một dòng): `apps/web/src/modules/tickets/hooks.ts`, đổi path của `useStopSpec` từ `/spec/stop` thành `/stop` để nút Dừng không hỏng trước Task 9

**Interfaces:**
- Consumes: `TicketFlowService.startDevelopment`, `AgentRunsService.stop/closeTicketPanes/startSpec/liveStatuses` (Task 4–5).
- Produces:
  - `ALLOWED_MOVES`:

    ```ts
    { TODO: ['IN_SPEC'], IN_REVIEW_SPEC: ['IN_PROGRESS'], IN_TESTING: ['IN_REVIEW'], IN_REVIEW: ['DONE'] }
    ```

  - `move(id, to)` thêm điều kiện chặn:
    - `→ IN_PROGRESS`: cần `specApprovedAt`, không thì 409 `Spec is not approved`. Chuyển có điều kiện sang `IN_PROGRESS` với `fixRound: 0`, rồi `startDevelopment(id, {})`. Lỗi thì quay về `IN_REVIEW_SPEC`.
    - `IN_TESTING → IN_REVIEW`: không có run `RUNNING` nào, không thì 409.
    - `→ DONE`: chuyển có điều kiện, rồi `closeTicketPanes(id)`.
  - `feedback(id, text)`: `POST /tickets/:id/feedback`, body `FeedbackDto { feedback: string (1–20000) }`.
    - Hợp lệ khi `IN_REVIEW`, hoặc khi `IN_TESTING`/`IN_PROGRESS` mà không có run `RUNNING`. Còn lại 409.
    - Chuyển có điều kiện từ cột hiện tại sang `IN_PROGRESS` với `fixRound: 0`, rồi `startDevelopment(id, { feedback })`. Lỗi thì quay về cột cũ.
  - `stop(id)`: `POST /tickets/:id/stop`, thay `spec/stop`.
    - `IN_SPEC`: giữ nguyên hành vi Plan 02.
    - Cột khác: `AgentRunsService.stop(id)`, ticket giữ cột.
    - Không có gì để dừng thì 409.
  - `repoConflicts(id)`: `GET /tickets/:id/repo-conflicts` → `{ tickets: { id: number; jiraKey: string; projectId: number | null }[] }`. Là các ticket **khác** cùng `repoId` có run `RUNNING`. Ticket chưa có repo thì `[]`.
  - `update()`:
    - Khoá `devAgent` khi `DEV` đang chạy, khoá `testAgent` khi `TEST` đang chạy (409).
    - `assertExists` chỉ kiểm các agent **thay đổi** so với giá trị hiện tại (sửa Minor Plan 02).
  - `TicketDetail` thêm:
    - `fixRound`;
    - `testCases: { id; position; title; steps; expected }[]`, sắp theo `position`;
    - `testResults: { agentRunId: number; finishedAt: Date | null; results: { position: number; passed: boolean; detail: string }[] } | null` — lần `RUN_CASES` `COMPLETED` mới nhất;
    - `runs[].testMode`.
  - `boardLabel` đổi đầu vào thành `{ status; specApprovedAt; running: { paneId: string | null; startedAt: Date }[]; lastRun: { status: AgentRunStatus } | null; paneStatuses: Map<string, string>; now: Date }`. Luật theo thứ tự:
    1. Có run đang chạy mà pane `blocked`, hoặc ngoài thời gian ân hạn mà pane không `working` → `needs_you`.
    2. Có run đang chạy → `running`.
    3. `lastRun` là `FAILED` và cột thuộc `IN_SPEC`/`IN_PROGRESS`/`IN_TESTING` → `needs_you`.
    4. `IN_TESTING` mà không có run nào chạy (hết vòng sửa, hoặc thiếu case) → `needs_you`.
    5. `IN_REVIEW_SPEC` đã duyệt → `approved`.
    6. Còn lại → `null`.

    `board()`/`detail()` truyền vào các run `RUNNING` và run mới nhất.

- [ ] **Step 1: Viết test hỏng**
  - `requires an approved spec to start development`
  - `starts development with a fresh fix counter`
  - `review feedback resets fix rounds`: `IN_REVIEW`, `fixRound` 2 → `updateMany` với `{ status: 'IN_PROGRESS', fixRound: 0 }`, `startDevelopment(10, { feedback: 'F' })`.
  - `rejects feedback while an agent is running`
  - `blocks moving to In Review while tests run`
  - `closes panes when the ticket is done`
  - `stop keeps the column outside In Spec`
  - `lists other running tickets on the same repo`
  - `locks the dev agent while dev runs`
  - `only validates changed agents`: devAgent đã gán bị xoá file, nhưng lưu `extraInstructions` vẫn thành công.
  - `boardLabel`: `labels exhausted testing as needs_you`, `prefers running over failed history when a step is running`.
- [ ] **Step 2: Chạy test, xác nhận hỏng** — `pnpm --filter daemon test -- tickets`, Expected: FAIL
- [ ] **Step 3: Cài đặt** (`@ApiOkResponse` cho repo-conflicts; xoá route `spec/stop`)
- [ ] **Step 4: Toàn bộ test, build, check** — `pnpm --filter daemon test && pnpm --filter daemon build && pnpm --filter daemon check`, Expected: PASS
- [ ] **Step 5: Commit** (gồm cả dòng web) — `Add development moves, review feedback, stop and repo conflicts`

---

### Task 7: Sync — dừng agent rồi mới Canceled

**Files:**
- Modify: `apps/daemon/src/modules/jira/services/jira-sync.service.ts` và `.spec.ts`, `jira.module.ts` (import `AgentRunsModule`), `app.module.spec.ts` nếu cần

**Interfaces:**
- Consumes: `AgentRunsService.closeTicketPanes`, `BoardGateway.emitChanged`.
- Produces:
  - Mỗi ticket bị hủy: `closeTicketPanes(ticket.id)` **trước**, sau đó mới `update` status `CANCELED`, rồi `emitChanged(projectId)` nếu có project.
  - Ticket được mở lại (`CANCELED → TODO`) thì đặt `fixRound: 0`; spec, test case và lịch sử giữ nguyên (spec mục 5).

- [ ] **Step 1: Viết test hỏng**
  - `stops agents before canceling`: kiểm thứ tự gọi bằng `mock.invocationCallOrder` của `closeTicketPanes` và `ticket.update`.
  - `reopened tickets restart the fix counter`
- [ ] **Step 2: Chạy test, xác nhận hỏng** — `pnpm --filter daemon test -- jira-sync`, Expected: FAIL
- [ ] **Step 3: Cài đặt**
- [ ] **Step 4: Toàn bộ test** — `pnpm --filter daemon test`, Expected: PASS (bao gồm wiring `app.module.spec.ts`)
- [ ] **Step 5: Commit** — `Stop ticket agents before Jira sync cancels a ticket`

---

### Task 8: Web — kéo thả mới, cảnh báo trùng repo

**Files:**
- Modify: `apps/web/src/modules/tickets/{constants.ts,types.ts,hooks.ts,utils.ts,ProjectBoard.tsx,BoardCard.tsx}`, locale `vi`/`en`

**Interfaces:**
- Consumes: `ALLOWED_MOVES` mới, `GET /tickets/:id/repo-conflicts` (Task 6).
- Produces:
  - `MOVABLE` khớp `ALLOWED_MOVES` của Task 6.
  - `canDrag(ticket: IBoardTicket): boolean` trong `utils.ts`:
    - Có trong `MOVABLE`.
    - `IN_REVIEW_SPEC` chỉ khi `label === 'approved'`.
    - `IN_TESTING` chỉ khi `label !== 'running'`.
  - `useRepoConflicts()` — mutation (gọi khi cần, không cache) trả `IRepoConflict[]`.
  - Trước khi gửi `move` vào `IN_SPEC`/`IN_PROGRESS`: lấy danh sách trùng repo. Có ticket trùng thì mở `UIUtils.alert` liệt kê `jiraKey` các ticket kia, chỉ `move` khi bấm Tiếp tục (spec mục 5: cảnh báo, không chặn).

- [ ] **Step 1: Cài đặt và i18n** (`ticket.repo_conflict_title`, `ticket.repo_conflict_body`, `ticket.continue`)
- [ ] **Step 2: Bộ verify web** — `pnpm --filter web audit:codestyle && pnpm --filter web typecheck && pnpm --filter web exec biome check . && pnpm --filter web build`, Expected: exit 0
- [ ] **Step 3: Trình duyệt** (`web-browser-testing`, web chạy ở cổng 3003)
  - Card In Review Spec chưa duyệt thì không kéo được.
  - Kéo In Review → Done được.
  - Ticket có repo trùng với ticket đang chạy thì hiện cảnh báo.
- [ ] **Step 4: Commit** — `Allow development, review and done moves with repo overlap warning`

---

### Task 9: Web — dialog: Test, feedback, dừng, terminal

**Files:**
- Create: `apps/web/src/modules/tickets/TestPanel.tsx`, `FeedbackForm.tsx` (thay `SpecFeedbackForm.tsx`), `StopAgentsButton.tsx` (thay `SpecStopButton.tsx`), `AgentTerminal.tsx`
- Modify: `TicketDialog.tsx`, `SpecPanel.tsx`, `RunList.tsx`, `hooks.ts`, `types.ts`, `index.ts`, locale `vi`/`en`

**Interfaces:**
- Consumes: `TicketDetail` mới, `POST /tickets/:id/feedback`, `POST /tickets/:id/stop`, `GET /agents/:id/output`, `POST /agents/:id/prompts` (có từ trước).
- Produces:
  - `ITicketDetail` thêm `fixRound`, `testCases`, `testResults`; `IAgentRun.testMode`.
  - Hooks:
    - `useDevFeedback()`, `useStopAgents()` (thay `useStopSpec`).
    - `useAgentOutput(paneId: string | null)`: `refetchInterval: 2000`, tắt khi `null`.
    - `useReplyAgent()`: POST prompt, lấy `apiManager` từ context.
  - `FeedbackForm` (props `{ ticketId: number; target: 'spec' | 'dev'; disabled: boolean }`): `spec` dùng `useSpecFeedback`, `dev` dùng `useDevFeedback`.
  - `TestPanel` (props `{ ticket: ITicketDetail }`):
    - Danh sách case (position, title, steps, expected).
    - Kết quả mới nhất: đạt/lỗi kèm `detail`.
    - Vòng sửa `fixRound / 2`.
    - Ở `IN_TESTING` mà không có run nào chạy: callout "Đã hết 2 vòng sửa" với hai lựa chọn của spec mục 5: `FeedbackForm target="dev"`, hoặc kéo thẳng sang In Review.
  - `FeedbackForm target="dev"` cũng hiện ở `IN_REVIEW` (spec 4.5).
  - `StopAgentsButton` hiện khi `runs` có run `RUNNING` hoặc ticket ở `IN_SPEC`.
  - `AgentTerminal` (props `{ runs: IAgentRun[] }`):
    - Chọn một trong các pane của run `RUNNING`, mặc định run mới nhất.
    - `<pre>` cuộn, hiện text từ `useAgentOutput`.
    - Ô trả lời gửi qua `useReplyAgent`; lỗi 409 (agent đang ở hộp hỏi quyền) hiện tại chỗ.
    - Không có run đang chạy thì hiện empty state.
  - Tab mới trong `TicketDialog`: `Test` và `Terminal`. Tab Terminal chỉ mount khi đang chọn, để không gọi output khi đóng.

- [ ] **Step 1: Cài đặt và i18n** (không dùng `·` theo rule mới)
- [ ] **Step 2: Bộ verify web như Task 8** — Expected: exit 0
- [ ] **Step 3: Trình duyệt**
  - Tab Test và Terminal hiện empty state đúng.
  - Nút Dừng hiện khi có run đang chạy.
  - Form feedback dev hiện ở In Review.
- [ ] **Step 4: End-to-end với agent thật** (bao gồm cả bước còn nợ của Plan 02)
  1. In Spec → In Review Spec → Approve.
  2. Kéo sang In Progress: hai pane Dev và Testing mở cùng lúc.
  3. Dev xong thì card sang In Testing; Testing chạy case.
  4. Cho một case lỗi: card về In Progress với `fixRound` 1.
  5. Pass hết: card sang In Review.
  6. Gửi feedback: `fixRound` về 0.
  7. Kéo sang Done: các pane đóng.
  8. Gỡ assign trên Jira rồi Sync: agent dừng, ticket sang Canceled.
- [ ] **Step 5: Commit** — `Add tests, dev feedback, stop and terminal to the ticket dialog`
