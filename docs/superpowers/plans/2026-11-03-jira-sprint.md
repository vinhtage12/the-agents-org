# Nguồn spec, ticket tự tạo và Sprint: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project có nguồn spec Local/Jira/Hybrid. Project Local và Hybrid cho tự tạo ticket (trỏ file `.md` hoặc chứa spec gõ tay). Sprint được sync từ Jira hoặc tự tạo. Board lọc được theo sprint và có section Backlog.

**Architecture:**
- Daemon: schema thêm enum và cột cho `Project` và `Ticket`, cùng bảng `Sprint`. Ticket tự tạo nằm ở `TicketsService` (thêm route tạo và sửa). Sprint tự tạo nằm ở module mới `sprints`. Sprint Jira đi qua `JiraClient` (field sprint và Agile API) và `JiraSyncService`. Các quy tắc chọn sprint là hàm thuần trong `jira/utils/sprint-rules.ts`, có unit test.
- Web: không thêm module mới. Form project nằm ở `workspaces/EntityForm`. Thanh sprint, Backlog, dialog tạo ticket và dialog sprint nằm trong module `tickets`. Bộ lọc giữ trên search param `sprint`.

**Tech Stack:** NestJS 11, Prisma 7 + Postgres, Jest; React 19, TanStack Router/Query, `@truyenmoinhu/*`. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-11-03-jira-sprint-design.md`

## Global Constraints

- **Không commit, không push.** Chủ dự án tự commit. Bỏ mọi bước "Commit" của skill.
- Lệnh kiểm tra:
  - Daemon: `pnpm --filter daemon test`, `pnpm --filter daemon build`, `pnpm --filter daemon check`.
  - Web: `rtk pnpm --filter web audit:codestyle`, `rtk proxy pnpm --filter web typecheck`, `rtk pnpm --filter web exec biome check .`, `rtk pnpm --filter web build`.
  - Cuối cùng: `python3 .agents/skills/repo-quality-checks/scripts/check.py`.
- Module daemon mới phải tạo bằng script của skill `daemon-create-module`. Web không có unit test; kiểm UI bằng skill `web-browser-testing`.
- Schema: `pnpm --filter daemon db:migrate:dev --name <snake> --create-only`, sửa SQL nếu cần, rồi `pnpm --filter daemon db:migrate:dev`, rồi `pnpm --filter daemon db:generate`. Không sửa migration đã áp dụng.
- Entity `implements` model Prisma. Enum cần `@ApiProperty({ enum })`.
- Web: chuỗi UI dùng `trans`, thêm key ở cả `apps/web/src/i18n/locales/vi/translation.json` và `en`. Form đi qua `TmnController`. Select dùng `TmnInput.Select` hoặc `TmnSelect` như code xung quanh.
- Giá trị cố định:
  - `SpecSource = LOCAL | JIRA | HYBRID`, mặc định `JIRA`.
  - `TicketSource = JIRA | LOCAL`, mặc định `JIRA`.
  - `SprintSource = JIRA | LOCAL`.
  - `SprintState = FUTURE | ACTIVE | CLOSED`.
- Key ticket tự tạo: `` `${project.code}-L${seq}` ``.
- Tên sprint mặc định: `` `${project.code} Sprint ${n}` ``, với `n` = số sprint LOCAL của project + 1.
- Loại ticket: `Task | Bug | Story`, mặc định `Task`.
- Ticket "chưa xong" là ticket có status khác `DONE` và `CANCELED`.
- Mã lỗi: input sai trả 400. Sai trạng thái hoặc vi phạm quy tắc trả 409. Không tìm thấy trả 404.

## Review Focus

1. **Sync khi đã có ticket LOCAL:** ticket LOCAL không bị recheck, không bị CANCELED, và nội dung không bị ghi đè. Test ở Task 6.
2. **`specFile` thoát khỏi `specDir`** (`../x.md`, đường dẫn tuyệt đối, file không phải `.md`, file không tồn tại): trả 400 và không tạo ticket. Test ở Task 3.
3. **Site Jira không có field sprint** (không cài Jira Software): sync vẫn chạy như cũ, không tạo sprint nào và không lỗi. Test ở Task 5 và Task 6.
4. **Agile API trả 401/403:** sync không lỗi. Nó cảnh báo một lần, và sprint ACTIVE đã quá `endDate` được coi là CLOSED (kể cả việc chuyển ticket LOCAL). Test ở Task 6.
5. **Bắt đầu sprint LOCAL thứ hai khi project đã có một sprint ACTIVE:** trả 409, kể cả khi hai request đến cùng lúc (partial unique index). Test ở Task 7.

---

## Hợp đồng API (dùng chung)

Mọi route dưới `api/v1`.

| Route | Kết quả |
|---|---|
| `POST workspaces/:id/projects`, `PATCH workspaces/:id/projects/:projectId` | body thêm `specSource?`, `specDir?: string \| null`. Trả `Project` |
| `GET workspaces/:id/projects/:projectId/spec-files` | `{ data: { label: string }[] }`, với `label` là đường dẫn tương đối, sắp xếp theo alphabet. Trả 409 nếu project là JIRA |
| `POST projects/:projectId/tickets` | body `{ summary, issueType, specFile?: string, description?: string, sprintId?: number \| null }`. Trả `TicketDetail` |
| `PATCH tickets/:id/local` | body `{ summary?, issueType?, specFile?: string \| null, description? }`. Chỉ cho ticket LOCAL ở TODO. Trả `TicketDetail` |
| `PATCH tickets/:id` | body thêm `sprintId?: number \| null` |
| `GET projects/:projectId/tickets` | mỗi item thêm `source`, `sprintId` |
| `GET tickets/:id` | thêm `source`, `issueType`, `specFile`, `sprintId`, `sprintSource: SprintSource \| null`, `projectSpecSource: SpecSource \| null` |
| `GET projects/:projectId/sprints` | `SprintItem[]` = `{ id, source, name, state, startDate, endDate }`. Gồm sprint LOCAL của project và sprint JIRA có ít nhất một ticket của project. Sắp xếp: ACTIVE, rồi FUTURE, rồi CLOSED; trong mỗi nhóm theo `startDate` rồi `id` |
| `POST projects/:projectId/sprints` | body `{ name?, startDate?, endDate? }`, tạo FUTURE. Trả `SprintItem` |
| `PATCH sprints/:id` | `{ name?, startDate?, endDate? }`. Chỉ cho sprint LOCAL chưa CLOSED |
| `DELETE sprints/:id` | 204. Chỉ cho sprint LOCAL ở FUTURE; ticket trong đó về `sprintId = null` |
| `POST sprints/:id/start` | FUTURE thành ACTIVE. Trả `SprintItem` |
| `POST sprints/:id/complete` | body `{ target: number \| 'new' \| 'backlog' }`. Trả `{ closed: SprintItem; movedTo: SprintItem \| null; moved: number }` |

Mọi thao tác ghi lên sprint và ticket đều gọi `BoardGateway.emitChanged(projectId)`.

---

### Task 1: Schema và migration

**Files:**
- Modify: `apps/daemon/prisma/schema.prisma`
- Create: `apps/daemon/prisma/migrations/<ts>_jira_sprint/migration.sql` (do lệnh tạo)
- Modify: `apps/daemon/src/modules/workspaces/entities/project.entity.ts`, `apps/daemon/src/modules/tickets/entities/ticket.entity.ts`

**Interfaces:**
- Produces:
  - Enum `SpecSource`, `TicketSource`, `SprintSource`, `SprintState`.
  - `Project`: `specSource SpecSource @default(JIRA) @map("spec_source")`, `specDir String? @map("spec_dir") @db.VarChar(1024)`, `localTicketSeq Int @default(0) @map("local_ticket_seq")`, `sprints Sprint[]`.
  - `Ticket`: `source TicketSource @default(JIRA)`, `specFile String? @map("spec_file") @db.VarChar(1024)`, `sprintId Int? @map("sprint_id")`, `sprint Sprint? @relation(onDelete: SetNull)`, `@@index([sprintId])`. Thêm comment trên `jiraKey`: `// Ticket key for any source (Jira key or <CODE>-L<n>).`
  - `model Sprint @@map("sprints")`: `id`, `source SprintSource`, `jiraSprintId Int? @unique @map("jira_sprint_id")`, `jiraBoardId Int? @map("jira_board_id")`, `projectId Int? @map("project_id")` (relation tới Project, `onDelete: Cascade`), `name String @db.VarChar(255)`, `state SprintState @default(FUTURE)`, `startDate DateTime? @map("start_date")`, `endDate DateTime? @map("end_date")`, `completedAt DateTime? @map("completed_at")`, `createdAt`, `tickets Ticket[]`, `@@index([projectId])`.

- [ ] **Step 1:** Sửa schema như trên.
- [ ] **Step 2:** Chạy `pnpm --filter daemon db:migrate:dev --name jira_sprint --create-only`. Thêm vào cuối SQL: `CREATE UNIQUE INDEX "sprints_one_active_local" ON "sprints"("project_id") WHERE "state" = 'ACTIVE' AND "source" = 'LOCAL';`. Thêm comment trong schema trên `model Sprint`, giống cách `RepoBranch` đang làm.
- [ ] **Step 3:** Chạy `pnpm --filter daemon db:migrate:dev`, rồi `pnpm --filter daemon db:generate`.
- [ ] **Step 4:** Thêm field mới vào `ProjectEntity` và `TicketEntity`, có `@ApiProperty({ enum })` cho các enum.
- [ ] **Step 5:** Chạy `pnpm --filter daemon build` và `pnpm --filter daemon test`. Cả hai phải pass, và project cũ có `specSource = JIRA`.

### Task 2: Nguồn spec của project (daemon)

**Files:**
- Modify: `apps/daemon/src/modules/repositories/utils/repo-path.ts`. Đổi chữ ký thành `assertRepoPath(path: string, what = 'Repo path')` để thông báo lỗi dùng `what`.
- Create: `apps/daemon/src/modules/workspaces/dtos/create-project.dto.ts` (`CreateProjectDto extends CreateWorkspaceDto`)
- Modify: `apps/daemon/src/modules/workspaces/dtos/update-project.dto.ts`, `apps/daemon/src/modules/workspaces/controllers/workspaces.controller.ts` (+ spec)
- Modify: `apps/daemon/src/modules/projects/controllers/project-settings.controller.ts` (+ spec). Thêm route `spec-files`.
- Create: `apps/daemon/src/modules/projects/utils/spec-files.ts` (+ `spec-files.spec.ts`)

**Interfaces:**
- Produces:
  - `listSpecFiles(dir: string): Promise<string[]>`: dùng `readdir(dir, { recursive: true })`, lọc `.md`, đổi `\` thành `/`, rồi sắp xếp. Ghi `// shortcut: no ignore list (node_modules/.git), add one if spec dirs grow large`.
  - `normalizeSpecSettings(input: { specSource?: SpecSource; specDir?: string | null }, current?: { specSource: SpecSource; specDir: string | null }): Promise<{ specSource?: SpecSource; specDir?: string | null }>`, đặt trong `workspaces/utils/spec-settings.ts`:
    - Nếu nguồn sau cùng là JIRA thì `specDir = null`.
    - Nếu nguồn sau cùng là LOCAL hoặc HYBRID thì `specDir` sau cùng là bắt buộc, được trim, và phải qua `assertRepoPath(dir, 'Spec directory')`.

- [ ] **Step 1: Test `normalizeSpecSettings`:**
  - `{ specSource: 'LOCAL' }` khi chưa có `specDir` thì 400.
  - `{ specSource: 'HYBRID', specDir: '<tmp dir>' }` trả về đúng dir.
  - `{ specSource: 'JIRA', specDir: '/x' }` trả `specDir: null`.
  - `{ specDir: 'relative' }` khi `current.specSource = 'LOCAL'` thì 400.
  - Test `listSpecFiles` trên thư mục tạm chứa `a.md`, `sub/b.md`, `c.txt` phải ra `['a.md', 'sub/b.md']`.
- [ ] **Step 2:** Chạy `pnpm --filter daemon test -- spec-` và thấy FAIL.
- [ ] **Step 3:** Cài đặt hai hàm. `createProject` dùng `CreateProjectDto` (`@IsOptional() @IsEnum(SpecSource) specSource`, `@ValidateIf(v != null) @IsString() @MaxLength(1024) specDir`). `createProject` và `updateProject` đi qua `normalizeSpecSettings` trước khi ghi.
- [ ] **Step 4:** Thêm `GET spec-files` vào `ProjectSettingsController`: trả 409 `Project does not use local specs` khi JIRA, ngược lại trả `{ data: files.map(label => ({ label })) }`. Thêm test controller cho cả 409 lẫn trường hợp có dữ liệu.
- [ ] **Step 5:** Chạy `pnpm --filter daemon test` và thấy PASS.

### Task 3: Ticket tự tạo (daemon)

**Files:**
- Create: `apps/daemon/src/modules/tickets/utils/spec-file.ts` (+ spec)
- Create: `apps/daemon/src/modules/tickets/dtos/create-local-ticket.dto.ts`, `update-local-ticket.dto.ts`
- Modify: `apps/daemon/src/modules/tickets/services/tickets.service.ts` (+ spec), `controllers/tickets.controller.ts` (+ spec)

**Interfaces:**
- Consumes: các cột ở Task 1. Hàm `assertSprintAssignable` ở Task 7 nhận `sprintId` lúc tạo; trước khi Task 7 xong, Task 3 chỉ nhận `sprintId` null hoặc vắng.
- Produces:
  - `resolveSpecFile(specDir: string, specFile: string): Promise<string>` trả đường dẫn tuyệt đối. Nó ném `BadRequestException` khi: `specFile` là đường dẫn tuyệt đối, không kết thúc bằng `.md`, sau `realpath` nằm ngoài `realpath(specDir)`, hoặc không phải file.
  - `TicketsService.createLocal(projectId: number, input: CreateLocalTicketInput): Promise<TicketDetail>`, với `CreateLocalTicketInput = { summary: string; issueType: string; specFile?: string; description?: string; sprintId?: number | null }`.
  - `TicketsService.updateLocal(id: number, input: Partial<Omit<CreateLocalTicketInput, 'sprintId'>> & { specFile?: string | null }): Promise<TicketDetail>`.
  - DTO: `summary` (1..1024 ký tự), `issueType` thuộc `Task|Bug|Story`, `specFile` (tối đa 1024), `description` (tối đa 100000).

- [ ] **Step 1: Test `resolveSpecFile`** trên thư mục tạm: `a.md` hợp lệ; `../a.md`, `/etc/x.md`, `a.txt`, `missing.md` đều 400; symlink trỏ ra ngoài thư mục cũng 400.
- [ ] **Step 2: Test `createLocal`** (mock prisma theo kiểu đang dùng trong `tickets.service.spec.ts`):
  - Project JIRA thì 409 `Project does not accept local tickets`.
  - Có cả `specFile` lẫn `description`, hoặc không có cái nào (sau khi trim), thì 400 `Provide either a spec file or a spec`.
  - Trường hợp hợp lệ: trong `$transaction`, gọi `project.update({ where: { id }, data: { localTicketSeq: { increment: 1 } } })`, rồi `ticket.create` với `jiraKey: 'FMS-L3'` (khi seq trả 3), `source: 'LOCAL'`, `status: 'TODO'`, `jiraUrl: ''`, `jiraStatus: ''`, `projectId`, `linkedAt`. Agent và repo mặc định chép từ project giống `link()`.
- [ ] **Step 3: Test `updateLocal`:** ticket JIRA thì 409; status khác TODO thì 409; đổi `specFile` thì kiểm tra lại qua `resolveSpecFile`. Sau khi cập nhật, ticket vẫn phải có đúng một trong hai (`specFile` hoặc `description`): đặt `specFile` thì xoá `description` về `''`, đặt `description` thì `specFile = null`.
- [ ] **Step 4: Test `link()`:** link vào project LOCAL thì 409 `Project ${code} only accepts local tickets`.
- [ ] **Step 5:** Chạy `pnpm --filter daemon test -- tickets` và thấy FAIL.
- [ ] **Step 6:** Cài đặt. Thêm route `POST projects/:projectId/tickets` và `PATCH tickets/:id/local` vào `TicketsController`. Thêm `source` và `sprintId` vào `board()`. Thêm các field detail theo hợp đồng API vào `detail()` và `TicketDetail` (`find()` include `project` và `sprint`). Phát sự kiện board sau khi ghi.
- [ ] **Step 7:** Chạy `pnpm --filter daemon test` và thấy PASS.

### Task 4: Prompt BA dùng file spec

**Files:**
- Modify: `apps/daemon/src/modules/agent-runs/utils/spec-prompt.ts`, `prompt-parts.ts` (+ spec nếu có), `services/agent-runs.service.ts` (+ spec)

**Interfaces:**
- Consumes: `resolveSpecFile` (Task 3).
- Produces: `SpecPromptInput.ticket` thêm `specPath: string | null`.
  - `promptHeader` bỏ dòng URL khi `jiraUrl === ''`.
  - Khi `specPath` khác null, `promptHeader` thêm dòng `Spec source file (read it before anything else): ${specPath}` ngay sau phần mô tả.

- [ ] **Step 1: Test `promptHeader`:** khi `jiraUrl: ''` thì kết quả không có dòng rỗng thừa và không có URL. Khi có `specPath: '/s/a.md'` thì kết quả chứa đúng dòng trên.
- [ ] **Step 2: Test `AgentRunsService.start('SPEC')`:** ticket LOCAL có `specFile` nhưng file đã mất thì 400 nêu đường dẫn, và không gọi `agentRun.create`. Ở bước DEV, ticket đó vẫn chạy được (`specPath: null`, không kiểm tra file).
- [ ] **Step 3:** Chạy test và thấy FAIL.
- [ ] **Step 4:** Cài đặt. Trong `start()`, include `project`. Khi `step === 'SPEC'` và `ticket.specFile`, gọi `resolveSpecFile(project.specDir, specFile)` trước khi tạo run. Truyền `specPath` vào object `ticket` mà `build` nhận.
- [ ] **Step 5:** Chạy `pnpm --filter daemon test` và thấy PASS.

### Task 5: JiraClient lấy sprint

**Files:**
- Modify: `apps/daemon/src/modules/jira/clients/jira.client.ts` (+ `jira.client.spec.ts`)

**Interfaces:**
- Produces:
  - `export interface JiraSprint { id: number; name: string; state: 'future' | 'active' | 'closed'; startDate: string | null; endDate: string | null; boardId: number | null }`.
  - `JiraIssue` thêm `sprints: JiraSprint[]`.
  - `JiraClient.sprintFieldId(): Promise<string | null>` gọi `GET field`, tìm field có `schema.custom === 'com.pyxis.greenhopper.jira:gh-sprint'`, và cache kết quả, kể cả `null`.
  - `search` và `getIssue` thêm field đó vào `fields` khi tìm thấy. `toIssue` đọc mảng sprint (`originBoardId` thành `boardId`) và trả `[]` khi thiếu.
  - `JiraClient.getSprint(id: number): Promise<JiraSprint | null>` gọi `GET /rest/agile/1.0/sprint/{id}`, trả `null` khi 404, và ném `JiraHttpError` cho các lỗi khác.
  - `request` nhận thêm tham số tuỳ chọn `api: 'api/3' | 'agile/1.0' = 'api/3'` để dựng `${apiUrl}/rest/${api}/${path}`.

- [ ] **Step 1: Test (mock `fetch` như spec hiện có):**
  - Field sprint được tìm thấy và chỉ fetch `field` một lần qua hai lần `search`.
  - Issue có sprint thì ra `sprints` đúng.
  - Site không có field sprint thì `sprints: []` và `fields` không đổi.
  - `getSprint` 404 thì `null`; 403 thì ném `JiraHttpError` với `jiraStatus` 403.
- [ ] **Step 2:** Chạy `pnpm --filter daemon test -- jira.client` và thấy FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Chạy lại và thấy PASS. Thêm vào `apps/daemon/.env.example`, cạnh biến Jira, comment: `# Sprint sync uses the Agile API; scoped tokens need read:sprint:jira-software`.

### Task 6: Sync Jira với sprint và bảo vệ ticket LOCAL

**Files:**
- Create: `apps/daemon/src/modules/jira/utils/sprint-rules.ts` (+ spec)
- Modify: `apps/daemon/src/modules/jira/services/jira-sync.service.ts` (+ spec), `jira.module.ts` nếu cần thêm `BoardGateway`

**Interfaces:**
- Consumes: `JiraSprint`, `JiraClient.getSprint` (Task 5).
- Produces (hàm thuần):
  - `pickSprint(sprints: JiraSprint[]): JiraSprint | null` chọn ACTIVE; nếu không có thì chọn FUTURE có `startDate` sớm nhất (không có ngày thì theo `id` nhỏ nhất); nếu vẫn không có thì `null`.
  - `nextSprintId(current: { id: number; source: 'JIRA' | 'LOCAL' } | null, picked: number | null): number | null | undefined`: trả `picked` khi `picked !== null`; trả `null` khi `current?.source === 'JIRA'`; còn lại trả `undefined` (giữ nguyên).
  - `effectiveState(s: { state: SprintState; endDate: Date | null }, now: Date): SprintState`: ACTIVE và `endDate < now` thì CLOSED; còn lại giữ nguyên. Chỉ dùng khi Agile API bị từ chối.
  - `rolloverTarget(closed: { jiraBoardId: number | null }, candidates: { id: number; state: SprintState; jiraBoardId: number | null; startDate: Date | null }[]): number | null`: ứng viên là các sprint JIRA chưa CLOSED. Thứ tự ưu tiên: ACTIVE cùng board, FUTURE sớm nhất cùng board, ACTIVE bất kỳ, FUTURE sớm nhất bất kỳ, rồi `null`.

- [ ] **Step 1: Test các hàm thuần** theo đúng từng nhánh mô tả ở trên. Có một ca đủ cả ba loại sprint (active, future, closed) và một ca chỉ có closed thì ra `null`.
- [ ] **Step 2: Test `sync()`:**
  - (a) `prisma.ticket.findMany` của bước recheck được gọi với `where` có `source: 'JIRA'`, và ticket LOCAL không bao giờ bị update.
  - (b) Issue có sprint active `{ id: 7 }` thì `sprint.upsert` theo `jiraSprintId: 7`, và ticket được ghi `sprintId` bằng id DB của sprint đó.
  - (c) Ticket đang ở sprint LOCAL mà issue không có sprint thì `sprintId` không có trong data update.
  - (d) Bước làm mới: `getSprint` trả `state: 'closed'` cho một sprint đang ACTIVE trong DB, thì sprint chuyển CLOSED, và ticket LOCAL chưa xong trong nó chuyển sang `rolloverTarget(...)` qua `ticket.updateMany`. Board được emit cho các project có ticket bị chuyển.
  - (e) `getSprint` ném 403 thì `logger.warn` chỉ gọi một lần qua hai lần sync, và trạng thái dùng `effectiveState`.
  - (f) `sprintFieldId` là `null` thì không gọi `sprint.upsert` hay `getSprint`.
- [ ] **Step 3:** Chạy `pnpm --filter daemon test -- jira` và thấy FAIL.
- [ ] **Step 4:** Cài đặt. Thứ tự trong `sync()`:
  1. Upsert sprint từ mọi issue đã lấy (search và recheck).
  2. Ghi `sprintId` theo `nextSprintId(pickSprint(...))` cùng nội dung của issue.
  3. Làm mới các sprint JIRA chưa CLOSED.
  4. Với sprint vừa chuyển CLOSED, chuyển ticket LOCAL chưa xong trong đó.

  Kết quả `sync()` thêm `sprints: number` (số sprint đã upsert). Cập nhật `ISyncResult` ở web (Task 9).
- [ ] **Step 5:** Chạy `pnpm --filter daemon test` và thấy PASS.

### Task 7: Module sprints (daemon) và gán sprint cho ticket

**Files:**
- Create bằng `daemon-create-module`: `apps/daemon/src/modules/sprints/` (`sprints.module.ts`, `controllers/sprints.controller.ts`, `services/sprints.service.ts`, `entities/sprint.entity.ts`, `dtos/*.dto.ts`, các spec)
- Create: `apps/daemon/src/modules/tickets/utils/sprint-assign.ts` (+ spec)
- Modify: `apps/daemon/src/modules/tickets/dtos/update-ticket.dto.ts`, `services/tickets.service.ts` (+ spec), `app.module.spec.ts` (wiring)

**Interfaces:**
- Produces:
  - `SprintEntity implements Sprint`.
  - `SprintItem = Pick<SprintEntity, 'id' | 'source' | 'name' | 'state' | 'startDate' | 'endDate'>`.
  - `SprintsService`: `list(projectId): Promise<SprintItem[]>`, `create(projectId, input)`, `update(id, input)`, `remove(id)`, `start(id)`, `complete(id, target: number | 'new' | 'backlog')`. Gán sprint không cần export.
  - `assertSprintAssignable(ticket: { source: TicketSource; sprintSource: SprintSource | null }, sprint: { source: SprintSource; state: SprintState; visibleInProject: boolean }, projectSpecSource: SpecSource): void` ném 409 khi:
    - ticket JIRA đang ở sprint JIRA (`Sprint follows Jira`);
    - sprint đã CLOSED;
    - sprint không hiện ở project;
    - sprint JIRA mà ticket không phải LOCAL, hoặc project không phải HYBRID.

    `sprintId: null` (về Backlog) bị chặn với ticket JIRA đang ở sprint JIRA, và được phép với mọi trường hợp khác.

- [ ] **Step 1: Test `assertSprintAssignable`,** mỗi dòng quy tắc ở spec 5.8 là một ca.
- [ ] **Step 2: Test `SprintsService`:**
  - `create` đặt tên mặc định `FMS Sprint 2` khi project đã có 1 sprint LOCAL. Sprint JIRA thì 409 cho `update`, `remove`, `start`, `complete`.
  - `start` khi đã có ACTIVE thì 409 (kiểm tra trước; lỗi `P2002` từ index cũng đổi thành 409).
  - `remove` khi không phải FUTURE thì 409. Khi được xoá, ticket trong sprint về `null`.
  - `complete('new')` tạo sprint FUTURE tên mặc định, rồi chuyển ticket chưa xong (`status: { notIn: ['DONE','CANCELED'] }`) sang đó. `complete('backlog')` đặt `null`. `complete(id)` thì đích phải là sprint LOCAL FUTURE cùng project, sai thì 400. Sprint nguồn có `state: 'CLOSED'` và `completedAt`.
  - `list` trả đúng thứ tự trong hợp đồng API, và chỉ gồm sprint JIRA có ticket thuộc project.
- [ ] **Step 3:** Chạy `pnpm --filter daemon test -- sprint` và thấy FAIL.
- [ ] **Step 4:** Tạo module bằng script của skill `daemon-create-module`, rồi cài đặt service, controller (route theo hợp đồng API) và DTO. `TicketsService.update` và `createLocal` nhận `sprintId`, kiểm tra bằng `assertSprintAssignable`. "Hiện ở project" nghĩa là: với sprint LOCAL, `projectId` khớp; với sprint JIRA, có ít nhất một ticket của project nằm trong đó.
- [ ] **Step 5:** Chạy `pnpm --filter daemon test`, `pnpm --filter daemon build` và `pnpm --filter daemon check`. Cả ba phải PASS.

### Task 8: Form project (web)

**Files:**
- Modify: `apps/web/src/modules/workspaces/components/EntityForm.tsx`, `apps/web/src/modules/workspaces/types.ts`, i18n `vi`/`en`

**Interfaces:**
- Consumes: `POST/PATCH workspaces/:id/projects` (Task 2).
- Produces: `IProject` thêm `specSource: 'LOCAL' | 'JIRA' | 'HYBRID'` và `specDir: string | null`.

- [ ] **Step 1:** Ở `projectMode`, thêm field `specSource` (select 3 option, mặc định `JIRA`). Khi giá trị khác `JIRA`, hiện thêm `specDir` (`TmnInput.TextField`, bắt buộc, helper text "Đường dẫn tuyệt đối, chỉ đọc file .md"). Schema kiểm tra `specDir` bắt buộc khi khác `JIRA`. Gửi `specSource` và `specDir` (JIRA thì `null`). Lỗi 400 từ daemon hiển thị nguyên message trong callout.
- [ ] **Step 2:** Chạy bốn lệnh kiểm tra web và thấy PASS.
- [ ] **Step 3:** Dùng `web-browser-testing`: tạo một project Local với thư mục có thật thì lưu được; nhập đường dẫn tương đối thì thấy lỗi; đổi sang Jira thì ô thư mục biến mất.

### Task 9: Bộ lọc sprint, Backlog và quản lý sprint (web)

**Files:**
- Modify: `apps/web/src/routes/_app/workspaces/$workspaceId/projects/$.ts` (`validateSearch` thêm `sprint?: string`), `apps/web/src/modules/projects/ProjectPage.tsx`
- Modify: `apps/web/src/modules/tickets/{types,constants,hooks,utils,index}.ts`, `components/ProjectBoard.tsx`
- Create (theo `web-create-component`): `components/SprintBar.tsx`, `components/BacklogSection.tsx`, `components/SprintDialog.tsx` (tạo/sửa), `components/CompleteSprintDialog.tsx`, và renderer popup nếu theo mẫu `BranchDialogRenderer`
- i18n `vi`/`en`

**Interfaces:**
- Consumes: route sprints (Task 7), `source` và `sprintId` trên board (Task 3).
- Produces:
  - `ISprint = { id: number; source: 'JIRA' | 'LOCAL'; name: string; state: 'FUTURE' | 'ACTIVE' | 'CLOSED'; startDate: string | null; endDate: string | null }`.
  - Hook `useProjectSprints(projectId)` và `useSprintMutation()` (invalidate cả sprints lẫn board).
  - `filterBoard(tickets: IBoardTicket[], sprints: ISprint[], filter: string | undefined): { columns: IBoardTicket[]; backlog: IBoardTicket[] }` trong `tickets/utils.ts`:
    - `filter` là `undefined`: dùng tập id các sprint ACTIVE; nếu tập rỗng thì xử lý như `'all'`.
    - `'all'`: mọi ticket vào `columns`, `backlog` rỗng.
    - `'<id>'`: chỉ sprint đó.
    - Với các trường hợp không phải `'all'`: `columns` là ticket có `sprintId` thuộc tập; `backlog` là ticket có `sprintId === null`.
  - Socket `board-changed` invalidate thêm query sprints.

- [ ] **Step 1:** Cài đặt `filterBoard` và hook. `ProjectBoard` nhận `sprintFilter` và render `columns` vào các cột hiện có, `backlog` vào `BacklogSection`. Section này thu gọn được, mỗi dòng gồm key và summary, bấm vào thì `openTicketDialog(id)`.
- [ ] **Step 2:** `SprintBar` đặt trên board:
  - Select gồm option "Đang chạy" (giá trị rỗng, mặc định), "Tất cả", các sprint ACTIVE/FUTURE, rồi sprint CLOSED với hậu tố "(đã đóng)", hoặc nhóm option nếu `TmnSelect` hỗ trợ.
  - Đổi select thì `navigate({ search: { sprint } })`.
  - Nút "Tạo sprint" mở `SprintDialog`.
  - Khi sprint đang chọn là LOCAL: hiện "Sửa" và "Xoá" (Xoá chỉ khi FUTURE), "Bắt đầu" (FUTURE), "Hoàn thành" (ACTIVE).
  - `CompleteSprintDialog` có select đích gồm các sprint LOCAL FUTURE, "Sprint mới" và "Backlog". Mặc định là FUTURE sớm nhất, nếu không có thì "Sprint mới".
  - Lỗi từ daemon hiển thị bằng `UIUtils.notify.error` với message.
- [ ] **Step 3:** Cập nhật `ISyncResult` thêm `sprints`, và chuỗi `ticket.synced` hiển thị số sprint.
- [ ] **Step 4:** Chạy bốn lệnh kiểm tra web và thấy PASS.
- [ ] **Step 5:** Dùng `web-browser-testing` cho các trường hợp:
  - Project chưa có sprint thì board hiện như cũ, không có Backlog.
  - Tạo và bắt đầu một sprint thì các cột chỉ còn ticket của sprint đó, và Backlog hiện ticket còn lại.
  - Hoàn thành sprint và chọn "Sprint mới" thì ticket chưa xong nằm ở sprint mới.
  - Reload trang thì bộ lọc vẫn giữ.

### Task 10: Tạo, sửa ticket tự tạo và chọn sprint (web)

**Files:**
- Create (theo `web-create-component`): `apps/web/src/modules/tickets/components/ticket/LocalTicketDialog.tsx` (dùng cho cả tạo lẫn sửa), kèm renderer
- Modify: `components/ticket/TicketSettingsForm.tsx`, `components/ticket/TicketDialog.tsx`, `components/SprintBar.tsx` (nút "Tạo ticket"), `types.ts`, `hooks.ts`, `utils.ts` (`toTicketUpdate` thêm `sprintId`), i18n

**Interfaces:**
- Consumes: `spec-files`, `POST projects/:projectId/tickets`, `PATCH tickets/:id/local`, các field mới trong detail (Task 2, 3, 7).
- Produces: `ITicketDetail` thêm `source`, `issueType`, `specFile`, `sprintId`, `sprintSource`, `projectSpecSource`. Thêm hook `useSpecFiles(workspaceId, projectId)`, `useCreateLocalTicket()`, `useUpdateLocalTicket()`.

- [ ] **Step 1:** Nút "Tạo ticket" chỉ hiện khi `project.specSource !== 'JIRA'`. Dialog gồm:
  - tiêu đề (bắt buộc);
  - loại (Task/Bug/Story);
  - radio hoặc select "File spec" / "Gõ trực tiếp";
  - "File spec": select lấy từ `useSpecFiles`;
  - "Gõ trực tiếp": textarea markdown;
  - sprint (các sprint chưa CLOSED được phép theo spec 5.8, kèm option "Backlog").

  Tạo xong thì mở luôn ticket dialog của ticket mới.
- [ ] **Step 2:** Trong `TicketDialog`, khi `source === 'LOCAL'` và `status === 'TODO'`, hiện nút "Sửa nội dung". Nút này mở `LocalTicketDialog` ở chế độ sửa (không có sprint). Ticket LOCAL hiện thêm file spec, hoặc spec đã gõ, ở chế độ chỉ đọc.
- [ ] **Step 3:** `TicketSettingsForm` thêm select **Sprint**. Option lọc theo spec 5.8 (ticket JIRA thì chỉ sprint LOCAL; ticket LOCAL ở project HYBRID thì cả hai loại; sprint CLOSED bị loại), cộng "Backlog". Khi `source === 'JIRA'` và `sprintSource === 'JIRA'` thì select bị disable, kèm ghi chú "Theo Jira".
- [ ] **Step 4:** Chạy bốn lệnh kiểm tra web và thấy PASS.
- [ ] **Step 5:** Dùng `web-browser-testing`:
  - Tạo ticket từ file thì key có dạng `CODE-L1`. Tạo tiếp ticket gõ tay thì ra `CODE-L2`.
  - Kéo ticket sang Spec thì agent BA nhận prompt có dòng `Spec source file`. Kiểm tra bằng `GET agent-runs/:id/output` hoặc pane Herdr.
  - Xoá file rồi kéo một ticket khác sang Spec thì thấy thông báo lỗi nêu đường dẫn.
  - Ticket Jira có sprint Jira thì select sprint bị disable.

### Task 11: Kiểm tra toàn repo

- [ ] **Step 1:** Chạy `python3 .agents/skills/repo-quality-checks/scripts/check.py` và thấy mọi mục PASS.
- [ ] **Step 2:** Chạy `pnpm --filter daemon test:e2e` (cần Postgres local) và thấy PASS.
- [ ] **Step 3:** Nếu `.env.development` có cấu hình Jira, chạy Sync một lần trên site thật. Ghi lại field sprint có được tìm thấy không, và Agile API trả 200 hay 401/403. Báo kết quả này cho chủ dự án.
