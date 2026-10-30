# Kanban 01 — Nền tảng ticket: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kéo ticket Jira về DB, gắn ticket vào project qua Ticket Store (kéo thả), cấu hình repo và bộ agent mặc định cho project, và hiện board 8 cột chỉ đọc.

**Architecture:** Daemon NestJS thêm ba module: `agent-profiles` (đọc file agent trong thư mục global), `jira` (client REST + sync), `tickets` (Ticket Store, link, board). Repo của project và trường mặc định nằm trong Prisma. Web thêm module `tickets` (trang Ticket Store, board) và mở rộng form project.

**Tech Stack:** NestJS 11, Prisma 7 + Postgres, Jest; React 19, TanStack Router/Query, `@truyenmoinhu/*` (uikit `TmnDnD`, form, query).

**Spec:** `docs/superpowers/specs/2026-10-30-kanban-board-design.md`

### Lộ trình (3 plan, mỗi plan ra phần mềm chạy được)
1. **Plan này:** dữ liệu, kho agent, Sync Jira, Ticket Store, cài đặt project, board chỉ đọc.
2. **Kanban 02 — Agent run + bước Spec:** mở rộng Herdr (cwd, args, env, dừng pane), bảng `AgentRun` và callback hoàn thành, kéo To Do → In Spec, dialog card (review spec, sửa, feedback, approve, đổi agent/repo/project, phần thêm rules/skills), realtime board.
3. **Kanban 03 — Dev ↔ Testing + Canceled:** chạy song song Dev và Testing, test case, vòng sửa có giới hạn 2, In Review, Done, dừng agent khi Canceled, cảnh báo trùng repo.

Plan 02 và 03 được viết sau khi plan này xong, dựa trên code thật.

## Global Constraints

- Daemon: test unit `*.spec.ts` cạnh source, chạy `pnpm --filter daemon test`; thay đổi Prisma phải có migration (`pnpm --filter daemon db:migrate:dev --name <name>`).
- Web: tuân thủ `.agent/rules/web-*.md`; mỗi component một file PascalCase, `index.ts` chỉ re-export, arrow function, `if` luôn có `{}`, interface tiền tố `I`, chuỗi UI qua `trans` với key ở cả `vi` và `en`, query/mutation lấy `apiManager` từ context.
- Web verify: `pnpm --filter web audit:codestyle`, `pnpm --filter web typecheck`, `pnpm --filter web exec biome check .`, `pnpm --filter web build`.
- App chỉ đọc Jira, không bao giờ ghi lên Jira. App không chạy lệnh git.
- 8 trạng thái ticket, đúng thứ tự: `TODO, IN_SPEC, IN_REVIEW_SPEC, IN_PROGRESS, IN_TESTING, IN_REVIEW, DONE, CANCELED`.
- Thư mục agent mặc định `~/.the-agents-org/agents/`, đổi bằng env `AGENTS_DIR`; agent định danh bằng slug = tên file bỏ `.md`.
- Env Jira: `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN` (tuỳ chọn; thiếu thì Sync trả 503, app vẫn chạy).
- JQL sync: `assignee = currentUser() AND statusCategory != Done`.

## Review Focus

1. **Sync chạy lần hai** với cùng dữ liệu → không tạo bản ghi trùng, không đổi trạng thái ticket đã link (Task 4: `is idempotent on repeated sync`).
2. **Ticket đã link bị đóng trên Jira nhưng vẫn assign cho mình** → không bị Canceled (Task 4: `does not cancel tickets closed in Jira but still assigned`).
3. **Lưu link cho ticket đã được link trước đó** (hai tab, double click) → từ chối, không ghi đè project (Task 5: `rejects linking an already linked ticket`).
4. **Đường dẫn repo không tồn tại hoặc tương đối** → 400 (Task 3: `rejects relative or missing repo paths`).
5. **File agent sai frontmatter** (thiếu provider, provider lạ) → bị bỏ qua và báo trong danh sách lỗi, không làm hỏng cả danh sách (Task 2: `reports invalid files without failing the list`).

---

### Task 1: Schema Prisma cho repo, mặc định của project và ticket

**Files:**
- Modify: `apps/daemon/prisma/schema.prisma`
- Create: `apps/daemon/prisma/migrations/<timestamp>_tickets_foundation/migration.sql` (sinh bằng lệnh)

**Interfaces:**
- Produces (Prisma models, dùng ở mọi task sau):
  - `enum TicketStatus { TODO IN_SPEC IN_REVIEW_SPEC IN_PROGRESS IN_TESTING IN_REVIEW DONE CANCELED }`
  - `ProjectRepo { id Int, projectId Int, name String @db.VarChar(64), path String @db.VarChar(1024) }`, `@@unique([projectId, name])`, map `project_repos`, `onDelete: Cascade` từ Project.
  - `Project` thêm: `defaultRepoId Int?` (relation `ProjectRepo`, `onDelete: SetNull`), `specAgent String? @db.VarChar(128)`, `devAgent String?`, `testAgent String?`, `repos ProjectRepo[]`, `tickets Ticket[]`.
  - `Ticket { id Int, jiraKey String @unique @db.VarChar(64), summary String @db.VarChar(1024), description String @db.Text (plain text), issueType String @db.VarChar(64), jiraStatus String @db.VarChar(128), jiraUrl String @db.VarChar(1024), status TicketStatus @default(TODO), projectId Int?, repoId Int?, specAgent String?, devAgent String?, testAgent String?, linkedAt DateTime?, createdAt DateTime @default(now()), updatedAt DateTime @updatedAt }`, map `tickets`, index `projectId`. `projectId` → Project `onDelete: Restrict`; `repoId` → ProjectRepo `onDelete: SetNull`.
  - Cột DB snake_case qua `@map`, theo mẫu `workspace_id` hiện có.

- [ ] **Step 1: Sửa `schema.prisma` theo Interfaces**
- [ ] **Step 2: Sinh migration và client**

Run: `cd apps/daemon && pnpm db:migrate:dev --name tickets_foundation`
Expected: migration mới tạo bảng `project_repos`, `tickets`, enum `TicketStatus`; `prisma generate` chạy xong không lỗi.

- [ ] **Step 3: Chạy test hiện có để chắc không vỡ**

Run: `pnpm --filter daemon test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/daemon/prisma
git commit -m "Add ticket and project repo schema"
```

---

### Task 2: Kho agent đọc từ file (`AgentProfilesService`)

**Files:**
- Create: `apps/daemon/src/agent-profiles/agent-profiles.service.ts`
- Create: `apps/daemon/src/agent-profiles/agent-profiles.controller.ts`
- Test: `apps/daemon/src/agent-profiles/agent-profiles.service.spec.ts`
- Modify: `apps/daemon/src/configuration/env.validation.ts` (thêm `AGENTS_DIR?: string`), `apps/daemon/.env.example`, `apps/daemon/src/app.module.ts`

**Định dạng file** (quyết định trong spec mục 5; không thêm dependency YAML, frontmatter chỉ gồm dòng `key: value`):

```markdown
---
name: Frontend Developer
provider: claude
model: claude-sonnet-5-5
effort: medium
skills: superpowers:test-driven-development, frontend-design
---
Phần thân: mô tả hành vi, cách tư duy, rules (markdown tự do).
```

**Interfaces:**
- Produces:
  - `type AgentProvider = 'claude' | 'codex' | 'copilot' | 'agy'` (khớp `AGENT_KINDS` trong `herdr.service.ts`; `antigravity` được chuẩn hoá thành `agy`).
  - `interface AgentProfile { slug: string; name: string; provider: AgentProvider; model?: string; effort?: string; skills: string[]; instructions: string }`
  - `interface AgentProfileList { profiles: AgentProfile[]; errors: { file: string; message: string }[] }`
  - `AgentProfilesService.list(): Promise<AgentProfileList>` — đọc lại thư mục mỗi lần gọi, chỉ file `*.md`, sắp theo slug.
  - `AgentProfilesService.get(slug: string): Promise<AgentProfile>` — `NotFoundException` nếu không có hoặc file lỗi.
  - `AgentProfilesService.assertExists(slugs: (string | null | undefined)[]): Promise<void>` — bỏ qua null/undefined, `BadRequestException('Unknown agent: <slug>')` nếu thiếu.
  - Hàm thuần export: `parseAgentProfile(slug: string, source: string): AgentProfile` (throw `Error` với message rõ khi sai).
  - HTTP: `GET /api/v1/agent-profiles` → `AgentProfileList`.
  - Thư mục: `AGENTS_DIR` hoặc `path.join(os.homedir(), '.the-agents-org', 'agents')`; thư mục chưa tồn tại → `{ profiles: [], errors: [] }`.

- [ ] **Step 1: Viết test hỏng**

```ts
describe('parseAgentProfile', () => {
  it('parses frontmatter and body', () => {
    const p = parseAgentProfile('fe-dev', '---\nname: Frontend Developer\nprovider: claude\nmodel: claude-sonnet-5-5\neffort: medium\nskills: a, b:c\n---\nBe careful.\n');
    expect(p).toEqual({ slug: 'fe-dev', name: 'Frontend Developer', provider: 'claude', model: 'claude-sonnet-5-5', effort: 'medium', skills: ['a', 'b:c'], instructions: 'Be careful.' });
  });
  it('normalizes antigravity to agy and defaults name to slug', () => {
    expect(parseAgentProfile('x', '---\nprovider: antigravity\n---\n')).toMatchObject({ name: 'x', provider: 'agy', skills: [] });
  });
  it('rejects missing or unknown provider', () => {
    expect(() => parseAgentProfile('x', '---\nname: X\n---\n')).toThrow('provider');
    expect(() => parseAgentProfile('x', '---\nprovider: gpt\n---\n')).toThrow('provider');
  });
  it('rejects files without frontmatter', () => {
    expect(() => parseAgentProfile('x', 'hello')).toThrow('frontmatter');
  });
});
describe('AgentProfilesService', () => {
  // dùng fs.mkdtemp trong os.tmpdir(), truyền dir qua ConfigService giả { AGENTS_DIR: dir }
  it('reports invalid files without failing the list', async () => {
    // ghi good.md hợp lệ và bad.md thiếu provider, và notes.txt
    const result = await service.list();
    expect(result.profiles.map(p => p.slug)).toEqual(['good']);
    expect(result.errors).toEqual([{ file: 'bad.md', message: expect.stringContaining('provider') }]);
  });
  it('returns empty when the directory does not exist', async () => { /* AGENTS_DIR trỏ thư mục không có */ });
  it('assertExists throws for unknown slug and ignores null', async () => {
    await expect(service.assertExists([null, 'good'])).resolves.toBeUndefined();
    await expect(service.assertExists(['missing'])).rejects.toThrow('Unknown agent: missing');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- agent-profiles`
Expected: FAIL, "Cannot find module './agent-profiles.service'"

- [ ] **Step 3: Cài đặt service, controller, env, đăng ký vào `AppModule`**

Dùng `fs/promises.readdir/readFile`; `ENOENT` của thư mục → danh sách rỗng.

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm --filter daemon test -- agent-profiles`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/agent-profiles apps/daemon/src/configuration apps/daemon/src/app.module.ts apps/daemon/.env.example
git commit -m "Add file-based agent profiles"
```

---

### Task 3: Cài đặt project: repo và bộ mặc định

**Files:**
- Create: `apps/daemon/src/project-settings.controller.ts`
- Test: `apps/daemon/src/project-settings.controller.spec.ts`
- Modify: `apps/daemon/src/app.module.ts`

**Interfaces:**
- Consumes: `AgentProfilesService.assertExists` (Task 2), `WorkspacesController.project(workspaceId, id)` logic (sao chép điều kiện `findFirst({ where: { id, workspaceId } })`, không inject controller).
- Produces (prefix `workspaces/:id/projects/:projectId`):
  - `GET settings` → `{ repos: ProjectRepo[]; defaultRepoId: number | null; specAgent: string | null; devAgent: string | null; testAgent: string | null }`
  - `POST repos` body `CreateRepoDto { name: string (1–64, /^[A-Za-z0-9._-]+$/); path: string }` → `ProjectRepo`. Project chưa có repo mặc định thì repo đầu tiên thành mặc định.
  - `PATCH repos/:repoId` body `Partial<CreateRepoDto>` → `ProjectRepo`
  - `DELETE repos/:repoId` → 204
  - `PATCH settings` body `UpdateProjectSettingsDto { defaultRepoId?: number | null; specAgent?: string | null; devAgent?: string | null; testAgent?: string | null }` → như `GET settings`.
  - Hàm export `assertRepoPath(path: string): Promise<void>` — path phải tuyệt đối và là thư mục tồn tại (`fs.stat().isDirectory()`), không thì `BadRequestException('Repo path must be an absolute existing directory')`.
- `defaultRepoId` phải thuộc chính project đó, không thì 400. Trùng `name` trong project → 409 (P2002).

- [ ] **Step 1: Viết test hỏng** (mock Prisma theo mẫu `workspaces.controller.spec.ts`)

```ts
it('rejects relative or missing repo paths', async () => {
  await expect(assertRepoPath('repo/ff-web')).rejects.toBeInstanceOf(BadRequestException);
  await expect(assertRepoPath('/definitely/missing/dir')).rejects.toBeInstanceOf(BadRequestException);
  await expect(assertRepoPath(os.tmpdir())).resolves.toBeUndefined();
});
it('makes the first repo the default', async () => {
  // project.findFirst → { id: 2, workspaceId: 1, defaultRepoId: null }; projectRepo.create → { id: 9, ... }
  await controller.createRepo(1, 2, { name: 'ff-web', path: os.tmpdir() });
  expect(prisma.project.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { defaultRepoId: 9 } });
});
it('rejects a default repo from another project', async () => {
  prisma.projectRepo.findFirst.mockResolvedValue(null);
  await expect(controller.updateSettings(1, 2, { defaultRepoId: 77 })).rejects.toBeInstanceOf(BadRequestException);
});
it('rejects unknown agent slugs', async () => {
  agentProfiles.assertExists.mockRejectedValue(new BadRequestException('Unknown agent: x'));
  await expect(controller.updateSettings(1, 2, { devAgent: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  expect(prisma.project.update).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- project-settings`
Expected: FAIL, module not found

- [ ] **Step 3: Cài đặt controller và DTO (class-validator theo mẫu `workspaces.controller.ts`), đăng ký vào `AppModule`**
- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm --filter daemon test -- project-settings`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/project-settings.controller*.ts apps/daemon/src/app.module.ts
git commit -m "Add project repos and default agents API"
```

---

### Task 4: Jira client và Sync

**Files:**
- Create: `apps/daemon/src/jira/jira.client.ts`, `apps/daemon/src/jira/jira-sync.service.ts`, `apps/daemon/src/jira/adf.ts`
- Test: `apps/daemon/src/jira/jira-sync.service.spec.ts`, `apps/daemon/src/jira/adf.spec.ts`
- Modify: `apps/daemon/src/configuration/env.validation.ts` (3 biến Jira, tuỳ chọn; `JIRA_BASE_URL` bỏ `/` cuối), `apps/daemon/.env.example`, `apps/daemon/src/app.module.ts`

**Interfaces:**
- Produces:
  - `interface JiraIssue { key: string; summary: string; description: string; issueType: string; status: string; assigneeAccountId: string | null }`
  - `JiraClient.isConfigured(): boolean`
  - `JiraClient.myself(): Promise<{ accountId: string }>` — `GET /rest/api/3/myself`
  - `JiraClient.search(jql: string): Promise<JiraIssue[]>` — `POST /rest/api/3/search/jql`, body `{ jql, fields: ['summary','description','issuetype','status','assignee'], maxResults: 100, nextPageToken }`, lặp tới khi hết `nextPageToken`. Basic auth `email:token`. Dùng `fetch` của Node. HTTP lỗi → `BadGatewayException` kèm status Jira.
  - `JiraClient.browseUrl(key: string): string` → `${JIRA_BASE_URL}/browse/${key}`
  - `adfToText(doc: unknown): string` — gom text node theo thứ tự, xuống dòng sau mỗi `paragraph`/`heading`/`listItem`, `hardBreak` → `\n`; `null` → `''`.
  - `JiraSyncService.sync(): Promise<{ created: number; updated: number; canceled: number; reopened: number }>`; Jira chưa cấu hình → `ServiceUnavailableException('Jira is not configured')`.
  - HTTP: `POST /api/v1/tickets/sync` (đặt trong `TicketsController` của Task 5; Task 4 chỉ làm service).

**Thuật toán sync** (spec 4.1 và mục 5):
1. `me = myself()`; `issues = search('assignee = currentUser() AND statusCategory != Done')`.
2. Upsert từng issue theo `jiraKey` (summary, description, issueType, jiraStatus, jiraUrl). Ticket mới: `status TODO`, `projectId null`. Không đụng `status`/`projectId` của ticket có sẵn, trừ bước 4.
3. Ticket trong DB có `status ∉ {DONE, CANCELED}` mà không có trong `issues`: tra lại `search('key in (K1,K2,…)')` theo lô 50 key. Nếu `assigneeAccountId !== me.accountId` → `status CANCELED`. Nếu vẫn là mình (bị đóng trên Jira) → chỉ cập nhật nội dung. Key không còn trên Jira (bị xoá) → CANCELED.
4. Ticket `CANCELED` có trong `issues` (assign lại cho mình) → `TODO` (giữ `projectId`, agent, repo), tính vào `reopened`.

- [ ] **Step 1: Viết test hỏng**

```ts
// adf.spec.ts
it('flattens paragraphs and hard breaks', () => {
  expect(adfToText({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'A' }, { type: 'hardBreak' }, { type: 'text', text: 'B' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'C' }] } ] })).toBe('A\nB\nC');
  expect(adfToText(null)).toBe('');
});
// jira-sync.service.spec.ts — JiraClient và Prisma là mock
it('creates new tickets unlinked in TODO', async () => { /* result.created === 1, create data has projectId undefined, status TODO */ });
it('is idempotent on repeated sync', async () => { /* lần 2: ticket đã tồn tại → update không chứa status/projectId; created 0 */ });
it('cancels tickets reassigned to someone else', async () => {
  // DB có FMS-1 IN_PROGRESS; search chính trả []; search key in (FMS-1) trả assigneeAccountId 'other'
  expect(prisma.ticket.update).toHaveBeenCalledWith(expect.objectContaining({ where: { jiraKey: 'FMS-1' }, data: expect.objectContaining({ status: 'CANCELED' }) }));
});
it('does not cancel tickets closed in Jira but still assigned', async () => { /* search key in trả assignee = me → không có status trong data */ });
it('reopens canceled tickets assigned back to TODO', async () => { /* DB CANCELED, có trong issues → status TODO, reopened 1 */ });
it('throws 503 when Jira is not configured', async () => { /* isConfigured false → ServiceUnavailableException */ });
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- jira`
Expected: FAIL, module not found

- [ ] **Step 3: Cài đặt `adf.ts`, `jira.client.ts`, `jira-sync.service.ts`, env, provider trong `AppModule`**
- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `pnpm --filter daemon test -- jira`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/jira apps/daemon/src/configuration apps/daemon/src/app.module.ts apps/daemon/.env.example
git commit -m "Add Jira client and ticket sync"
```

---

### Task 5: API Ticket Store, link và board

**Files:**
- Create: `apps/daemon/src/tickets/tickets.controller.ts`, `apps/daemon/src/tickets/tickets.service.ts`
- Test: `apps/daemon/src/tickets/tickets.service.spec.ts`
- Modify: `apps/daemon/src/app.module.ts`

**Interfaces:**
- Consumes: `JiraSyncService.sync` (Task 4), Prisma models (Task 1).
- Produces:
  - `POST /api/v1/tickets/sync` → kết quả `sync()`.
  - `GET /api/v1/tickets/store` → `{ tickets: StoreTicket[]; projects: { id: number; name: string; code: string; workspaceId: number }[] }` với `StoreTicket = { id; jiraKey; summary; issueType; jiraUrl; suggestedProjectId: number | null }`. Chỉ ticket `projectId = null` và `status != CANCELED`.
  - `suggestProjectId(jiraKey: string, projects: { id: number; code: string }[]): number | null` — export thuần. So khớp phần trước `-` cuối cùng của key với `code`, không phân biệt hoa thường.
  - `POST /api/v1/tickets/link` body `LinkTicketsDto { links: { ticketId: number; projectId: number }[] }` (1–200 phần tử) → `{ linked: number }`. Trong một `$transaction`: mỗi ticket phải đang `projectId = null`, không thì `ConflictException('Ticket <key> is already linked')` và rollback toàn bộ. Set `projectId`, `status TODO`, `linkedAt now`, `repoId = project.defaultRepoId`, `specAgent/devAgent/testAgent = project.*`.
  - `GET /api/v1/projects/:projectId/tickets` → `BoardTicket[]` với `BoardTicket = { id; jiraKey; summary; status: TicketStatus; jiraUrl }`, sắp theo `linkedAt` tăng dần.

- [ ] **Step 1: Viết test hỏng**

```ts
it('suggests by key prefix, case-insensitive', () => {
  const projects = [{ id: 1, code: 'FMS' }, { id: 2, code: 'APL-FMS' }];
  expect(suggestProjectId('fms-412', projects)).toBe(1);
  expect(suggestProjectId('APL-FMS-3', projects)).toBe(2);
  expect(suggestProjectId('OPS-88', projects)).toBeNull();
});
it('links with project defaults', async () => {
  // project { id: 3, defaultRepoId: 5, specAgent: 'analyst', devAgent: 'fe-dev', testAgent: 'qa' }
  expect(tx.ticket.update).toHaveBeenCalledWith({ where: { id: 10 }, data: expect.objectContaining({ projectId: 3, status: 'TODO', repoId: 5, specAgent: 'analyst', devAgent: 'fe-dev', testAgent: 'qa' }) });
});
it('rejects linking an already linked ticket', async () => {
  // tx.ticket.findUnique → { id: 10, jiraKey: 'FMS-1', projectId: 4 }
  await expect(service.link([{ ticketId: 10, projectId: 3 }])).rejects.toBeInstanceOf(ConflictException);
  expect(tx.ticket.update).not.toHaveBeenCalled();
});
it('store excludes linked and canceled tickets', async () => {
  await service.store();
  expect(prisma.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: null, status: { not: 'CANCELED' } } }));
});
```

- [ ] **Step 2: Chạy test, xác nhận hỏng**

Run: `pnpm --filter daemon test -- tickets`
Expected: FAIL, module not found

- [ ] **Step 3: Cài đặt service, controller, DTO; đăng ký vào `AppModule`**
- [ ] **Step 4: Chạy toàn bộ test daemon**

Run: `pnpm --filter daemon test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/daemon/src/tickets apps/daemon/src/app.module.ts
git commit -m "Add ticket store, link and board API"
```

---

### Task 6: Web — cài đặt repo và agent mặc định của project

**Files:**
- Create: `apps/web/src/modules/projects/` gồm `ProjectSettings.tsx`, `RepoList.tsx`, `RepoForm.tsx`, `DefaultsForm.tsx`, `hooks.ts`, `constants.ts`, `types.ts`, `index.ts`
- Modify: `apps/web/src/modules/workspaces/WorkspacePage.tsx` (route con `…/projects/:pid/settings` → `ProjectSettings`; trang project có nút "Cài đặt"), `apps/web/src/i18n/locales/{vi,en}/translation.json`

**Interfaces:**
- Consumes: API Task 2 và Task 3.
- Produces: `ProjectSettings` (props `IProjectSettingsProps { workspaceId: number; projectId: number }`); hooks `useProjectSettings(workspaceId, projectId)`, `useAgentProfiles()`, `useProjectSettingsMutation()` (invalidate key settings sau thành công).
- UI: danh sách repo (tên, đường dẫn, đánh dấu mặc định, sửa, xoá qua `UIUtils.alert`), form thêm repo, ba `TmnSelect` cho agent Spec/Dev/Testing lấy từ `useAgentProfiles`, select repo mặc định. `errors` của `useAgentProfiles` hiện bằng `TmnCallout` để người dùng biết file agent nào hỏng.

- [ ] **Step 1: Cài đặt module theo Interfaces và rules web**
- [ ] **Step 2: Chạy bộ verify web**

Run: `pnpm --filter web audit:codestyle && pnpm --filter web typecheck && pnpm --filter web exec biome check . && pnpm --filter web build`
Expected: tất cả exit 0

- [ ] **Step 3: Kiểm tra tay** — thêm 2 repo (`ff-web`, `ff-web-2`), repo đầu tự thành mặc định; nhập đường dẫn sai thấy lỗi tại field; chọn ba agent, tải lại trang vẫn giữ.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/modules/projects apps/web/src/modules/workspaces/WorkspacePage.tsx apps/web/src/i18n
git commit -m "Add project settings for repos and default agents"
```

---

### Task 7: Web — trang Ticket Store (kéo thả theo project)

**Files:**
- Create: `apps/web/src/modules/tickets/` gồm `TicketStorePage.tsx`, `StoreColumn.tsx`, `StoreTicketCard.tsx`, `hooks.ts`, `constants.ts`, `types.ts`, `utils.ts`, `index.ts`
- Create: `apps/web/src/routes/_app/tickets.ts`
- Modify: `apps/web/src/constants/routes.ts` (`tickets: '/tickets'`), `apps/web/src/constants/menu.ts` (mục "Ticket Store", icon `Inbox`), locale `vi`/`en`

**Interfaces:**
- Consumes: `POST /tickets/sync`, `GET /tickets/store`, `POST /tickets/link` (Task 5).
- Produces:
  - `TicketStatus` type và `TICKET_STATUSES` (8 giá trị đúng thứ tự Global Constraints) trong `types.ts`/`constants.ts`; Task 8 dùng lại.
  - `buildInitialPlacement(tickets: IStoreTicket[]): Record<number, number | null>` (ticketId → projectId gợi ý) trong `utils.ts`.
  - `toLinks(placement: Record<number, number | null>): ILinkTicket[]` — bỏ ticket còn `null`.
- UI (mockup A đã chọn): cột "Chưa xác định" + một cột mỗi project, ticket xếp theo gợi ý, kéo bằng `TmnDnD` (theo mẫu `WorkspaceTree`/`ProjectRow`). Nút **Sync** (pending khi đang chạy, `UIUtils.notify` báo created/updated/canceled/reopened; 503 → thông báo "Chưa cấu hình Jira"). Nút **Lưu (n)** với n = số ticket đã có project; sau khi lưu thì invalidate store. Card: key, summary, nhãn "gợi ý" nếu chưa bị kéo. Trống → empty state.

- [ ] **Step 1: Cài đặt module, route, menu, i18n**
- [ ] **Step 2: Chạy `pnpm --filter web generate-routes` rồi bộ verify web như Task 6**

Expected: tất cả exit 0, `routeTree.gen.ts` có `/_app/tickets`.

- [ ] **Step 3: Kiểm tra tay** với Jira thật — Sync, thấy ticket `FMS-…` nằm ở cột project `FMS`, ticket lạ ở "Chưa xác định"; kéo một ticket sang project khác; Lưu; ticket biến khỏi store.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/modules/tickets apps/web/src/routes apps/web/src/routeTree.gen.ts apps/web/src/constants apps/web/src/i18n
git commit -m "Add Ticket Store page"
```

---

### Task 8: Web — board 8 cột chỉ đọc

**Files:**
- Create: `apps/web/src/modules/tickets/ProjectBoard.tsx`, `BoardColumn.tsx`, `BoardCard.tsx`
- Modify: `apps/web/src/modules/tickets/{hooks.ts,constants.ts,index.ts}`, `apps/web/src/modules/workspaces/WorkspacePage.tsx` (trang project render `<ProjectBoard projectId={project.id} />`), locale `vi`/`en`

**Interfaces:**
- Consumes: `GET /projects/:projectId/tickets` (Task 5), `TICKET_STATUSES` (Task 7).
- Produces: `ProjectBoard` (props `IProjectBoardProps { projectId: number }`), `useProjectTickets(projectId)`. Plan 02 sẽ bật kéo thả và dialog trên các component này.
- UI (mockup A, card gọn): 8 cột theo thứ tự `TICKET_STATUSES`, tiêu đề cột kèm số lượng, card hiện `jiraKey` + `summary` (truncate), cuộn ngang khi hẹp. Chưa có kéo thả hay dialog trong plan này.

- [ ] **Step 1: Cài đặt component, hook, i18n tên 8 cột**
- [ ] **Step 2: Chạy bộ verify web như Task 6**

Expected: tất cả exit 0

- [ ] **Step 3: Kiểm tra tay** — mở project đã link ticket ở Task 7, thấy ticket ở cột To Do; kiểm tra light/dark và màn hẹp.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/modules/tickets apps/web/src/modules/workspaces/WorkspacePage.tsx apps/web/src/i18n
git commit -m "Add read-only project board"
```
