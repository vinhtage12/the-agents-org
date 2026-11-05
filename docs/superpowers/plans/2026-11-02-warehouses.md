# Kho (Warehouses): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa repo, agent, skill, rule thành kho dùng chung (CRUD + "đang được dùng bởi"), cho project/ticket chọn từ kho, và tạo nhánh git qua popup khi ticket vào In Progress lần đầu.

**Architecture:**
- Daemon: schema mới (`Repo` dùng chung + môi trường + nhánh, `Agent` trong DB, `Skill`, `Rule`), một migration SQL chuyển `project_repos` sang `repos`, và một import chạy lúc khởi động để chuyển file agent cũ sang DB và thư mục `members/`.
- Module mới: `repositories`, `skills`, `rules`, `git`. Module `agent-profiles` đổi từ đọc file sang DB, giữ route `agent-profiles`. `projects`, `tickets`, `agent-runs` chuyển từ slug sang id.
- Web: module mới `warehouse` (5 tab, bảng chung, popup sửa, usage). Form project/ticket dùng `TmnAutocomplete` với `apiUrl`. Board có popup tạo nhánh và avatar.

**Tech Stack:** NestJS 11, Prisma 7 + Postgres, Jest; React 19, TanStack Router/Query, `@truyenmoinhu/*`. Git qua `child_process.execFile`. Không thêm dependency.

**Spec:** `docs/superpowers/specs/2026-11-02-warehouses-design.md` (nền: `2026-10-30-kanban-board-design.md`)

### Quyết định cho spec mục 6

- **Schema:** xem Task 1. Project↔Repo, Agent↔Skill, Agent↔Rule, Ticket↔Skill, Ticket↔Rule dùng quan hệ n..n ngầm của Prisma.
- **Cột slug cũ** (`projects.spec_agent/dev_agent/test_agent`, `tickets.spec_agent/dev_agent/test_agent`, `tickets.extra_skills`) được giữ lại, đánh dấu legacy, chỉ để import đọc. Xoá bằng một migration sau khi import đã chạy trên máy chủ dự án. Shortcut, ghi trong schema.
- **Import agent cũ** chạy trong `onModuleInit` của `AgentImportService`, chỉ khi bảng `agents` rỗng. Thư mục đích là env `MEMBERS_DIR`, mặc định `resolve(process.cwd(), '../../members')`, vì daemon chạy với cwd `apps/daemon`. Import không xoá file gốc, và không ghi đè `AGENT.md` đã có.
- **Skill cũ chỉ có tên:** import tạo `Skill` với `path = ''` và description `Imported: set the skill folder path`. Lệnh là `$name` cho codex, `/name` cho provider khác. Provider lấy từ agent chứa skill đó. `extraSkills` của ticket lấy provider của `devAgent`, không có thì dùng `claude`.
- **Lọc skill trên ticket:** ô chọn hiện mọi skill, label kèm provider. Prompt của mỗi agent chỉ chứa skill cùng provider với agent đó.
- **Allowed tools:** Claude dùng `--allowedTools <a,b>`, Copilot dùng `--allow-tool <t>` lặp lại theo từng tool. Codex và agy bỏ qua. Kiểm lại bằng `--help` khi làm, giống chú thích trong `agent-args.ts`.
- **Avatar:** `GET agent-profiles/:id/avatar` stream `<agent.path>/avatar.png`. Tên file cố định nên không nhận path từ client.
- **Git:** `GitService` gọi `execFile('git', args, { cwd })`, không qua shell. Remote là `origin`.
- **Kho Ticket:** route mới `/warehouse/tickets` dùng lại `TicketStorePage`. `/tickets` redirect sang đó. Menu "Kho ticket" được thay bằng "Kho".
- **Tạo project** vẫn chỉ có tên và code. Chọn repo và agent nằm ở trang Settings của project, như hiện tại.
- **Ticket legacy chưa có nhánh** đang ở In Progress hoặc In Testing: bỏ qua kiểm tra nhánh khi `ticket.branch` null. Popup hiện ở lần kéo sang In Progress kế tiếp. Đường feedback và vòng sửa của ticket legacy không bắt tạo nhánh. Shortcut, ghi trong code.
- **Push lỗi sau khi đã tạo nhánh:** giữ nhánh local đã checkout, vẫn lưu `ticket.branch`, nhưng không chuyển cột và không chạy agent. Trả 502 với lỗi git. Lần kéo sau, ticket đã có nhánh nên chuyển cột bình thường. Bạn tự push.

## Global Constraints

- **Không commit, không push.** Chủ dự án tự commit. Các bước "Commit" của skill được bỏ.
- Lệnh kiểm tra:
  - Daemon: `pnpm --filter daemon test`, `pnpm --filter daemon build`, `pnpm --filter daemon check`.
  - Web: `rtk pnpm --filter web audit:codestyle`, `rtk proxy pnpm --filter web typecheck`, `rtk pnpm --filter web exec biome check .`, `rtk pnpm --filter web build`.
  - Cuối cùng: `python3 .agents/skills/repo-quality-checks/scripts/check.py`.
- Module daemon mới phải tạo bằng script của skill `daemon-create-module`. Module web mới phải tạo bằng script của skill `web-create-module`. Không scaffold tay.
- Schema: `pnpm --filter daemon db:migrate:dev --name <snake> --create-only`, sửa SQL nếu cần, rồi `pnpm --filter daemon db:migrate:dev`, rồi `pnpm --filter daemon db:generate`. Cập nhật entity `implements` model. Không sửa migration đã áp dụng (`apps/daemon/.agents/rules/daemon-migrations.md`).
- Request ghi từ web phải có header `x-agents-org-client`, `apiManager` đã lo việc này.
- Web: chuỗi UI dùng `trans`, thêm key ở cả `vi` và `en`. Không dùng `·` làm dấu phân cách. Form đi qua `TmnController`.
- Role: `BA | DEV | QC | FILE_PROCESSOR`. Loại nhánh lưu: `CHECKOUT_BASE | PR_TARGET | NONE`. Provider: `claude | codex | copilot | agy`.
- Bước ↔ role: `specAgentId` → BA, `devAgentId` → DEV, `testAgentId` → QC.
- Tên file cố định trong thư mục agent: `AGENT.md`, `avatar.png`, `sprites/`.
- Loại nhánh đích (TmnSelect): `feat, bug, hotfix, refactor, chore, docs, test`. Tên mặc định là key ticket.
- Ticket "đã đóng" là `DONE` hoặc `CANCELED`. Ticket đã đóng không khoá nút xoá.
- Endpoint danh sách mà `TmnAutocomplete` gọi phải nhận query `keyword` và trả `{ data: T[] }`, vì uikit đọc `payload.data`.

## Review Focus

1. **Repo path không phải git repo, hoặc máy không có git:** `git-branches` và tạo nhánh trả 400 với thông báo rõ ràng, không trả 500. Test ở Task 2.
2. **Tên nhánh đích không hợp lệ** (khoảng trắng, `..`, kết thúc bằng `.lock`): bị từ chối bằng `git check-ref-format --branch` trước khi chạy `checkout`. Test ở Task 2 và Task 8.
3. **Push lỗi sau khi nhánh đã được tạo:** ticket lưu nhánh, không chuyển cột, trả 502. Lần kéo sau không hiện popup nữa. Test ở Task 8.
4. **Ticket legacy đang chạy mà chưa có nhánh:** vòng sửa và Testing vẫn chạy, không bị chặn vì kiểm tra nhánh. Test ở Task 7.
5. **Thư mục agent bị xoá hoặc thiếu `AGENT.md`:** chặn khởi động agent với 400 nêu đúng path, trước khi tạo pane. Test ở Task 7.

---

## Hợp đồng API (dùng chung cho các task)

Mọi route dưới `api/v1`.

| Route | Kết quả |
|---|---|
| `GET repositories?keyword=` | `{ data: RepoListItem[] }`. `RepoListItem = Repo & { environments: string[]; inUse: number }` |
| `GET repositories/:id` | `Repo & { environments: (RepoEnvironment & { branches: RepoBranch[] })[] }` |
| `POST repositories`, `PATCH repositories/:id` | body `{ name, path, description }`, trả `Repo` |
| `DELETE repositories/:id` | 204. Trả 409 khi `inUse > 0` |
| `POST repositories/:id/environments`, `PATCH repositories/:id/environments/:envId` | body `{ name, envFile, branches: { name, kind }[] }`. PATCH thay toàn bộ danh sách nhánh |
| `DELETE repositories/:id/environments/:envId` | 204 |
| `GET repositories/:id/git-branches?keyword=` | `{ data: { label: string }[]; base: string \| null }` |
| `GET repositories/:id/usage` | `IUsage` |
| `GET agent-profiles?keyword=&role=` | `{ data: AgentListItem[] }`. `AgentListItem = Agent & { skills: {id,name,provider}[]; rules: {id,name}[]; inUse: number }` |
| `GET/POST/PATCH/DELETE agent-profiles[/:id]` | body `{ name, role, provider, model?, effort?, path, description, allowedTools: string[], skillIds: number[], ruleIds: number[] }` |
| `GET agent-profiles/:id/usage`, `GET agent-profiles/:id/avatar` | `IUsage`. Avatar trả `image/png` hoặc 404 |
| `GET skills?keyword=&provider=`, CRUD `skills[/:id]`, `GET skills/:id/usage` | body `{ name, provider, command, path, description }` |
| `GET rules?keyword=`, CRUD `rules[/:id]`, `GET rules/:id/usage` | body `{ name, path, description }` |
| `GET/PATCH workspaces/:id/projects/:projectId/settings` | GET trả `{ repos: Repo[]; defaultRepoId; specAgent; devAgent; testAgent }` (agent là `AgentRef \| null`). PATCH nhận `{ repoIds?, defaultRepoId?, specAgentId?, devAgentId?, testAgentId? }` |
| `PATCH tickets/:id` | `{ projectId?, repoId?, specAgentId?, devAgentId?, testAgentId?, skillIds?, ruleIds?, extraInstructions? }` |
| `POST tickets/:id/move` | `{ to, branch?: { base: string; name: string; push: boolean } }` |

```ts
type AgentRef = { id: number; name: string; role: AgentRole; provider: string; model: string | null };
type IUsage = {
  projects: { id: number; name: string; code: string; workspaceId: number }[];
  tickets: { id: number; jiraKey: string; projectId: number | null; workspaceId: number | null }[];
  agents: { id: number; name: string }[];
};
```

Các route repo con theo project (`POST/PATCH/DELETE workspaces/:id/projects/:projectId/repos`) bị xoá.

---

### Task 1: Schema, migration và chuyển `project_repos`

**Files:**
- Modify: `apps/daemon/prisma/schema.prisma`
- Create: `apps/daemon/prisma/migrations/<ts>_warehouses/migration.sql` (sinh ra bằng `--create-only`, sau đó sửa)
- Modify: `apps/daemon/src/modules/workspaces/entities/project.entity.ts`, `apps/daemon/src/modules/tickets/entities/ticket.entity.ts`, `apps/daemon/src/modules/agent-runs/entities/agent-run.entity.ts`
- Delete: `apps/daemon/src/modules/projects/entities/project-repo.entity.ts`

**Interfaces:**
- Produces: Prisma models `Repo`, `RepoEnvironment`, `RepoBranch`, `Agent`, `Skill`, `Rule`, enums `AgentRole`, `BranchKind`; các cột `Project.specAgentId/devAgentId/testAgentId`, `Ticket.specAgentId/devAgentId/testAgentId/branch`, `AgentRun.agentId`.

- [ ] **Step 1: Sửa schema**

```prisma
enum AgentRole { BA DEV QC FILE_PROCESSOR }
enum BranchKind { CHECKOUT_BASE PR_TARGET NONE }

model Repo {
  id Int @id @default(autoincrement())
  name String @unique @db.VarChar(64)
  path String @unique @db.VarChar(1024)
  description String @default("") @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  environments RepoEnvironment[]
  projects Project[] @relation("ProjectRepos")
  defaultFor Project[] @relation("DefaultRepo")
  tickets Ticket[]
  @@map("repos")
}
model RepoEnvironment {
  id Int @id @default(autoincrement())
  repoId Int @map("repo_id")
  name String @db.VarChar(64)
  envFile String @default("") @map("env_file") @db.VarChar(255)
  repo Repo @relation(fields: [repoId], references: [id], onDelete: Cascade)
  branches RepoBranch[]
  @@unique([repoId, name])
  @@map("repo_environments")
}
// One CHECKOUT_BASE per repo: partial unique index in migration SQL; repoId is denormalized for it.
model RepoBranch {
  id Int @id @default(autoincrement())
  environmentId Int @map("environment_id")
  repoId Int @map("repo_id")
  name String @db.VarChar(255)
  kind BranchKind @default(NONE)
  environment RepoEnvironment @relation(fields: [environmentId], references: [id], onDelete: Cascade)
  @@unique([environmentId, name])
  @@map("repo_branches")
}
model Agent {
  id Int @id @default(autoincrement())
  name String @unique @db.VarChar(128)
  role AgentRole
  provider String @db.VarChar(16)
  model String? @db.VarChar(128)
  effort String? @db.VarChar(32)
  path String @db.VarChar(1024)
  description String @default("") @db.VarChar(512)
  allowedTools String[] @default([]) @map("allowed_tools")
  skills Skill[]
  rules Rule[]
  // + 6 back-relations: projectsAsSpec/Dev/Test, ticketsAsSpec/Dev/Test, + runs AgentRun[]
  @@map("agents")
}
model Skill {
  id Int @id @default(autoincrement())
  name String @db.VarChar(128)
  provider String @db.VarChar(16)
  command String @db.VarChar(128)
  path String @db.VarChar(1024)
  description String @default("") @db.Text
  agents Agent[]
  tickets Ticket[]
  @@unique([provider, name])
  @@map("skills")
}
model Rule {
  id Int @id @default(autoincrement())
  name String @unique @db.VarChar(128)
  path String @db.VarChar(1024)
  description String @default("") @db.Text
  agents Agent[]
  tickets Ticket[]
  @@map("rules")
}
```

`Project`: bỏ `repos ProjectRepo[]`, thêm `repos Repo[] @relation("ProjectRepos")`. `defaultRepo` trỏ sang `Repo`. Thêm `specAgentId/devAgentId/testAgentId Int?` (map `*_agent_id`, `onDelete: SetNull`, relation tên `ProjectSpecAgent`...). Giữ `specAgent/devAgent/testAgent` kèm comment `// legacy slug, read only by AgentImportService; drop after import`.

`Ticket`: `repo` trỏ sang `Repo` (`SetNull`). Thêm `specAgentId/devAgentId/testAgentId Int?` (`SetNull`), `skills Skill[]`, `rules Rule[]`, `branch String? @db.VarChar(255)`. Giữ `specAgent/devAgent/testAgent/extraSkills` kèm comment legacy như trên.

`AgentRun`: thêm `agentId Int? @map("agent_id")` (`SetNull`). Giữ `agentSlug`, từ giờ lưu tên agent để xem lịch sử.

Xoá model `ProjectRepo`.

- [ ] **Step 2: Sinh migration** `pnpm --filter daemon db:migrate:dev --name warehouses --create-only`

- [ ] **Step 3: Sửa SQL trước khi apply.** Đặt phần sau giữa đoạn tạo bảng `repos` và đoạn drop `project_repos`/FK cũ:
  - Copy `project_repos` sang `repos`, gộp theo `path` (giữ dòng có id nhỏ nhất). Nếu tên trùng nhưng path khác thì thêm hậu tố `-<project_repos.id>`.
  - Dựng bảng tạm `old_id → new_id`. Remap `tickets.repo_id` và `projects.default_repo_id`. Insert vào bảng nối ngầm Project↔Repo (xem tên bảng và cột A/B trong SQL Prisma sinh ra) một dòng cho mỗi `project_repos` cũ.
  - Thêm `CREATE UNIQUE INDEX "repo_branches_one_checkout_base" ON "repo_branches"("repo_id") WHERE "kind" = 'CHECKOUT_BASE';`
  - FK mới của `tickets.repo_id` và `projects.default_repo_id` chỉ được thêm **sau** bước remap.

- [ ] **Step 4: Apply và generate.** Chạy `pnpm --filter daemon db:migrate:dev` rồi `pnpm --filter daemon db:generate`. Kỳ vọng: không có lời nhắc mất dữ liệu. Kiểm tra bằng `psql`: số dòng trong `repos` bằng số `path` khác nhau trong `project_repos` cũ.

- [ ] **Step 5: Cập nhật entity.** Thêm field mới vào `ProjectEntity`, `TicketEntity`, `AgentRunEntity`. Entity của `Repo*` được tạo ở Task 3, vì script scaffold từ chối thư mục module đã tồn tại. `Agent/Skill/Rule` entity làm ở Task 4/5.

- [ ] **Step 6: Build.** Chạy `pnpm --filter daemon build`. Kỳ vọng: chỉ lỗi ở chỗ còn dùng `projectRepo`/`ProjectRepoEntity` (project-settings controller, tickets service). Hai chỗ này được sửa ở Task 6. Nếu muốn mỗi task để build xanh, làm Task 1 và Task 6 liền nhau trong một nhánh.

### Task 2: Module `git`

**Files:**
- Create (script `daemon-create-module`, tên `git`): `apps/daemon/src/modules/git/services/git.service.ts` + spec. Xoá controller/dto/entity placeholder không dùng.
- Modify: `apps/daemon/src/modules/git/git.module.ts` (export `GitService`)

**Interfaces:**
- Produces:
  - `GitService.branches(cwd: string): Promise<string[]>`: chạy `git branch -a --format=%(refname:short)`, bỏ `origin/HEAD` và `HEAD`, giữ cả `origin/x`, không trùng.
  - `GitService.currentBranch(cwd: string): Promise<string>`: chạy `git rev-parse --abbrev-ref HEAD`.
  - `GitService.isClean(cwd: string): Promise<boolean>`: `git status --porcelain` rỗng.
  - `GitService.assertBranchName(name: string): Promise<void>`: `git check-ref-format --branch <name>`, lỗi thì 400.
  - `GitService.branchExists(cwd: string, name: string): Promise<boolean>`: kiểm `refs/heads/<name>` hoặc `refs/remotes/origin/<name>` qua `git rev-parse --verify --quiet`.
  - `GitService.createBranch(cwd: string, base: string, name: string): Promise<void>`: `git checkout -b <name> <base>`.
  - `GitService.push(cwd: string, name: string): Promise<void>`: `git push -u origin <name>`.
  - Lỗi `ENOENT` (không có git) hoặc "not a git repository" → `BadRequestException('Not a git repository: <cwd>')`. Lỗi git khác ném lại kèm stderr.

- [ ] **Step 1: Viết test fail** trong `git.service.spec.ts`. Mỗi test dùng repo thật tạo bằng `mkdtemp` + `git init -b main` + một commit, dùng `GIT_AUTHOR_*`/`GIT_COMMITTER_*` qua env để không đụng config của user.

```ts
it('lists local branches', ...)            // after createBranch(dir,'main','feat/FMS-1'): branches(dir) contains 'main' and 'feat/FMS-1'
it('creates and checks out a branch', ...) // currentBranch(dir) === 'feat/FMS-1'
it('reports dirty working trees', ...)     // write untracked file → isClean(dir) === false
it('rejects invalid branch names', ...)    // assertBranchName('feat/a b') and ('feat/x..y') reject BadRequestException; ('feat/FMS-1') resolves
it('detects existing branches', ...)       // branchExists(dir,'main') true; ('nope') false
it('rejects non-git directories', ...)     // branches(tmpdirNoGit) rejects BadRequestException
```

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- git.service`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement** bằng `promisify(execFile)`, không dùng `shell: true`.
- [ ] **Step 4: Chạy lại.** Kỳ vọng: PASS.

### Task 3: Module `repositories`

**Files:**
- Create (script, tên `repositories`): controller, service, dtos `create-repo.dto.ts`, `update-repo.dto.ts`, `save-environment.dto.ts`, specs, entities `repo.entity.ts`, `repo-environment.entity.ts`, `repo-branch.entity.ts` (`implements` model, validator giống `ProjectRepoEntity` cũ).
- Modify: `apps/daemon/src/modules/repositories/repositories.module.ts` (imports `GitModule`)
- Create: `apps/daemon/src/common/constants/open-ticket.ts`: `export const OPEN_TICKET = { status: { notIn: ['DONE', 'CANCELED'] } } as const;`
- Move: `apps/daemon/src/modules/projects/utils/repo-path.ts` → `apps/daemon/src/modules/repositories/utils/repo-path.ts` (sửa import ở `agent-runs.service.ts`)

**Interfaces:**
- Consumes: `GitService.branches`.
- Produces: các route `repositories*` theo bảng hợp đồng. `RepositoriesService.usage(id): Promise<IUsage>`. `IUsage` khai báo trong `apps/daemon/src/common/types/usage.ts`, dùng lại ở Task 4 và 5.
- `inUse` = số project + số ticket mở tham chiếu (`ticket.repoId`).
- DTO:
  - `name`: `^[A-Za-z0-9._-]+$`, 1..64 ký tự.
  - `path`: kiểm bằng `assertRepoPath`.
  - `description`: tối đa 2000 ký tự.
  - Environment `name` 1..64, `envFile` 0..255.
  - `branches[].kind` là `BranchKind`.
- P2002 trên `repos.name/path` → 409 `Repo name or path already exists`. P2002 trên `repo_branches_one_checkout_base` → 409 `Only one checkout base branch per repo`.
- `git-branches`: `base` là tên nhánh `CHECKOUT_BASE` của repo, hoặc null. `data` là danh sách nhánh đã lọc theo `keyword` (không phân biệt hoa thường).

- [ ] **Step 1: Viết test fail** (`repositories.service.spec.ts`, Prisma mock):

```ts
it('blocks delete when an open ticket or project uses the repo')   // count → 1 ⇒ ConflictException; prisma.repo.delete not called
it('ignores closed tickets when counting usage')                  // assert ticket count where includes OPEN_TICKET
it('maps the second checkout base to 409')                        // tx rejects {code:'P2002', meta:{target:'repo_branches_one_checkout_base'}} ⇒ ConflictException('Only one checkout base branch per repo')
it('replaces branches on environment update in one transaction') // deleteMany({where:{environmentId}}) then createMany with repoId set
it('returns git branches with the checkout base')                 // git.branches → ['main','develop','origin/develop'], base branch 'develop', keyword 'dev' ⇒ {data:[{label:'develop'},{label:'origin/develop'}], base:'develop'}
```

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- repositories`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement** service và controller (`@ApiTags('repositories')`). Ghi môi trường và nhánh trong `prisma.$transaction`.
- [ ] **Step 4: Chạy lại.** Kỳ vọng: PASS.

### Task 4: Module `skills` và `rules`

**Files:**
- Create (script, tên `skills` và `rules`): controller, service, dto, entity, spec cho mỗi module.

**Interfaces:**
- Produces: route theo bảng hợp đồng.
  - `SkillsService.list({ keyword?, provider? })`, `RulesService.list({ keyword? })` trả `{ data }`.
  - `inUse` = số agent + số ticket mở tham chiếu.
  - Path: phải tuyệt đối. Skill path phải là thư mục, rule path phải là file. Riêng skill import có `path = ''`: PATCH bắt path hợp lệ, còn list vẫn trả về bình thường.
  - Command của skill: `^[/$][A-Za-z0-9:._-]+$`.

- [ ] **Step 1: Viết test fail:**

```ts
it('rejects a relative skill path')                        // create({path:'skills/a',...}) ⇒ BadRequestException
it('rejects a rule path that is a directory')              // create({path: tmpdir()}) ⇒ BadRequestException
it('blocks deleting a skill used by an agent')             // agent count 1 ⇒ ConflictException
it('filters skills by provider and keyword')               // findMany where {provider:'codex', name:{contains:'test', mode:'insensitive'}}
```

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- skills rules`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Chạy lại.** Kỳ vọng: PASS.

### Task 5: `agent-profiles` sang DB, avatar và import dữ liệu cũ

**Files:**
- Modify: `apps/daemon/src/modules/agent-profiles/services/agent-profiles.service.ts` (viết lại), `controllers/agent-profiles.controller.ts`, `agent-profiles.module.ts`
- Create: `services/agent-import.service.ts` + spec, `dtos/save-agent.dto.ts`, `entities/agent.entity.ts`
- Modify: `apps/daemon/src/configuration/env.validation.ts` (thêm `MEMBERS_DIR?`), `apps/daemon/.env.example`

**Interfaces:**
- Produces:
  - `AgentProfilesService.list({ keyword?, role? }): Promise<{ data: AgentListItem[] }>`
  - `get(id: number): Promise<Agent & { skills: Skill[]; rules: Rule[] }>`
  - `assertRole(id: number | null | undefined, role: AgentRole): Promise<void>`: 400 nếu không tồn tại hoặc sai role
  - `create`, `update`, `remove`, `usage`, `avatarPath(id): Promise<string>`
  - Giữ `parseAgentProfile(slug, source)` để import dùng.
- `AgentImportService.onModuleInit()` chạy `importLegacy()` và chỉ log lỗi, không làm daemon dừng.
  - `importLegacy(): Promise<{ created: number }>`
  - `rolesFor(slug, usage): AgentRole[]`: pure function export. spec → BA, dev → DEV, test → QC. Không dùng ở đâu thì `['DEV']`.
- Kiểm tra lúc save: `path` phải là thư mục tuyệt đối có `AGENT.md`. `skillIds` phải cùng provider với agent. `provider` thuộc 4 giá trị cho phép. `allowedTools[]` khớp `^[A-Za-z0-9_*:().-]+$`.

- [ ] **Step 1: Viết test fail:**

```ts
// agent-import.service.spec.ts
it('infers one role per usage')  // rolesFor('dev-opus', {spec:[], dev:[1], test:[]}) → ['DEV']; unused → ['DEV']; spec+test → ['BA','QC']
it('creates one agent per role and points references at it') // file used as spec and dev ⇒ agents 'Dev Opus (BA)','Dev Opus (DEV)'; project.update specAgentId/devAgentId set to matching ids
it('writes AGENT.md once and keeps the original file')        // members/<slug>/AGENT.md == body; second run with agents present ⇒ created 0, file untouched; source file still exists
it('imports legacy skill names without a path')               // frontmatter skills 'ponytail' for codex ⇒ skill {name:'ponytail', provider:'codex', command:'$ponytail', path:''}
it('skips when the agents table is not empty')                // agent.count 1 ⇒ no reads of AGENTS_DIR
// agent-profiles.service.spec.ts
it('rejects an agent folder without AGENT.md')                // tmp dir empty ⇒ BadRequestException
it('rejects skills of another provider')                      // claude agent, skill provider codex ⇒ BadRequestException
it('assertRole rejects a DEV agent for the spec step')        // agent role DEV, assertRole(id,'BA') ⇒ BadRequestException
```

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- agent-profiles agent-import`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** Import ghi file trước, rồi ghi DB trong một `$transaction`: tạo skill, tạo agent, set id cho project và ticket theo slug. `members/<slug>/` chỉ được tạo khi chưa có.
- [ ] **Step 4: Thêm route avatar.** `@Get(':id/avatar')` trả `StreamableFile` với `type: 'image/png'`, 404 khi không có file. Route này được đặt `@AllowWithoutClientHeader()` vì `<img>` không gửi header. Kiểm tra guard có áp cho GET không. Nếu không thì bỏ decorator.
- [ ] **Step 5: Chạy lại.** Kỳ vọng: PASS. `pnpm --filter daemon build` vẫn còn lỗi ở chỗ gọi `profiles.get(slug)`, sửa ở Task 7.

### Task 6: Project settings và ticket dùng id

**Files:**
- Modify: `apps/daemon/src/modules/projects/controllers/project-settings.controller.ts` (bỏ các route repo, PATCH settings mới), `dtos/update-project-settings.dto.ts`. Xoá `dtos/create-repo.dto.ts`, `dtos/update-repo.dto.ts`.
- Modify: `apps/daemon/src/modules/tickets/services/tickets.service.ts` (`link`, `update`, `detail`, `board`, `repoConflicts`), `dtos/update-ticket.dto.ts`
- Modify: các spec tương ứng

**Interfaces:**
- Consumes: `AgentProfilesService.assertRole`.
- Produces:
  - Settings GET/PATCH theo bảng hợp đồng.
  - `link()` và đổi project copy `defaultRepoId`, `specAgentId`, `devAgentId`, `testAgentId` của project vào ticket.
  - `TicketDetail` thêm:
    - `specAgent/devAgent/testAgent: AgentRef | null`
    - `skills: {id,name,provider,command}[]`, `rules: {id,name}[]`
    - `branch: string | null`
    - `repos` lấy từ các repo của project
  - Board item thêm `branch: string | null`, `repoId: number | null` và `agent: { id: number; name: string } | null` (agent của run đang `RUNNING`, lấy run mới nhất).
  - `update()`:
    - đổi `repoId` khi ticket đã có `branch` thì đặt `branch = null`
    - `skillIds/ruleIds` dùng `set`
    - giữ các khoá cũ: đổi repo bị khoá khi agent đang chạy, đổi agent bị khoá khi bước đó đang chạy

- [ ] **Step 1: Sửa và thêm test:**

```ts
it('rejects a default repo that is not among repoIds')          // PATCH {repoIds:[1], defaultRepoId:2} ⇒ BadRequestException
it('rejects a QC agent as the spec agent')                       // assertRole rejects ⇒ project.update not called
it('copies project default agents by id when linking')           // ticket.updateMany data has specAgentId/devAgentId/testAgentId
it('clears the saved branch when the repo changes')              // ticket.branch 'feat/FMS-1', update repoId 5 ⇒ data.branch === null
it('sets skills and rules on update')                            // data.skills = {set:[{id:3}]}, data.rules = {set:[{id:4}]}
it('reports the running agent on board items')                   // run RUNNING with agent {id:7,name:'Dev'} ⇒ item.agent {id:7,name:'Dev'}
```

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- project-settings tickets.service`. Kỳ vọng: FAIL rồi PASS sau khi implement.
- [ ] **Step 3: Implement**, rồi chạy lại đến khi PASS.

### Task 7: Agent runs: prompt, cờ CLI và kiểm tra nhánh

**Files:**
- Modify: `apps/daemon/src/modules/agent-runs/services/agent-runs.service.ts` (`start`, `reusablePane`), `utils/prompt-parts.ts`, `utils/agent-args.ts`, `utils/spec-prompt.ts` (type `SpecPromptInput`), các spec
- Modify: `apps/daemon/src/modules/agent-runs/agent-runs.module.ts` (import `GitModule`)

**Interfaces:**
- Consumes: `AgentProfilesService.get(id)`, `GitService.currentBranch`.
- Produces:
  - `PromptBase.profile` có type `RunAgent = { id; name; provider; model; effort; path; allowedTools; skills: {command,description,provider}[]; rules: {path}[] }`.
  - `PromptBase.ticket` có thêm `skills`, `rules`.
  - `buildAgentArgs(agent: RunAgent, runsDir: string): string[]`.
- `promptHeader` trả về các dòng sau, theo đúng thứ tự:
  1. `Read and follow your role description: <path>/AGENT.md`
  2. `extraInstructions`
  3. `Rules (read each before starting):` kèm các dòng `- <path>`. Gộp rule của agent và ticket, không trùng.
  4. `Skills you can use:` kèm các dòng `- <command>: <description>`. Gộp skill của agent và skill của ticket cùng provider, không trùng.
  5. Khối ticket và dòng `Repository:` giữ nguyên như hiện tại.

  Dòng nào rỗng thì bỏ.
- Trong `start()`, trước khi tạo run:
  - Không có `<agent.path>/AGENT.md` → 400 `Agent folder is missing AGENT.md: <path>`.
  - Bước `DEV` hoặc `TEST`, khi `ticket.branch` không null: `currentBranch(repo.path) !== ticket.branch` → 409 `Repo <path> is on <current>, expected <branch>`.
  - `ticket.branch` null thì bỏ qua kiểm tra, kèm comment `// shortcut: legacy tickets have no saved branch; drop once none are in progress`.
- Run lưu `agentId` và `agentSlug = agent.name`. `reusablePane` so sánh `agentId`.

- [ ] **Step 1: Viết test fail:**

```ts
it('points the prompt at AGENT.md, rule paths and same-provider skills') // codex agent; ticket skill provider claude excluded; lines contain '/x/members/dev/AGENT.md', '- /rules/a.md', '- $ponytail: ...'
it('passes allowed tools to claude and copilot only')                    // claude ⇒ ['--allowedTools','Bash,Edit']; copilot ⇒ ['--allow-tool','Bash','--allow-tool','Edit']; codex ⇒ no tool flags
it('refuses to start when AGENT.md is missing')                          // herdr.createAgent not called
it('refuses DEV when the repo is on another branch')                     // currentBranch 'main', ticket.branch 'feat/FMS-1' ⇒ ConflictException
it('skips the branch check for legacy tickets without a branch')         // ticket.branch null ⇒ starts
it('reuses the pane only for the same agent id')
```

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- agent-runs prompt-parts agent-args`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Chạy** `pnpm --filter daemon test`, `pnpm --filter daemon build`. Kỳ vọng: tất cả PASS, build sạch.

### Task 8: Tạo nhánh khi vào In Progress

**Files:**
- Modify: `apps/daemon/src/modules/tickets/dtos/move-ticket.dto.ts`, `services/tickets.service.ts` (`move`), `tickets.module.ts` (import `GitModule`), các spec

**Interfaces:**
- Consumes: các method của `GitService`.
- Produces: `TicketsService.move(id, to, branch?: { base: string; name: string; push: boolean })`. Khi `to === 'IN_PROGRESS'` và `ticket.branch === null`, xử lý theo thứ tự:
  1. Không có `branch` → 409 với message `Branch required`. Web dựa vào board item `branch === null` để mở popup trước, nên đây chỉ là chốt chặn.
  2. Ticket chưa có repo → 400.
  3. Có ticket khác đang có run `RUNNING` với cùng `repoId` → 409 `Repo is busy with <keys>`.
  4. `assertBranchName(name)`. `isClean` false → 409 `Repo has uncommitted changes`. `branchExists(name)` → 409 `Branch <name> already exists`.
  5. `createBranch(base, name)`, rồi lưu `ticket.branch = name`.
  6. Nếu `push`: lỗi push → 502 `Branch created but push failed: <stderr>`. Ticket giữ nhánh, không đổi cột.
  7. Gọi `enterStatus(...)` như hiện tại. Từ đây agent Dev và Testing chạy, và cả hai đều sau checkout.

  Khi ticket đã có `branch` thì chạy như cũ, bỏ qua `branch` trong body.
- DTO: `branch` optional, kiểu nested `{ base: string 1..255, name: string 1..255, push: boolean }`.

- [ ] **Step 1: Viết test fail:**

```ts
it('requires a branch on the first move to In Progress')   // ticket.branch null, no body.branch ⇒ ConflictException('Branch required'); git.createBranch not called
it('blocks when another ticket runs an agent on the repo')  // ⇒ ConflictException; createBranch not called
it('blocks a dirty repo and an existing branch')            // isClean false ⇒ 409; branchExists true ⇒ 409
it('creates the branch before starting agents')             // call order: git.createBranch < flow.startDevelopment; ticket.update data.branch 'feat/FMS-1'
it('keeps the branch and does not move when push fails')    // git.push rejects ⇒ 502 (BadGatewayException); ticket.branch saved; status unchanged; startDevelopment not called
it('moves without git when the ticket already has a branch')
```

- [ ] **Step 2: Chạy** `pnpm --filter daemon test -- tickets.service`. Kỳ vọng: FAIL.
- [ ] **Step 3: Implement.** Bỏ endpoint `repo-conflicts` và cảnh báo phía web chỉ khi không còn chỗ nào dùng. Bước In Spec vẫn dùng cảnh báo cũ, nên giữ endpoint.
- [ ] **Step 4: Chạy** `pnpm --filter daemon test`, `pnpm --filter daemon build`, `pnpm --filter daemon check`. Kỳ vọng: PASS.

### Task 9: Web: module `warehouse`, layout, route, Skill và Rule

**Files:**
- Create (script `web-create-module`, tên `warehouse`): `apps/web/src/modules/warehouse/`
  - `WarehouseLayout.tsx`: `TmnTabNav` với 5 tab, `<Outlet />`
  - `WarehouseTable.tsx`: bảng chung
  - `UsagePanel.tsx`
  - `SkillPage.tsx`, `SkillDialog.tsx`, `RulePage.tsx`, `RuleDialog.tsx`
  - `hooks.ts`, `constants.ts`, `types.ts`, `error.ts`, `index.ts`
- Create routes:
  - `apps/web/src/routes/_app/warehouse.tsx` (layout)
  - `warehouse.tickets.ts` (dùng `TicketStorePage` từ `#modules/tickets`)
  - `warehouse.repositories.ts`, `warehouse.agents.ts`, `warehouse.skills.ts`, `warehouse.rules.ts`
- Modify: `apps/web/src/routes/_app/tickets.ts` (`beforeLoad` redirect sang `/warehouse/tickets`), `src/constants/routes.ts`, `src/constants/menu.ts` (mục `warehouse`, icon `Warehouse`), file i18n `vi`/`en`
- Run: `pnpm --filter web generate-routes`

**Interfaces:**
- Produces, để Task 10 và 11 dùng:
  - `WarehouseTable<T extends { id: number; inUse: number }>({ columns: { key: string; title: string; render: (row: T) => ReactNode }[]; rows: T[]; onEdit: (row: T) => void; onDelete: (row: T) => void; addLabel: string; onAdd: () => void })`
    - Nút xoá: `disabled={row.inUse > 0}`, `title` giải thích lý do.
    - Bảng dùng `<table>` semantic với class token theme, vì uikit không có Table.
  - `UsagePanel({ usage: IUsage })`
    - Link project: `/workspaces/$workspaceId/projects/$` với `_splat: String(id)`.
    - Link ticket: `/workspaces/$workspaceId/projects/$` với `search: { ticket: id }`. Ticket có `projectId` null (đang ở Kho ticket) thì link sang `/warehouse/tickets`.
    - Link agent: mở popup agent.
  - `useWarehouseList<T>(kind: 'repositories'|'agent-profiles'|'skills'|'rules', params?)`, `useWarehouseUsage(kind, id)`, `useWarehouseMutation()`. Mutation invalidate theo `kind`.
  - Popup mở bằng `UIUtils.popup.open({ name, size: 'lg', renderer, params })`, giống `ProjectBoard`.
- Modify: `apps/web/src/modules/projects/ProjectPage.tsx`: đọc search `ticket`, nếu có thì mở `TicketDialog`. Làm theo cách `openTicket` đang có trong `ProjectBoard`: export một helper `openTicketDialog(ticketId)` từ `#modules/tickets`.

- [ ] **Step 1: Scaffold** bằng `python3 .agents/skills/web-create-module/scripts/create_module.py warehouse`, chạy từ `apps/web`.
- [ ] **Step 2: Implement** layout, route, menu, bảng, usage, và hai trang Skill, Rule. Form Skill: tên, provider (`TmnInput.Select`), lệnh, path, mô tả. Form Rule: tên, path, mô tả.
- [ ] **Step 3: Verify.** Chạy 4 lệnh web ở Global Constraints. Kỳ vọng: sạch. Mở `/warehouse/skills` bằng skill `web-browser-testing`: thêm, sửa, xoá một skill. Nút xoá bị mờ khi skill đang được một agent dùng (cần Task 11 để thử trường hợp này. Trước đó chỉ cần kiểm tra trạng thái `inUse = 0`).

### Task 10: Web: Kho Repository

**Files:**
- Create: `apps/web/src/modules/warehouse/RepositoryPage.tsx`, `RepositoryDialog.tsx`, `EnvironmentForm.tsx`
- Modify: `types.ts`, `constants.ts`, i18n

**Interfaces:**
- Consumes: `WarehouseTable`, `UsagePanel`, các hook ở Task 9.
- Cột bảng: Tên, Path, Môi trường (tên, nối bằng `, `), Mô tả, Cập nhật (`formatDate`), Action.
- Popup gồm hai cột:
  - Trái: form repo, rồi danh sách môi trường. Mỗi môi trường có nút sửa và xoá. `EnvironmentForm` gồm tên, `.env`, và danh sách nhánh `{ name, kind }` có thể thêm và bớt dòng.
  - Phải: `UsagePanel`.
- Lỗi 409 "Only one checkout base branch per repo" hiện ở `TmnCallout` của form môi trường.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** Chạy 4 lệnh web. Dùng `web-browser-testing`:
  - Tạo repo, thêm 2 môi trường.
  - Đánh dấu nhánh gốc ở môi trường thứ hai trong khi môi trường thứ nhất đã có nhánh gốc → thấy lỗi.
  - Repo đang được project dùng → nút xoá mờ.

### Task 11: Web: Kho Agent

**Files:**
- Create: `apps/web/src/modules/warehouse/AgentPage.tsx`, `AgentDialog.tsx`, `AgentAvatar.tsx`
- Modify: `index.ts` (export `AgentAvatar` để `tickets` dùng), i18n

**Interfaces:**
- Produces: `AgentAvatar({ agent: { id: number; name: string } | null; size?: '1'|'2'|'3' })`. Dùng `TmnAvatar` với `src` = endpoint avatar, fallback là chữ cái đầu của tên.
- Form:
  - tên, role (`TmnInput.Select`), provider, model, effort, path, description
  - allowed tools: `TmnAutocomplete multiple` không có nguồn API, cho gõ tự do. Nếu uikit không cho tạo option mới thì dùng TextField, phân tách bằng dấu phẩy
  - skills: `TmnAutocomplete multiple`, `apiUrl` là endpoint skills, `apiParams={{ provider }}`
  - rules: `TmnAutocomplete multiple`, `apiUrl` là endpoint rules
- Cột bảng: Avatar, Tên, Role, Provider (Model), Mô tả, Action.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** Chạy 4 lệnh web. Dùng `web-browser-testing`:
  - Tạo agent DEV trỏ vào `members/<slug>` đã import → thấy avatar hoặc chữ cái đầu.
  - Đổi provider → ô skill chỉ còn gợi ý skill cùng provider.

### Task 12: Web: project settings và ticket dùng kho

**Files:**
- Modify: `apps/web/src/modules/projects/ProjectSettings.tsx`, `DefaultsForm.tsx`, `hooks.ts`, `types.ts`, `constants.ts`, `utils.ts`. Xoá `RepoForm.tsx`, `RepoList.tsx`, `useAgentProfiles`.
- Modify: `apps/web/src/modules/tickets/TicketSettingsForm.tsx`, `TicketDialog.tsx`, `ProjectBoard.tsx` (bỏ prop `profiles`), `BoardCard.tsx`, `types.ts`, `utils.ts` (`toTicketUpdate`), i18n

**Interfaces:**
- Consumes: `AgentAvatar` từ `#modules/warehouse`, `AgentRef`, các endpoint ở bảng hợp đồng.
- `DefaultsForm`:
  - repos: `TmnAutocomplete multiple`, `apiUrl` là endpoint repositories
  - repo mặc định: `TmnInput.Select` trong số repo đã chọn
  - 3 agent: `TmnAutocomplete`, `apiParams={{ role }}`, theo mapping ở Global Constraints
- `TicketSettingsForm`:
  - repo: giữ Select theo `ticket.repos`
  - 3 agent: Autocomplete lọc role, có `AgentAvatar` cạnh mỗi field
  - skills: Autocomplete multiple, label `${name} (${provider})`
  - rules: Autocomplete multiple
  - Bỏ field `extraSkills` và giữ `extraInstructions`
  - Hiện `ticket.branch` dạng chỉ đọc khi có
- `BoardCard`: thêm `AgentAvatar` khi `ticket.agent` khác null.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** Chạy 4 lệnh web. Dùng `web-browser-testing`:
  - Chọn 2 repo và repo mặc định cho project, lưu, tải lại trang → giá trị vẫn còn.
  - Ô agent bước Spec chỉ gợi ý agent BA.
  - Card có agent đang chạy thì hiện avatar.

### Task 13: Web: popup tạo nhánh

**Files:**
- Create: `apps/web/src/modules/tickets/BranchDialog.tsx`
- Modify: `ProjectBoard.tsx` (`onDragEnd`), `hooks.ts` (`useMoveTicket` nhận `branch?`, thêm `useGitBranches(repoId)`), `types.ts` (`IMoveTicket.branch?`, `IBoardTicket.branch`, `IBoardTicket.repoId`, `IBoardTicket.agent`), `constants.ts` (`BRANCH_TYPES = ['feat','bug','hotfix','refactor','chore','docs','test']`), i18n

**Interfaces:**
- Consumes: `GET repositories/:id/git-branches`, `POST tickets/:id/move` với `branch`.
- Luồng:
  - Kéo vào `IN_PROGRESS` khi `ticket.branch === null` → mở popup `BranchDialog({ ticketId, jiraKey, repoId })` thay vì gọi move. `repoId` lấy từ board item (Task 6).
  - Field nhánh gốc là `TmnAutocomplete`, `apiUrl` là git-branches, mặc định là `base`.
  - Field nhánh đích: `TmnInput.Select` (loại) + `/` + `TmnInput.TextField` (tên, mặc định `jiraKey`).
  - Hai nút "Tạo nhánh" (`push: false`) và "Tạo nhánh và Push" (`push: true`), khoá khi pending.
  - Lỗi API hiện `TmnCallout` trong popup, popup không đóng. Thành công thì đóng popup.
  - Huỷ thì không gọi API.
  - Repo chưa chọn → popup hiện callout yêu cầu chọn repo trong dialog ticket.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** Chạy 4 lệnh web. Dùng `web-browser-testing` trên một repo thử (một git repo tạm, không phải repo thật):
  - Kéo ticket đã duyệt spec sang In Progress → popup hiện, nhánh gốc đúng.
  - Tạo nhánh → ticket sang In Progress, `git -C <repo> branch --show-current` là `feat/<KEY>`.
  - Làm repo bẩn rồi thử lại với ticket khác → thấy lỗi trong popup.

### Task 14: Kiểm tra toàn bộ

- [ ] **Step 1:** Chạy `python3 .agents/skills/repo-quality-checks/scripts/check.py`. Kỳ vọng: sạch.
- [ ] **Step 2:** Chạy `pnpm --filter daemon test` và `pnpm --filter daemon test:e2e` (khi có Postgres local). Kỳ vọng: PASS.
- [ ] **Step 3:** Khởi động daemon trên DB đã có dữ liệu cũ. Kỳ vọng:
  - log báo số agent đã import
  - `members/<slug>/AGENT.md` tồn tại cho mỗi file cũ
  - project và ticket cũ vẫn hiện đúng repo và agent trong UI
