# Kanban board cho project (luồng Jira → agent)

Ngày: 2026-10-30 · Trạng thái: bản nháp, chờ chủ dự án duyệt

## 1. Mục đích

Chủ dự án (vinh@apollogix.com) nhận ticket Jira hằng ngày. Họ muốn mỗi ticket đi qua một dây chuyền có agent làm phần lớn việc. Chủ dự án chỉ giữ hai chốt quyết định: duyệt spec và review kết quả cuối.

App hiện có workspace, project, và phần điều khiển agent qua Herdr: tạo pane, gửi prompt, stream terminal. Tính năng này thêm ba phần:

1. **Ticket Store**: kho ticket kéo về từ Jira, nơi ticket được gắn vào project.
2. **Board của project**: 8 cột, theo luồng bên dưới.
3. **Kho agent**: các agent được định nghĩa bằng file. App sinh agent đúng role cho từng bước.

## 2. Mục tiêu, không làm, và thất bại

**Mục tiêu**
- Kéo ticket Jira đang assign cho chủ dự án về database bằng một nút Sync.
- Gắn ticket vào project. App gợi ý theo key, chủ dự án sửa rồi lưu.
- Board 8 cột: agent tự chạy ở In Spec, In Progress và In Testing. Chủ dự án quyết định ở In Review Spec và In Review.
- Mỗi bước dùng agent riêng: model riêng, effort riêng, hành vi riêng, lấy từ kho agent chung.

**Không làm**
- Không ghi ngược lên Jira: không đổi status, không comment. Chủ dự án tự cập nhật Jira.
- App không đụng vào git: không checkout, không commit, không push. Chủ dự án tự checkout nhánh trước khi kéo ticket sang In Spec hoặc In Progress.
- Không làm nhiều người dùng, phân quyền hay đăng nhập. Đây là app chạy trên máy cá nhân.

**Thất bại dù vẫn "chạy được"**
- Agent tự chạy tiếp khi chủ dự án chưa quyết định, ví dụ tự code khi spec chưa duyệt.
- Agent chạy sai thư mục repo.
- Ticket bị gỡ assign mà agent vẫn chạy.
- Vòng sửa lỗi lặp mãi, tốn tiền mà không có người biết.
- Mất phần chủ dự án tự sửa trong spec.

## 3. Ràng buộc từ hệ thống hiện có

- Stack: daemon NestJS + Prisma + Postgres (`apps/daemon`), web React + TanStack Router/Query (`apps/web`). Realtime dùng Socket.IO, namespace `/api/v1/agents`.
- `Project.code` đã là tiền tố ticket (ví dụ `FMS`) và là duy nhất trên toàn hệ thống. Dùng nó để gợi ý project.
- `HerdrService.createAgent` hiện chưa nhận `cwd`, model, effort hay prompt khởi đầu (`args: []`). Cũng chưa có API dừng agent, chỉ có hàm nội bộ `closePane`. Cả hai phải mở rộng.
- Herdr cung cấp `agent.prompt`, `agent.list` (có `agent_status`, `cwd`), `pane.split`, `pane.close` và subscribe event theo pane.

## 4. Những gì chủ dự án đã quyết

### 4.1 Ticket Store
- Nút **Sync** kéo các ticket Jira đang assign cho chủ dự án và lưu vào DB. Ticket mới chưa thuộc project nào.
- Trang Ticket Store dùng **bố cục cột theo project, kéo thả**, theo mockup A đã chọn:
  - Cột "Chưa xác định" chứa các ticket không khớp key nào.
  - Mỗi project là một cột. Ticket được xếp sẵn theo gợi ý: key `FMS-…` vào project có `code = FMS`.
  - Chủ dự án kéo thả để sửa, rồi bấm **Lưu**. Chỉ khi Lưu, ticket mới được gắn vào project và vào cột **To Do** của board.
- Sync lại:
  - Ticket chỉ đổi nội dung (mô tả, comment…): cập nhật bình thường, giữ nguyên cột.
  - Ticket không còn assign cho chủ dự án: chuyển sang **Canceled**, dù đang ở cột nào. Nếu có agent đang chạy thì **dừng agent ngay**, rồi mới chuyển Canceled.

### 4.2 Các cột và chuyển trạng thái

| Cột | Ai chuyển vào | Chuyện gì xảy ra |
|---|---|---|
| **To Do** | Lưu từ Ticket Store | Ticket được gán sẵn bộ agent mặc định của project |
| **In Spec** | Chủ dự án kéo từ To Do, hoặc gửi feedback từ In Review Spec | Agent Spec làm rõ mục đích, use case, business rules, scope, chỗ xung đột với codebase, rồi viết spec gồm các bước thực hiện |
| **In Review Spec** | Tự động khi agent Spec xong | Chủ dự án review spec trong dialog |
| **In Progress** | Chủ dự án kéo, chỉ khi spec đã Approve. Hoặc tự động khi test có lỗi. Hoặc khi gửi feedback ở In Review | Agent Dev code theo spec. Lần đầu vào cột, agent Testing đồng thời viết test case |
| **In Testing** | Tự động khi agent Dev xong | Agent Testing tự khởi động dev server, chạy *tất cả* test case (có test trên trình duyệt), rồi gom mọi lỗi thành một danh sách |
| **In Review** | Tự động khi test pass hết | Chủ dự án review kết quả cuối |
| **Done** | Chủ dự án kéo | Kết thúc |
| **Canceled** | Tự động khi ticket bị gỡ assign | Agent liên quan bị dừng |

### 4.3 Review spec (In Review Spec)
- Click card sẽ mở **dialog**. Theo mockup A đã chọn, mặc định hiện spec đã format, và có tab **Sửa** để chỉnh markdown.
- Trong dialog, chủ dự án có ba hành động:
  - **Lưu chỉnh sửa:** ghi đè spec, card giữ nguyên cột.
  - **Gửi feedback:** viết vào ô văn bản dưới spec. Card quay về In Spec, agent Spec nhận spec hiện tại (gồm cả phần đã sửa tay) cùng feedback để viết lại.
  - **Approve:** chốt spec. Card **không tự chạy**, vẫn nằm ở In Review Spec với dấu "đã duyệt". Chủ dự án tự kéo sang In Progress.

### 4.4 Vòng Dev ↔ Testing
- Lần đầu kéo sang In Progress: agent Dev và agent Testing chạy song song. Agent Dev code, agent Testing viết test case từ spec.
- Agent Dev xong thì card sang In Testing. Agent Testing chạy toàn bộ test case và gom tất cả lỗi lại một lần.
- Có lỗi: card về In Progress, agent Dev nhận cả danh sách lỗi để sửa trong một lượt, sửa xong lại sang In Testing.
- **Giới hạn 2 vòng sửa.** Nếu sau vòng sửa thứ 2 vẫn còn lỗi, dừng lại, card hiện dấu "cần bạn" kèm danh sách lỗi còn lại.
- Hết lỗi thì card sang In Review.

### 4.5 Review cuối (In Review)
Chủ dự án chọn một trong hai cách, tuỳ trường hợp:
- **Gửi feedback:** card về In Progress. Agent Dev sửa, rồi chạy lại vòng Testing như bình thường.
- **Tự sửa ngoài app**, rồi kéo sang Done.

### 4.6 Agent
- **Kho agent chung** cho mọi workspace, là các file trong một thư mục global. Mỗi file là một role, phụ trách một mảng riêng. Mỗi file có: Provider (Claude, Codex, Copilot, Antigravity), Model, Effort, Skills, Rules, và Mô tả hành vi và cách tư duy.
- Khi một bước cần agent, API tạo **pane Herdr mới** với đúng provider, model, effort và chỉ dẫn của role, chạy trong **thư mục repo đã chọn cho ticket** (xem 4.6b).
- **Mỗi project có bộ agent mặc định riêng** cho ba bước Spec, Dev và Testing, chọn từ kho chung khi tạo project. Nhiều project có thể dùng chung một bộ.
- Ticket vào To Do được gán sẵn bộ mặc định của project. Trước khi tới một bước, chủ dự án có thể **đổi agent cho bước đó**, và **thêm rules, skills, mô tả riêng** cho ticket đó. Phần thêm này không sửa file global.
- **Skills** trong file agent và phần thêm theo ticket là **tên các skill đã cài cho provider đó**, ví dụ skill Claude cho agent Claude. **Rules** và **Mô tả** là văn bản.

### 4.6b Repo
- Mỗi project có **nhiều repo**, mỗi repo gồm tên và đường dẫn trên máy, ví dụ `ff-web` và `ff-web-2`. Chủ dự án cấu hình danh sách này và chọn **một repo mặc định** cho project.
- Mỗi ticket có field **Repo** dạng select. Khi ticket vào To Do, field được điền sẵn repo mặc định của project. Chủ dự án đổi được nếu cần.
- Mọi agent của ticket chạy trong thư mục repo đã chọn cho ticket đó.

### 4.6c Test case
- Test case là **kịch bản lưu trong app**, không phải file test trong repo. Agent Testing viết kịch bản từ spec, rồi tự thực hiện, kể cả thao tác trên trình duyệt. Agent không để lại file test trong repo.

### 4.7 Board
- Trang board riêng cho mỗi project, gồm 8 cột như bảng ở 4.2.
- Theo mockup A đã chọn, **card gọn** chỉ có: mã ticket, tên, và một nhãn trạng thái: đang chạy, đã duyệt, hoặc cần bạn.
- Mọi chi tiết khác nằm trong dialog của card.

## 5. Các quyết định do người viết tài liệu đưa ra (chủ dự án chưa xác nhận)

- **Kết nối Jira:** Jira Cloud REST API, xác thực bằng email + API token đặt trong env của daemon (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`). JQL là `assignee = currentUser()`. Sync chạy tay, không có lịch tự động.
- **Định dạng file agent:** markdown với frontmatter YAML gồm `name`, `provider`, `model`, `effort`, `skills`, `rules`. Phần thân là mô tả. Thư mục mặc định là `~/.the-agents-org/agents/`, đổi được qua env `AGENTS_DIR`. App đọc lại file mỗi lần sinh agent, nên sửa file không cần restart. Mỗi agent được định danh bằng tên file (slug).
- **File agent bị xoá hoặc đổi tên** khi đang được dùng: hiện "không tìm thấy" và chặn bước đó. App không tự thay agent khác.
- **Mỗi lần agent Spec viết lại** tạo một phiên bản mới (v1, v2…). Card và dialog hiện số phiên bản.
- **Spec chưa Approve** thì không kéo được sang In Progress. Kéo ngược các cột khác thì bị chặn, trừ các chuyển trạng thái ở 4.2.
- **Đổi agent cho một bước** bị khoá khi bước đó đang chạy.
- **Feedback ở In Review** đặt lại bộ đếm 2 vòng sửa.
- **Test case, danh sách lỗi và kết quả test** được lưu trong DB và xem được trong dialog của card, giống spec.
- **Agent Testing không sửa code**, chỉ báo lỗi. Agent Dev và agent Testing là hai pane riêng.
- **Agent Testing tắt dev server** sau khi test xong.
- **Agent đang chờ người trả lời** (hỏi lại giữa chừng): card hiện "cần bạn". Dialog có nút mở terminal của agent, dùng stream đã có.
- **Dialog của card** có: link ticket Jira gốc, spec, test case, danh sách lỗi, agent của từng bước, và terminal của agent đang chạy.
- **Phạm vi Sync:** chỉ kéo về ticket assign cho chủ dự án mà Jira status category khác Done.
  - Ticket đã có trong DB được kiểm tra lại riêng theo key, để phân biệt hai trường hợp. Ticket đóng trên Jira mà vẫn assign cho chủ dự án thì chỉ cập nhật nội dung, không bị Canceled. Chỉ khi assignee đổi khỏi chủ dự án thì ticket mới chuyển Canceled.
  - Ticket Canceled sau này được assign lại thì quay về To Do của project cũ. Spec và lịch sử vẫn giữ nguyên.
- **Sau vòng sửa thứ 2 mà vẫn lỗi:** card nằm ở In Testing với dấu "cần bạn". Chủ dự án có hai lựa chọn:
  - Gửi feedback: card về In Progress, bộ đếm vòng sửa đặt lại.
  - Tự sửa ngoài app rồi kéo thẳng sang In Review.
- **Feedback và các vòng sửa** được gửi tiếp cho agent đang có của bước đó (cùng pane), để agent giữ được ngữ cảnh. Pane chỉ được tạo mới khi chưa có, hoặc khi chủ dự án đổi agent. Các pane của ticket được đóng khi ticket sang Done hoặc Canceled.
- **"Chạy tất cả test case"** nghĩa là chạy hết các kịch bản của ticket đó, không chạy bộ test có sẵn của repo.
- **Hai ticket hoạt động cùng repo:** app không chặn, vì chủ dự án dùng nhiều bản repo (`ff-web`, `ff-web-2`) để chạy song song. Khi kéo một ticket vào bước có agent mà repo đó đang có ticket khác chạy agent, app hiện cảnh báo nêu ticket kia, và chủ dự án vẫn có thể tiếp tục.
- **Đổi repo của ticket** chỉ được khi ticket không có agent nào đang chạy.
- **Skill không có** ở provider của agent: app không tự kiểm tra. Chủ dự án tự chịu trách nhiệm chọn skill đúng provider.
- **Ticket Store** chỉ hiện ticket chưa gắn project. Khi ticket còn ở To Do, chủ dự án đổi project được trong dialog của card. Ticket đã qua To Do thì khoá project.

## 6. Để người xây dựng quyết định

- Schema Prisma cụ thể cho ticket, lịch sử spec, test case, lỗi, và cấu hình agent của project.
- Cách agent báo "đã xong" và trả kết quả về app. Ràng buộc: tín hiệu phải rõ ràng. Không được chỉ dựa vào việc trạng thái Herdr chuyển sang idle, vì agent cũng idle khi đang hỏi lại.
- Cách truyền model, effort và skills cho từng provider khi khởi động trong Herdr.
- Công cụ để agent Testing điều khiển trình duyệt.
- Cách sắp xếp trang, route và menu trên web, miễn là theo đúng các pattern hiện có.
- Cách gom các thay đổi realtime của board lên web, dùng Socket.IO sẵn có.
