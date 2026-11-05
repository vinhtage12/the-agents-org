# Scheduled tasks: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Người dùng tạo các task chạy theo lịch (giờ + ngày trong tuần). Đến giờ, daemon mở một coding agent qua Herdr để chạy prompt trên các repo đã chọn và ghi file `.md` vào thư mục chỉ định. Lần chạy bị lỡ hoặc bị lỗi được báo bằng badge và toast, có nút Chạy lại / Bỏ qua.

**Architecture:**
- Daemon: module mới `scheduled-tasks` gồm 3 service.
  - `ScheduledTasksService`: CRUD.
  - `ScheduledRunnerService`: chạy một lần, nhận callback, dừng, chạy lại, bỏ qua, xử lý timeout và đối soát lại khi khởi động.
  - `SchedulerService`: tick `setInterval` 30 giây.
- Phần tính lịch, đặt tên file và dựng prompt là hàm thuần trong `utils/`, có unit test. Dùng lại `HerdrService`, `AgentProfilesService`, `assertRepoPath`, cùng `buildAgentArgs` và phần đầu prompt của `agent-runs` (sửa nhỏ cho dùng chung).
- Web: module mới `scheduled-tasks` gồm trang danh sách, khung "cần xử lý", dialog form, dialog lịch sử. Badge trên menu do `Layout` gắn vào. Toast nằm trong `Dashboard`. Dữ liệu cập nhật bằng polling 30 giây; không dùng socket, đây là lựa chọn spec cho phép.

**Tech Stack:** NestJS 11, Prisma 7 + Postgres, Jest; React 19, TanStack Router/Query, `@truyenmoinhu/*`. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-11-04-scheduled-tasks-design.md`

## Global Constraints

- **Không commit, không push.** Chủ dự án tự commit. Bỏ mọi bước "Commit".
- Lệnh kiểm tra:
  - Daemon: `pnpm --filter daemon test`, `pnpm --filter daemon build`, `pnpm --filter daemon check`.
  - Web: `rtk pnpm --filter web audit:codestyle`, `rtk proxy pnpm --filter web typecheck`, `rtk pnpm --filter web exec biome check .`, `rtk pnpm --filter web build`.
  - Cuối cùng: `python3 .agents/skills/repo-quality-checks/scripts/check.py`. Lỗi audit có sẵn từ trước ở `src/modules/system/MachineStatus.tsx` không thuộc phạm vi plan này.
- Tạo module daemon bằng `python3 .agents/skills/daemon-create-module/scripts/create_module.py scheduled-tasks`. Tạo module web bằng `python3 .agents/skills/web-create-module/scripts/create_module.py scheduled-tasks` (chạy từ `apps/web`).
- Schema: `pnpm --filter daemon db:migrate:dev --name <snake> --create-only`, thêm SQL partial index, rồi `pnpm --filter daemon db:migrate:dev`, rồi `pnpm --filter daemon db:generate`.
- Entity `implements` model Prisma. Enum cần `@ApiProperty({ enum })`.
- Enum đặt trong `<module>/enum.ts`, hằng số trong `<module>/constants.ts`. Không viết cứng các giá trị dưới đây ở nơi khác.
- Giá trị cố định (lấy từ spec):
  - `TICK_MS = 30_000`
  - `GRACE_MS = 2 * 60_000`
  - `MISSED_LOOKBACK_DAYS = 7`
  - `MAX_RUN_MS = 30 * 60_000`
  - `ATTENTION_REFETCH_MS = 30_000` (web)
- `time`: phút trong ngày, 0 đến 1439. `days`: `Int[]` chứa các giá trị 0 đến 6 theo `Date.getDay()` (0 = CN), không rỗng, không trùng. Giờ tính theo **giờ local của máy**.
- Tên file output: `` `${YYYY-MM-DD theo giờ local của scheduledFor}-${slug}.md` ``.
- "Cần xử lý" = `status IN (MISSED, FAILED)` và `dismissedAt IS NULL` và chưa có run nào có `rerunOfId` trỏ về nó.
- Mã lỗi: input sai trả 400. Trùng slug, task đang chạy, đã chạy lại rồi, hoặc đang được dùng: trả 409. Không tìm thấy trả 404. Token sai trả 403.
- Web: chuỗi UI dùng `trans`, thêm key ở cả `vi` và `en`. Field form đi qua `TmnController`. Không dùng `·` làm dấu phân cách (xem `web-ui-forms.md`). Ngày giờ hiển thị bằng `formatDate` từ `#utils/date`.

## Review Focus

1. **Daemon khởi động lại trong vòng 2 phút sau khi đã chạy một lần hẹn.** Lần hẹn đó không được chạy lần hai, nhờ partial unique index cộng với P2002 được bỏ qua. Test ở Task 6.
2. **Sửa lịch lúc 09:01 thành "09:00 mỗi ngày".** Không sinh MISSED cho 09:00 hôm nay, vì `checkedUntil` được reset. Test ở Task 4.
3. **Repo bị xoá hoặc đổi chỗ trên đĩa sau khi tạo task.** Run thành `FAILED` kèm lỗi dễ đọc và được tính vào "cần xử lý". Test ở Task 5.
4. **Agent ghi file nhưng không bao giờ gọi curl, hoặc file còn sót lại từ hôm trước.** Lần đầu tiên tick sau mốc 30 phút thì run thành FAILED ("timed out"). Callback mà file có `mtime < startedAt` thì FAILED. Test ở Task 5.
5. **`outputDir` có `~` hoặc chưa tồn tại.** `~` được expand lúc lưu, thư mục được `mkdir -p` lúc chạy. Không tạo được thư mục thì FAILED. Test ở Task 4 và Task 5.

---

### Task 1: Schema, module khung, chặn xoá agent/repo

**Files:**
- Modify: `apps/daemon/prisma/schema.prisma` (thêm models/enums; thêm quan hệ ngược ở `Agent`, `Repo`)
- Create: migration `scheduled_tasks` (qua lệnh migrate)
- Create (qua script): `apps/daemon/src/modules/scheduled-tasks/**`
- Create: `scheduled-tasks/enum.ts`, `scheduled-tasks/constants.ts`, `entities/scheduled-task.entity.ts`, `entities/scheduled-run.entity.ts`
- Modify: `apps/daemon/src/modules/agent-profiles/services/agent-profiles.service.ts` (`remove`), `apps/daemon/src/modules/repositories/services/repositories.service.ts` (`remove`) và spec của hai file

**Interfaces:**
- Produces: các model Prisma `ScheduledTask`, `ScheduledTaskRepo`, `ScheduledRun`; enum `ScheduledRunStatus`, `ScheduledRunTrigger` (re-export trong `enum.ts`); hằng số ở Global Constraints, export từ `constants.ts`.

- [ ] **Step 1: Thêm vào schema**

```prisma
enum ScheduledRunStatus { RUNNING COMPLETED FAILED STOPPED MISSED SKIPPED }
enum ScheduledRunTrigger { SCHEDULE MANUAL RERUN }

model ScheduledTask {
  id Int @id @default(autoincrement())
  name String @unique @db.VarChar(128)
  slug String @unique @db.VarChar(128)
  prompt String @db.Text
  enabled Boolean @default(true)
  time Int
  days Int[]
  agentId Int @map("agent_id")
  agent Agent @relation(fields: [agentId], references: [id], onDelete: Restrict)
  repos ScheduledTaskRepo[]
  outputDir String @map("output_dir") @db.VarChar(1024)
  checkedUntil DateTime @default(now()) @map("checked_until")
  runs ScheduledRun[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("scheduled_tasks")
}

model ScheduledTaskRepo {
  taskId Int @map("task_id")
  repoId Int @map("repo_id")
  position Int
  task ScheduledTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  repo Repo @relation(fields: [repoId], references: [id], onDelete: Restrict)
  @@id([taskId, repoId])
  @@unique([taskId, position])
  @@map("scheduled_task_repos")
}

model ScheduledRun {
  id Int @id @default(autoincrement())
  taskId Int @map("task_id")
  task ScheduledTask @relation(fields: [taskId], references: [id], onDelete: Cascade)
  scheduledFor DateTime @map("scheduled_for")
  trigger ScheduledRunTrigger
  status ScheduledRunStatus
  rerunOfId Int? @unique @map("rerun_of_id")
  rerunOf ScheduledRun? @relation("ScheduledRerun", fields: [rerunOfId], references: [id], onDelete: SetNull)
  rerun ScheduledRun? @relation("ScheduledRerun")
  dismissedAt DateTime? @map("dismissed_at")
  agentId Int? @map("agent_id")
  agent Agent? @relation("ScheduledRunAgent", fields: [agentId], references: [id], onDelete: SetNull)
  agentName String @map("agent_name") @db.VarChar(128)
  paneId String? @map("pane_id") @db.VarChar(128)
  token String @db.VarChar(64)
  outputPath String? @map("output_path") @db.VarChar(1024)
  output String? @db.Text
  error String? @db.Text
  startedAt DateTime? @map("started_at")
  finishedAt DateTime? @map("finished_at")
  createdAt DateTime @default(now()) @map("created_at")
  @@index([taskId, scheduledFor])
  @@map("scheduled_runs")
}
```

Thêm `scheduledTasks ScheduledTask[]` và `scheduledRuns ScheduledRun[] @relation("ScheduledRunAgent")` vào `Agent`, và `scheduledTasks ScheduledTaskRepo[]` vào `Repo`.

- [ ] **Step 2: Tạo migration với `--create-only`, rồi thêm vào cuối file SQL**

```sql
CREATE UNIQUE INDEX "scheduled_runs_one_per_occurrence" ON "scheduled_runs"("task_id", "scheduled_for") WHERE "trigger" = 'SCHEDULE';
CREATE UNIQUE INDEX "scheduled_runs_one_running_per_task" ON "scheduled_runs"("task_id") WHERE "status" = 'RUNNING';
```

Áp dụng migration và chạy `db:generate`. Dòng comment trên `ScheduledRun` trong schema ghi tên migration chứa hai index này, giống comment đang có trên `AgentRun`.

- [ ] **Step 3: Chạy script `daemon-create-module scheduled-tasks`**, rồi viết `enum.ts`, `constants.ts` và hai entity (`implements` model, `token` không được trả qua API).

- [ ] **Step 4: Viết test thất bại** trong `agent-profiles.service.spec.ts` và `repositories.service.spec.ts`: `remove rejects an agent used by a scheduled task` và `remove rejects a repo used by a scheduled task`. Mock `prisma.scheduledTask.count` / `prisma.scheduledTaskRepo.count` trả về 1, mong đợi `ConflictException`, và `delete` không được gọi.

- [ ] **Step 5: Sửa `remove`** để đếm thêm `scheduledTask.count({ where: { agentId: id } })` và `scheduledTaskRepo.count({ where: { repoId: id } })`. Thông báo lỗi lần lượt là `'Agent is in use by projects, open tickets or scheduled tasks'` và `'Repo is in use by projects, open tickets or scheduled tasks'`.

- [ ] **Step 6: Chạy** `pnpm --filter daemon test && pnpm --filter daemon build`. Kỳ vọng PASS. Sửa các spec cũ nào assert đúng chuỗi lỗi cũ.

---

### Task 2: Tính lịch và tên file (hàm thuần)

**Files:**
- Create: `scheduled-tasks/utils/schedule.ts`, `scheduled-tasks/utils/schedule.spec.ts`
- Create: `scheduled-tasks/utils/output-file.ts`, `scheduled-tasks/utils/output-file.spec.ts`

**Interfaces:**
- Produces:
  - `type Schedule = { time: number; days: number[] }`
  - `occurrencesBetween(schedule: Schedule, from: Date, to: Date): Date[]`: các lần hẹn `t` thoả `from < t ≤ to`, tăng dần, tính theo giờ local.
  - `nextOccurrence(schedule: Schedule, after: Date): Date`: lần hẹn đầu tiên sau `after`, tìm trong 8 ngày tới.
  - `slugify(name: string): string`: bỏ dấu tiếng Việt (NFD, xoá dấu, `đ`→`d`), chuyển chữ thường, chuỗi ký tự không phải `[a-z0-9]` thành `-`, bỏ `-` ở hai đầu. Kết quả rỗng thì `'task'`.
  - `outputFileName(slug: string, scheduledFor: Date): string`
  - `expandHome(path: string): string`: `~` hoặc `~/...` → `os.homedir()`.

- [ ] **Step 1: Viết test thất bại**, dùng `new Date(y, m, d, h, mi)` (giờ local):
  - `occurrencesBetween({time:510, days:[1,3,5]}, Mon 2026-11-02 08:00, Fri 2026-11-06 09:00)` → [Mon 08:30, Wed 08:30, Fri 08:30]
  - biên: `from` đúng bằng Mon 08:30 thì không có Mon. `to` đúng bằng Fri 08:30 thì có Fri.
  - qua nửa đêm: `{time:1080, days:[6]}` từ Sat 2026-11-07 17:00 đến Sun 2026-11-08 01:00 → [Sat 18:00]
  - `from >= to` → `[]`
  - `nextOccurrence({time:570, days:[0,1,2,3,4,5,6]}, Mon 09:30)` → Tue 09:30. Với `after` = Mon 09:29 → Mon 09:30.
  - `slugify('Báo cáo EOD + Stand-up')` → `'bao-cao-eod-stand-up'`. `slugify('  Đi   ')` → `'di'`. `slugify('!!!')` → `'task'`.
  - `outputFileName('eod', new Date(2026,10,2,8,30))` → `'2026-11-02-eod.md'`
  - `expandHome('~/Reports')` → `` `${homedir()}/Reports` ``. `expandHome('/abs')` → `'/abs'`.

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- scheduled-tasks/utils`. Kỳ vọng FAIL (module not found).

- [ ] **Step 3: Implement.** Duyệt từng ngày local từ ngày của `from` đến ngày của `to`, dựng `new Date(y, m, d, 0, time)`, lọc theo `days` và theo khoảng.

- [ ] **Step 4: Chạy lại**. Kỳ vọng PASS.

---

### Task 3: Tham số agent nhiều thư mục và prompt theo lịch

**Files:**
- Modify: `apps/daemon/src/modules/agent-runs/utils/agent-args.ts` + `agent-args.spec.ts`
- Modify: `apps/daemon/src/modules/agent-runs/utils/prompt-parts.ts` + `prompt-parts.spec.ts`
- Create: `scheduled-tasks/utils/scheduled-prompt.ts` + `scheduled-prompt.spec.ts`

**Interfaces:**
- Produces:
  - `buildAgentArgs(agent: RunAgent, ...dirs: string[]): string[]`: mỗi thư mục được thêm qua `flags.dir(d)`. Các caller cũ truyền một thư mục, nên không phải sửa. Với codex, cờ `-c sandbox_workspace_write.network_access=true` chỉ xuất hiện một lần.
  - `profileHeader(profile: RunAgent): string[]` trong `prompt-parts.ts`: dòng AGENT.md, rules của profile, skills của profile. `promptHeader` gọi lại hàm này cho phần profile, và output của nó không đổi (test cũ vẫn phải pass).
  - `buildScheduledPrompt(input: ScheduledPromptInput): string` với
    `ScheduledPromptInput = { profile: RunAgent; prompt: string; scheduledFor: Date; repoPaths: string[]; outputFile: string; run: { id: number; token: string; callbackUrl: string } }`

- [ ] **Step 1: Viết test thất bại**
  - `buildAgentArgs(claudeAgent, '/runs', '/r2', '/out')` chứa `['--add-dir','/runs','--add-dir','/r2','--add-dir','/out']`. Với codex: có ba `--add-dir` và đúng **một** cụm `-c sandbox_workspace_write.network_access=true`.
  - `profileHeader(base.profile)` → 3 dòng (AGENT.md, rules, skills). Test `promptHeader` cũ vẫn bằng y nguyên.
  - `buildScheduledPrompt` (scheduledFor = `new Date(2026,10,2,8,30)`, repoPaths `['/a','/b']`, outputFile `/out/2026-11-02-eod.md`, run id 5):
    - chứa `'Scheduled for: 2026-11-02 08:30 (Monday), local time.'`
    - chứa `"Treat this date as 'today' for any relative dates (yesterday, today, this week) in the task, even if the current time is later."`
    - chứa `'Repositories (primary first):\n- /a\n- /b'`
    - prompt của người dùng xuất hiện nguyên văn, nằm sau khối repo
    - kết thúc bằng hợp đồng: `Write the result as markdown to /out/2026-11-02-eod.md (overwrite it).` và `curl -fsS -X POST -H 'x-run-token: <token>' <callbackUrl>/scheduled-runs/5/complete`, cùng câu "Do not run the command before the file is complete…" giống `outputContract`.

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- agent-args prompt-parts scheduled-prompt`. Kỳ vọng FAIL.

- [ ] **Step 3: Implement** ba hàm. Với codex, tách cờ network ra khỏi `dir` để thêm đúng một lần khi có ít nhất một thư mục.

- [ ] **Step 4: Chạy lại toàn bộ** `pnpm --filter daemon test`. Kỳ vọng PASS.

---

### Task 4: CRUD scheduled task

**Files:**
- Create: `scheduled-tasks/dtos/save-scheduled-task.dto.ts`, `scheduled-tasks/dtos/update-scheduled-task.dto.ts`
- Modify: `scheduled-tasks/services/scheduled-tasks.service.ts` + spec, `scheduled-tasks/controllers/scheduled-tasks.controller.ts` + spec, `scheduled-tasks.module.ts` (imports `AgentProfilesModule`)

**Interfaces:**
- Consumes: `slugify`, `expandHome`, `nextOccurrence` (Task 2); `AgentProfilesService.get`; `assertRepoPath`.
- Produces:
  - `SaveScheduledTaskDto { name: string (1–128, trim); time: int 0–1439; days: int[] (1–7 phần tử, mỗi phần tử 0–6, unique); agentId: int; repoIds: int[] (≥1, unique, theo thứ tự); outputDir: string (1–1024); prompt: string (≥1); enabled?: boolean }`
  - `UpdateScheduledTaskDto = PartialType(SaveScheduledTaskDto)`
  - `ScheduledTasksService`:
    - `list(): Promise<ScheduledTaskView[]>`
    - `get(id)`
    - `create(dto)`
    - `update(id, dto)`
    - `remove(id)`
    - `ScheduledTaskView` = các field của task + `agent: {id,name}` + `repos: {id,name,path}[]` (theo position) + `lastRun: {id,status,scheduledFor,finishedAt} | null` + `nextRunAt: Date | null` (null khi task tắt)
  - Routes: `GET/POST /scheduled-tasks`, `GET/PATCH/DELETE /scheduled-tasks/:id`

- [ ] **Step 1: Viết test thất bại** cho service (mock Prisma):
  - `create` lưu `slug = slugify(name)`, `outputDir = expandHome(...)`, ghi repo với `position` theo thứ tự `repoIds`, và `checkedUntil` = now.
  - `create` với slug đã có ở task khác (P2002 trên slug hoặc name) → `ConflictException('A task with this name already exists')`.
  - `create` với agent không tồn tại → 404 (từ `AgentProfilesService.get`). Repo id không tồn tại → `BadRequestException`.
  - `update` đổi `time`, `days` hoặc `enabled` từ false sang true → set `checkedUntil = now`. Chỉ đổi `prompt` → không đụng `checkedUntil`. **(Review Focus 2)**
  - `update` đổi `repoIds` → xoá rồi tạo lại `ScheduledTaskRepo` trong cùng `$transaction`.
  - `remove` khi task có run `RUNNING` → `ConflictException`.
  - `list` tính `nextRunAt` bằng `nextOccurrence`, và trả null khi `enabled = false`.

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- scheduled-tasks.service`. Kỳ vọng FAIL.

- [ ] **Step 3: Implement** service, controller và DTO. Không kiểm tra `outputDir` lúc lưu ngoài việc là đường dẫn tuyệt đối sau `expandHome`; không phải tuyệt đối thì trả 400. Thư mục được tạo lúc chạy.

- [ ] **Step 4: Chạy** `pnpm --filter daemon test && pnpm --filter daemon build`. Kỳ vọng PASS.

---

### Task 5: Runner (chạy, callback, dừng, chạy lại, bỏ qua, timeout, đối soát)

**Files:**
- Create: `scheduled-tasks/services/scheduled-runner.service.ts` + spec
- Create: `scheduled-tasks/controllers/scheduled-runs.controller.ts` + spec
- Modify: `scheduled-tasks/controllers/scheduled-tasks.controller.ts` (thêm `POST :id/run`, `GET :id/runs`), `scheduled-tasks.module.ts` (imports `HerdrModule`)

**Interfaces:**
- Consumes: `buildAgentArgs`, `buildScheduledPrompt` (Task 3); `outputFileName`, `expandHome` (Task 2); `HerdrService.createAgent/sendPrompt/closeAgent/listAgents`; `AgentProfilesService.get`; `assertRepoPath`.
- Produces (`ScheduledRunnerService`):
  - `start(taskId: number, trigger: ScheduledRunTrigger, scheduledFor: Date, rerunOfId?: number): Promise<ScheduledRunView>`
  - `recordMissed(taskId: number, scheduledFor: Date): Promise<void>`: insert `MISSED`, nuốt P2002
  - `recordSkipped(taskId: number, scheduledFor: Date): Promise<void>`: insert `SKIPPED`, `error: 'previous run still running'`, nuốt P2002
  - `hasRunning(taskId: number): Promise<boolean>`
  - `complete(runId: number, token: string): Promise<void>`
  - `stop(runId: number): Promise<ScheduledRunView>`
  - `rerun(runId: number): Promise<ScheduledRunView>`
  - `dismiss(runId: number): Promise<void>`
  - `attention(): Promise<AttentionItem[]>`, với `AttentionItem = { id, taskId, taskName, status: 'MISSED'|'FAILED', scheduledFor, error }`
  - `runs(taskId: number, page: number): Promise<{ data: ScheduledRunView[]; total: number }>`, 20 dòng mỗi trang, mới nhất trước
  - `output(runId: number): Promise<{ content: string }>`: 404 khi `output` null
  - `failTimedOut(now: Date): Promise<void>`
  - `onModuleInit()`: đối soát
  - `ScheduledRunView` = các field của run, trừ `token` và `output`
- Routes:
  - `POST /scheduled-tasks/:id/run`
  - `GET /scheduled-tasks/:id/runs?page=`
  - `GET /scheduled-runs/attention`
  - `POST /scheduled-runs/:id/rerun|dismiss|stop`
  - `GET /scheduled-runs/:id/output`
  - `POST /scheduled-runs/:id/complete` (`@AllowWithoutClientHeader`, `@HttpCode(204)`, header `x-run-token`)

Luồng `start`, theo đúng thứ tự:
1. Insert run với `RUNNING`, `startedAt = now`, `token = randomBytes(24).hex`, `agentName`. Nếu P2002 trên index `one_running_per_task` thì trả `ConflictException('Task is already running')`. P2002 trên index `one_per_occurrence` thì ném lại để scheduler bỏ qua.
2. Kiểm tra agent và `AGENT.md`, `assertRepoPath` cho từng repo, `mkdir -p` cho outputDir. Bước này hoặc các bước sau mà lỗi thì update run sang `FAILED` kèm `error` và `finishedAt`. Trigger MANUAL hoặc RERUN thì ném lỗi ra; trigger SCHEDULE thì chỉ log.
3. `createAgent({ agent: provider, cwd: repos[0].path, args: buildAgentArgs(profile, runsDir, ...repos.slice(1).map(path), outputDir) })`. `!ready` thì FAILED với lời nhắn giống ticket run.
4. `sendPrompt`, rồi lưu `paneId` và `outputPath`.

`runsDir` và `callbackUrl` lấy giống `AgentRunsService` (đọc `RUNS_DIR` / `PORT` từ config).

- [ ] **Step 1: Viết test thất bại** (mock Prisma, Herdr, profiles, `fs`):
  - `start` thành công: `createAgent` được gọi với `cwd` là repo position 0 và `args` có đủ các thư mục. `sendPrompt` nhận prompt có `outputFile` = `join(outputDir, outputFileName(slug, scheduledFor))`.
  - `start` khi repo path không tồn tại (`assertRepoPath` reject) → run được update sang `FAILED`, `error` chứa message, `createAgent` không được gọi. **(Review Focus 3)**
  - `start` khi `mkdir` reject → FAILED. **(Review Focus 5)**
  - `start` khi đã có RUNNING (P2002 trên `scheduled_runs_one_running_per_task`) → `ConflictException`.
  - `complete` với token sai → `ForbiddenException`. Run không ở trạng thái RUNNING → `ConflictException`.
  - `complete` khi file có `mtime < startedAt` → `FAILED` với `'output file missing'`. **(Review Focus 4)**
  - `complete` khi file mới → `COMPLETED`, lưu `output` = nội dung file và `finishedAt`, rồi `closeAgent(paneId)`.
  - `failTimedOut(now)`: run RUNNING có `startedAt < now - MAX_RUN_MS` → `FAILED` `'timed out'`. Pane **không** bị đóng. **(Review Focus 4)**
  - `onModuleInit`: run RUNNING mà pane không còn trong `listAgents` → `FAILED` `'Agent pane is gone'`.
  - `rerun` trên MISSED → gọi `start(taskId, RERUN, original.scheduledFor, original.id)`. Trên COMPLETED → 409. Run đã có `rerun` → 409. Trên một rerun FAILED → được phép, và `rerunOfId` trỏ về chính run đó.
  - `dismiss` trên MISSED/FAILED → set `dismissedAt`. Trạng thái khác → 409.
  - `attention()` lọc đúng điều kiện ở Global Constraints (assert `where` truyền vào Prisma), sắp `scheduledFor` giảm dần.
  - `stop` → `STOPPED`, `finishedAt`, `closeAgent`.

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- scheduled-runner scheduled-runs`. Kỳ vọng FAIL.

- [ ] **Step 3: Implement** service và controllers. Phân biệt hai index qua `meta.target` / message của lỗi P2002, theo cách `RepositoriesService.rethrow` đang làm.

- [ ] **Step 4: Chạy** `pnpm --filter daemon test && pnpm --filter daemon build`. Kỳ vọng PASS.

---

### Task 6: Scheduler tick

**Files:**
- Create: `scheduled-tasks/services/scheduler.service.ts` + spec
- Modify: `scheduled-tasks.module.ts` (provider)

**Interfaces:**
- Consumes: `occurrencesBetween` (Task 2); `ScheduledRunnerService.start/recordMissed/recordSkipped/hasRunning/failTimedOut` (Task 5).
- Produces: `SchedulerService.tick(now: Date = new Date()): Promise<void>`. `onModuleInit` chạy `tick()` một lần, sau khi runner đã đối soát (gọi `await runner.onModuleInit()` trước, hoặc dựa vào thứ tự provider; chọn cách nào thì ghi một dòng comment), rồi `setInterval(TICK_MS).unref()`. `onModuleDestroy` gọi `clearInterval`. Có cờ `busy` để tick sau không chồng lên tick trước.

Thuật toán `tick(now)`:
1. `await runner.failTimedOut(now)`
2. Với mỗi task `enabled`:
   - `from = max(checkedUntil, now - MISSED_LOOKBACK_DAYS ngày)`
   - với mỗi `t` trong `occurrencesBetween(task, from, now)`:
     - `now - t > GRACE_MS` → `recordMissed`
     - ngược lại, nếu `hasRunning` → `recordSkipped`
     - ngược lại → `start(task.id, SCHEDULE, t)`, nuốt P2002 và lỗi
   - update `checkedUntil = now`
3. Lỗi của một task chỉ được log, không làm dừng các task khác.

- [ ] **Step 1: Viết test thất bại** (mock runner + Prisma, `now` cố định):
  - lần hẹn cách `now` 1 phút → `start` được gọi với đúng `t`, và `checkedUntil` được update.
  - lần hẹn cách 3 phút → `recordMissed`.
  - máy tắt 10 ngày, task chạy mỗi ngày → `recordMissed` chỉ được gọi cho các lần trong 7 ngày gần nhất (7 lần).
  - đang có run chạy và tới lần hẹn mới → `recordSkipped`, `start` không được gọi.
  - task `enabled=false` → bị bỏ qua (query chỉ lấy `enabled: true`).
  - `start` reject với P2002 → không ném lỗi ra ngoài, `checkedUntil` vẫn được update. **(Review Focus 1)**
  - một task lỗi không chặn task tiếp theo.
  - `failTimedOut` được gọi với `now`.

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- scheduler.service`. Kỳ vọng FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Chạy** `pnpm --filter daemon test && pnpm --filter daemon build && pnpm --filter daemon check`. Kỳ vọng PASS. Nếu `app.module.spec.ts` kiểm tra wiring module thì thêm module mới vào đó.

---

### Task 7: Web, khung module và trang danh sách

**Files:**
- Create (qua script): `apps/web/src/modules/scheduled-tasks/**`
- Create: `apps/web/src/routes/_app/scheduled-tasks.ts`
- Modify: `apps/web/src/constants/routes.ts` (`scheduledTasks: '/scheduled-tasks'`), `apps/web/src/constants/menu.ts` (item `scheduled-tasks`, icon `CalendarClock`, `titleKey: 'menu.scheduled_tasks'`), i18n `vi`/`en`
- Create trong module: `enum.ts`, `types.ts`, `constants.ts`, `hooks.ts`, `utils.ts`, `components/ScheduledTasksPage.tsx`, `components/AttentionPanel.tsx`, `components/ScheduledTaskTable.tsx`

**Interfaces:**
- Consumes: các route daemon ở Task 4 và Task 5.
- Produces:
  - Enum `ScheduledRunStatus`, `ScheduledRunTrigger`, có giá trị trùng daemon.
  - Types `IScheduledTask` (giống `ScheduledTaskView`), `IScheduledRun`, `IAttentionItem`, `ISaveScheduledTask`.
  - Constants `SCHEDULED_TASK_QUERY_KEYS = { list, runs, attention, output }`, `SCHEDULED_TASK_ENDPOINTS`, `ATTENTION_REFETCH_MS = 30_000`, `WEEKDAYS = [1,2,3,4,5,6,0]` (thứ tự hiển thị T2 đến CN), `ATTENTION_TOAST_KEY = 'scheduled-attention-toast'`.
  - Hooks:
    - `useScheduledTasks()`
    - `useSaveScheduledTask()` (create khi không có id, PATCH khi có id)
    - `useDeleteScheduledTask()`
    - `useRunScheduledTask()`
    - `useScheduledRuns(taskId, page)`
    - `useAttentionRuns()` (`refetchInterval: ATTENTION_REFETCH_MS`)
    - `useRerunRun()`, `useDismissRun()`, `useStopRun()`
    - `useRunOutput(runId, enabled)`
    - Mọi mutation invalidate `list`, `runs` và `attention`.
  - Utils:
    - `formatSchedule(time: number, days: number[]): string` → `'08:30 (T2, T4, T6)'`. Nhãn ngày lấy từ i18n `scheduled.day.<0-6>`. Đủ 7 ngày thì ra `'09:30 (mỗi ngày)'`.
    - `toTimeString(time: number): string` (`510` → `'08:30'`), `fromTimeString(value: string): number`.
  - Export trong portal: `useAttentionRuns`, `AttentionBadge` (Task 9), `useAttentionToast` (Task 9).

- [ ] **Step 1: Chạy script `web-create-module scheduled-tasks`** (từ `apps/web`), rồi thêm route, menu và i18n (`menu.scheduled_tasks`: "Scheduled tasks" / "Tác vụ theo lịch").

- [ ] **Step 2: Implement trang** theo mockup (`.superpowers/brainstorm/36457-1793750838/content/scheduled-tasks.html`):
  - `AttentionPanel` ẩn khi rỗng. Mỗi dòng gồm tên task, `formatDate(scheduledFor)`, "Bỏ lỡ" hoặc "Lỗi: <error>", và hai nút Chạy lại / Bỏ qua.
  - Bảng gồm Tên, Lịch (`formatSchedule`), Agent, Lần chạy gần nhất (badge trạng thái + giờ), Lần tới, công tắc Bật (PATCH `enabled`), các nút Chạy ngay / Lịch sử / Sửa / Xoá.
  - Xoá cần xác nhận bằng `UIUtils.alert`.
  - Lỗi 409 hiện bằng `UIUtils.notify.error` kèm message từ server.

- [ ] **Step 3: Chạy** `rtk pnpm --filter web audit:codestyle && rtk proxy pnpm --filter web typecheck && rtk pnpm --filter web exec biome check .`. Kỳ vọng PASS (trừ lỗi có sẵn từ trước).

---

### Task 8: Web, form và lịch sử

**Files:**
- Create: `components/ScheduledTaskForm.tsx`, `components/ScheduledTaskDialogRenderer.tsx`, `components/RunHistory.tsx`, `components/RunHistoryDialogRenderer.tsx`, `components/RunOutput.tsx`
- Modify: `constants.ts` (tên popup), `ScheduledTaskTable.tsx` (mở dialog), i18n

**Interfaces:**
- Consumes: các hook ở Task 7. Danh sách agent và repo lấy bằng `useWarehouseList` từ `#modules/warehouse`, dùng theo cách `TicketSettingsForm` lấy dữ liệu tương tự.
- Produces: dialog mở bằng `UIUtils.popup.open({ name, renderer, params })`, cùng pattern với `TicketDialogRenderer`.

- [ ] **Step 1: Form** (`useFormResolver` + `TmnController`), gồm:
  - tên
  - giờ (input `type="time"`)
  - 7 nút toggle ngày theo thứ tự `WEEKDAYS`
  - agent (select)
  - repos (multi-select; thứ tự chọn chính là thứ tự gửi lên, có ghi chú "repo đầu tiên là repo chính")
  - thư mục output
  - prompt (textarea)

  Schema validate: tên không rỗng, ít nhất 1 ngày, ít nhất 1 repo, đã chọn agent, có outputDir, có prompt. Message lấy qua schema factory. Lỗi request hiện bằng `TmnCallout` và giữ nguyên input.

- [ ] **Step 2: Lịch sử**, mỗi trang 20 dòng: Dự kiến, Nguồn (Lịch / Thủ công / Chạy lại), Trạng thái, Lỗi, và hành động.
  - COMPLETED: **Xem** (mở `RunOutput` hiển thị `Markdown` với `MARKDOWN_CLASS` giống `TicketDialog`) và **Copy** (`navigator.clipboard.writeText(content)`, rồi `notify.success`).
  - MISSED/FAILED chưa xử lý: **Chạy lại**.
  - RUNNING: **Dừng**.

- [ ] **Step 3: Chạy** các lệnh kiểm tra web như Task 7 Step 3. Kỳ vọng PASS.

---

### Task 9: Badge trên menu và toast trên dashboard

**Files:**
- Modify: `apps/web/src/@types/index.d.ts` (`IMenuItem.badge?: ReactNode`), `apps/web/src/components/Sidebar/MenuLink.tsx` (hiện `item.badge` ở cuối dòng), `apps/web/src/layouts/Layout.tsx`
- Create: `scheduled-tasks/components/AttentionBadge.tsx`, `scheduled-tasks/hooks.ts` (`useAttentionToast`)
- Modify: `apps/web/src/modules/dashboard/components/<Dashboard>.tsx` (gọi `useAttentionToast()`), i18n

**Interfaces:**
- Consumes: `useAttentionRuns` (Task 7).
- Produces:
  - `AttentionBadge`: hiện số lượng, trả `null` khi bằng 0, có `aria-label` qua `trans`.
  - `useAttentionToast(): void`: khi `data.length > 0` và `sessionStorage[ATTENTION_TOAST_KEY]` chưa có thì `UIUtils.notify.warning(trans('scheduled.attention_toast', { count }))`, kèm link/nút tới `ROUTE_PATHS.scheduledTasks`, rồi set key. Nếu `notify` không nhận action thì toast chỉ có chữ, vì badge đã dẫn tới trang.

- [ ] **Step 1: Implement.** `Layout` gắn badge bằng `MENU_ITEMS.map(i => i.key === 'scheduled-tasks' ? { ...i, badge: <AttentionBadge /> } : i)`. `components/` không được import module; chỉ `Layout` được phép. Bản dịch:
  - `scheduled.attention_toast`: "Có {{count}} lần chạy bị bỏ lỡ hoặc lỗi" / "{{count}} scheduled runs were missed or failed"

- [ ] **Step 2: Chạy** các lệnh kiểm tra web như Task 7 Step 3, cộng `rtk pnpm --filter web build`. Kỳ vọng PASS.

---

### Task 10: Kiểm tra end-to-end

- [ ] **Step 1:** Chạy `python3 .agents/skills/repo-quality-checks/scripts/check.py`. Kỳ vọng mọi mục PASS, trừ lỗi audit có sẵn từ trước ở `MachineStatus.tsx`.
- [ ] **Step 2:** Khởi động lại daemon dev. Dùng skill `web-browser-testing` để:
  - tạo task (2 repo, outputDir `~/tmp-scheduled-test`, prompt ngắn: "Write 'hello' as the result") rồi bấm Chạy ngay. Lịch sử phải chuyển COMPLETED, file `YYYY-MM-DD-<slug>.md` phải có trong thư mục, Xem / Copy phải đúng nội dung.
  - chèn một dòng `MISSED` vào DB local (`INSERT INTO scheduled_runs ...`). Badge phải hiện 1, toast phải hiện khi mở dashboard (một lần mỗi phiên), Bỏ qua phải làm badge mất.
  - sửa giờ task thành 1–2 phút tới và chờ. Task phải tự chạy đúng giờ, và chỉ chạy một lần.
- [ ] **Step 3:** Dọn dẹp: xoá task thử, xoá thư mục `~/tmp-scheduled-test`, xoá dòng MISSED đã chèn.
