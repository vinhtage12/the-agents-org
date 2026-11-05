# Kho (Warehouses): Repository, Agent, Skill, Rule

Ngày: 2026-11-02 - Trạng thái: bản nháp, chờ chủ dự án duyệt
Nguồn: `docs/raw-requirements/warehouses.md`. Tiếp nối `2026-10-30-kanban-board-design.md`.

## 1. Mục đích

Phase kanban trước làm chưa đủ. Repo đang thuộc riêng từng project. Agent là file `.md` rời trong `~/.the-agents-org/agents/`. Skill là chuỗi tên gõ tay, còn rule nằm lẫn trong phần mô tả agent. Chủ dự án muốn quản lý những thứ này như tài sản dùng chung: thêm, sửa, xoá trên UI, biết thứ gì đang dùng chúng, và chọn chúng ở project và ticket.

Phase này cũng thay đổi một quyết định cũ: **app bắt đầu tạo nhánh git** khi ticket vào In Progress lần đầu. Phase trước đã chốt app không đụng vào git.

Phần "Jira sprint" (nguồn spec local, hybrid, ticket tự tạo, sprint) là dự án riêng, làm sau phase này.

## 2. Mục tiêu, không làm, và thất bại

**Mục tiêu**
- Menu **Kho** có 5 tab: Ticket, Repository, Agent, Skill, Rule.
- Mỗi kho có trang danh sách, thêm, sửa, xoá, và biết những gì đang dùng từng item.
- Project và ticket chọn repo và agent từ kho. Agent và ticket chọn skill và rule từ kho.
- Kéo ticket sang In Progress lần đầu sẽ mở popup tạo nhánh. Agent Dev chỉ chạy sau khi checkout xong.
- Card ticket hiện avatar của agent đang chạy.
- Dữ liệu cũ (repo, agent file, tham chiếu bằng slug) được tự chuyển sang kho mới.

**Không làm**
- Nhánh "PR vào" chỉ được lưu lại. App chưa tạo PR.
- File `.env` chỉ lưu **tên file**. App không đọc hay dùng file này.
- Sprites chỉ nằm trong thư mục agent. App chưa hiển thị sprites.
- App không cài, không copy và không kiểm tra skill. Skill phải được cài sẵn cho provider.
- App không nhồi nội dung file rule, skill hay mô tả agent vào prompt. Prompt chỉ trỏ đường dẫn.

**Thất bại dù vẫn "chạy được"**
- Xoá một item đang được dùng, làm project, ticket hoặc agent bị gãy tham chiếu.
- Agent Dev chạy trước khi nhánh được tạo và checkout xong, hoặc chạy trên nhánh sai.
- Tạo nhánh làm mất thay đổi chưa commit, hoặc ghi đè một nhánh đã có.
- Nâng cấp làm mất agent, repo, hoặc agent đã chọn cho project và ticket.

## 3. Ràng buộc từ hệ thống hiện có

- Schema hiện tại: `ProjectRepo` (thuộc 1 project, cascade), `Project.defaultRepoId`, `Project.specAgent/devAgent/testAgent` và `Ticket.specAgent/devAgent/testAgent` là slug dạng chuỗi, `Ticket.extraSkills String[]`, `Ticket.extraInstructions`, `AgentRun.agentSlug`.
- `AgentProfilesService` đọc file từ `AGENTS_DIR` (mặc định `~/.the-agents-org/agents/`), frontmatter gồm `name, provider, model, effort, skills`, phần thân là chỉ dẫn.
- Prompt được dựng trong `agent-runs/utils/prompt-parts.ts` (`promptHeader`), cờ CLI theo provider trong `agent-runs/utils/agent-args.ts`.
- Pane được tái dùng nếu cùng agent và cùng repo (`AgentRunsService.reusablePane`, so sánh `agentSlug`).
- Trang Kho ticket hiện tại là route `/tickets` (`TicketStorePage`).
- UI dùng kit `@truyenmoinhu/uikit` (`TmnSelect`, `TmnAutocomplete` có `apiParams`, `TmnInput.TextField`...).

## 4. Những gì chủ dự án đã quyết

### 4.1 Menu Kho và layout chung
- Menu **Kho**, bên trong có 5 tab: **Ticket** (chuyển trang Kho ticket hiện có vào đây, giữ nguyên chức năng), **Repository**, **Agent**, **Skill**, **Rule**.
- 4 kho còn lại dùng **một layout chung**: trang chính là bảng danh sách. Mỗi dòng có cột action gồm icon button **sửa** và **xoá**.
- Nút **xoá bị disable** khi có ít nhất một thứ đang tham chiếu item đó.
- Nút **sửa** mở popup chi tiết của item, kèm phần **"đang được dùng bởi"**: loại gì, bao nhiêu, và link để nhảy nhanh tới từng thứ.

### 4.2 Kho Repository
- Mỗi repo có: **tên**, **absolute path**, **mô tả**, **created at**, **updated at**, và danh sách **môi trường**.
- **Môi trường** nằm ở bảng riêng (repo 1..n môi trường). Mỗi môi trường có: **tên**, **tên file .env** (chỉ lưu), và danh sách **nhánh**.
- Mỗi nhánh được đánh dấu đúng một trong ba loại: **gốc checkout** (nhánh để checkout khi bắt đầu làm feature), **PR vào** (nhánh để PR khi xong feature), **không gì**.
- **Cả repo chỉ có một nhánh "gốc checkout"**, tính trên tất cả môi trường. App chặn khi đánh dấu nhánh thứ hai.
- Môi trường và nhánh được thêm, sửa, xoá **ngay trong popup sửa repo**.
- **Project n..n repo.** Project chọn nhiều repo bằng `TmnAutocomplete` lấy từ kho, và vẫn có **một repo mặc định**. Ticket chọn repo trong số repo của project, như hiện tại.

### 4.3 Popup tạo nhánh khi vào In Progress
- Khi kéo ticket sang In Progress, một popup mở ra với hai field:
  - **Nhánh gốc:** `TmnAutocomplete`. Mặc định là nhánh "gốc checkout" của repo của ticket. Gợi ý lấy từ **nhánh git thật của repo, cả local và remote**.
  - **Nhánh đích:** hiện dạng `[loại]/[tên]`. Phần loại là `TmnSelect` (feat, bug, hotfix, refactor, ...). Phần tên là `TmnInput.TextField`, mặc định là key ticket (ví dụ `FMS-12345`).
- Hai nút: **"Tạo nhánh"** và **"Tạo nhánh và Push"**. Chủ dự án chỉnh tên nếu cần rồi bấm. App tạo nhánh đích từ nhánh gốc và checkout nó trong repo của ticket. Nút thứ hai push thêm lên remote.
- **Agent Dev chỉ bắt đầu sau khi checkout xong.**
- **Hai ticket chung một thư mục repo: chặn hẳn.** Không cho tạo nhánh khi một ticket khác đang có agent chạy trong cùng thư mục repo (thay cho cảnh báo của phase trước, ở bước này). Trước **mỗi** lần chạy agent Dev hoặc Testing, app kiểm tra repo đang ở đúng nhánh đã lưu của ticket. Sai nhánh thì không chạy và báo cho chủ dự án. App không tự checkout lại.

### 4.4 Kho Agent
- Agent chuyển từ file vào **database**. Mỗi agent có:
  - **tên**
  - **role**: BA, DEV, QC, File Processor
  - **provider**, **model**, **effort**
  - **absolute path tới thư mục agent**
  - **description**: một câu ngắn để biết agent làm gì khi chọn
  - **allowed tools**: danh sách tên tool, truyền vào cờ cho phép tool của provider lúc khởi động (với Claude là `--allowedTools`) để agent không phải hỏi quyền
  - **skill set**: nhiều skill từ kho
  - **rule set**: nhiều rule từ kho
- **Thư mục agent** dùng **tên file cố định**, gồm file mô tả hành vi, avatar và sprites. Các thư mục này nằm trong chính repo này, ở thư mục **`members/`** ở gốc repo.
- Khi agent chạy, prompt khởi đầu **trỏ tới file mô tả** trong thư mục agent. Ticket chọn agent nào thì làm việc theo file mô tả của agent đó.
- **Avatar** hiện trên ticket, để chủ dự án biết agent nào đang làm ticket nào.
- Project và ticket chọn agent cho từng bước bằng `TmnAutocomplete`, lọc theo role qua `apiParams`.

### 4.5 Kho Skill
- Mỗi skill có: **tên**, **provider**, **lệnh gọi** (ví dụ `/abc` cho Claude, `$abc` cho Codex), **absolute path tới thư mục skill**, **mô tả**.
- Agent và ticket tham chiếu skill theo quan hệ 1..n.
- Khi agent chạy, prompt **liệt kê lệnh kèm mô tả** của các skill.

### 4.6 Kho Rule
- Mỗi rule có: **tên**, **absolute path tới file rule**, **mô tả**.
- Agent và ticket tham chiếu rule theo quan hệ 1..n.
- Khi agent chạy, prompt **liệt kê đường dẫn** các file rule. Chủ dự án đã chọn cách này thay vì nạp nội dung rule vào system prompt.

### 4.7 Chuyển dữ liệu cũ
- Khi nâng cấp, app **tự chuyển** dữ liệu cũ sang kho mới. Không bắt chủ dự án nhập lại.
- Các agent file trong `~/.the-agents-org/agents/` được chuyển thành thư mục trong `members/` và thành agent trong database.

## 5. Các quyết định do người viết tài liệu đưa ra (chủ dự án đã nghe, chưa phản đối)

- **Bảng nhánh riêng:** môi trường 1..n nhánh.
- **Mapping role theo bước:** bước Spec chọn agent role BA, Dev chọn DEV, Testing chọn QC. File Processor chỉ có trong danh sách role, để dành cho dự án Sprint.
- **Tên file cố định trong thư mục agent:** `AGENT.md` (mô tả hành vi), `avatar.png`, thư mục `sprites/`. `AGENT.md` không có frontmatter, vì các field đã nằm trong database.
- **Thiếu `avatar.png`:** hiện chữ cái đầu của tên agent.
- **Avatar trên board:** card hiện avatar của agent đang chạy ở bước hiện tại. Dialog ticket hiện avatar của agent cho từng bước. Card vẫn gọn như mockup A cũ: mã, tên, nhãn trạng thái, thêm avatar.
- **Rule không gắn provider**, vì file rule thì agent nào cũng đọc được.
- **Ô chọn skill của agent** chỉ hiện skill cùng provider với agent. Ô chọn skill của ticket lọc theo provider của agent ở bước tương ứng (xem 6).
- **Ticket giữ ô "chỉ dẫn thêm"** (`extraInstructions`, văn bản tự do). `extraSkills` dạng chuỗi được thay bằng skill từ kho.
- **Điều kiện khoá nút xoá:**
  - Repo: có project hoặc ticket chưa đóng đang tham chiếu.
  - Agent: có project hoặc ticket chưa đóng đang tham chiếu.
  - Skill và rule: có agent hoặc ticket chưa đóng đang tham chiếu.
  - Lịch sử `AgentRun` không tính là tham chiếu.
- **Popup tạo nhánh chỉ hiện lần đầu** ticket vào In Progress. Các lần quay lại In Progress (vòng sửa lỗi, feedback từ In Review) không hiện, vì nhánh đã có.
- **Bấm Huỷ** trong popup: ticket ở lại cột cũ, không có agent nào chạy.
- **Nhánh đích đã tồn tại** (local hoặc remote): báo lỗi trong popup, không ghi đè, để chủ dự án đổi tên.
- **Repo có thay đổi chưa commit** (working tree bẩn): chặn tạo nhánh và báo cho chủ dự án. App không stash và không reset.
- **Lưu nhánh của ticket:** ticket lưu tên nhánh đã tạo, hiện trong dialog ticket.
- **Field path của agent** vẫn là đường dẫn tuyệt đối, dù thư mục nằm trong repo. Đổi chỗ repo thì phải sửa lại path.
- **Thư mục agent do chủ dự án tự tạo và quản lý** (tạo `AGENT.md`, đặt `avatar.png`, `sprites/`). App chỉ lưu path, không tạo thư mục, không sửa `AGENT.md`, không có upload. Ngoại lệ duy nhất là bước chuyển dữ liệu cũ. `members/` được commit vào git như mọi thư mục khác.
- **Role khi chuyển dữ liệu:** mỗi agent có đúng một role. Role được suy từ chỗ agent đang được dùng (spec → BA, dev → DEV, test → QC). Nếu một file được dùng cho nhiều bước, tạo một agent cho mỗi role (cùng thư mục, tên thêm hậu tố role) và trỏ từng tham chiếu tới đúng bản. File không được dùng ở đâu thì nhận role DEV, chủ dự án sửa sau.
- **"Lần đầu vào In Progress"** nghĩa là ticket chưa có nhánh được lưu. Ticket cũ đã qua In Progress sẽ thấy popup ở lần vào In Progress kế tiếp.
- **Đổi repo của ticket** khi đã có nhánh: vẫn cho đổi (khi không có agent chạy), app xoá nhánh đã lưu, nên lần vào In Progress kế tiếp sẽ hiện popup lại.
- **Agent Testing cũng chờ checkout:** ở lần đầu vào In Progress, cả Dev và Testing (viết test case) chỉ khởi động sau khi checkout xong.
- **Ticket Done hoặc Canceled không khoá nút xoá.** Khi xoá repo hoặc agent, tham chiếu từ ticket đã đóng được đặt về null.

## 6. Để người xây dựng quyết định

- Schema Prisma cụ thể: bảng repo dùng chung, bảng nối project–repo, môi trường, nhánh, agent, skill, rule, các bảng nối agent–skill, agent–rule, ticket–skill, ticket–rule. Chuyển các cột slug sang khoá ngoại theo id.
- Cách chuyển dữ liệu trong migration: `ProjectRepo` sang repo dùng chung cộng bảng nối (gộp repo trùng path), slug agent sang id, `AgentRun.agentSlug`. Đi theo `apps/daemon/.agents/rules/daemon-migrations.md`. Việc đọc agent file và ghi thư mục `members/` không chạy được trong SQL migration, nên có thể là một lệnh import một lần hoặc chạy lúc daemon khởi động. Ràng buộc: chạy lại không tạo trùng, và không xoá file gốc.
- Skill trong `extraSkills` và frontmatter `skills` cũ chỉ có tên. Cách chuyển (tạo skill thiếu path rồi đánh dấu "cần bổ sung", hay bỏ qua kèm báo cáo) do builder chọn, miễn không âm thầm mất dữ liệu.
- Lọc skill khi chọn trên ticket: một ticket có nhiều agent, mỗi agent có thể khác provider. Builder chọn cách lọc, ví dụ hiện mọi skill nhưng ghi provider, hoặc chỉ đưa skill khớp provider vào prompt của từng agent.
- Cờ allowed tools cho từng provider ngoài Claude: kiểm tra theo `--help` của từng CLI, giống cách `agent-args.ts` đang làm. Provider không hỗ trợ thì bỏ qua.
- Phục vụ file avatar từ thư mục agent cho web: endpoint daemon, có chặn đọc file ngoài thư mục agent.
- Lệnh git để liệt kê nhánh, tạo, checkout và push (remote mặc định `origin`). Chạy trong `repo.path` của ticket, không qua shell string.
- Route, i18n và cách sắp xếp trang web, theo pattern hiện có và skill `web-create-module`. Module daemon mới dùng skill `daemon-create-module`.
- Có giữ `AGENTS_DIR` và `AgentProfilesService` sau khi chuyển dữ liệu hay không.
