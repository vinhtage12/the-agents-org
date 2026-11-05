# Nguồn spec (Local / Jira / Hybrid), ticket tự tạo và Sprint

Ngày: 2026-11-03 - Trạng thái: bản nháp, chờ chủ dự án duyệt
Nguồn: `docs/raw-requirements/jira-sprint.md`. Tiếp nối `2026-11-02-warehouses-design.md`.

## 1. Mục đích

Hiện nay mọi ticket đều phải đến từ Jira. Chủ dự án có những project mà spec nằm sẵn trong máy dưới dạng file `.md`. Với những project đó, họ muốn tự tạo ticket trong app mà không cần đẩy lên Jira rồi sync về. Ngoài ra, họ muốn chia việc theo sprint giống Jira: sprint của Jira được sync về, sprint tự tạo dùng được cho project kiểu nào cũng được, và board lọc được theo sprint.

## 2. Mục tiêu, không làm, và thất bại

**Mục tiêu**
- Mỗi project có một **nguồn spec**: Local, Jira hoặc Hybrid.
- Project Local hoặc Hybrid có **thư mục spec** và cho phép **tự tạo ticket** trong app.
- Ticket tự tạo có key riêng, mang prefix của project, và không bao giờ trùng với key Jira.
- Sprint của Jira được sync về, và ticket Jira nằm đúng sprint như trên Jira.
- Sprint tự tạo dùng được cho mọi kiểu project, với vòng đời giống Jira.
- Board của project có bộ lọc sprint. Mặc định bộ lọc chọn sprint đang chạy, còn ticket không thuộc sprint nào nằm trong một section riêng.

**Không làm**
- App không đẩy gì lên Jira: không tạo issue, không tạo sprint, không gán sprint trên Jira.
- App không tự quét thư mục spec để sinh ticket. Mỗi ticket do người dùng tự tạo và tự chọn file.
- App không đổi, không bắt đầu và không đóng sprint của Jira.
- Phase này không làm báo cáo sprint (burndown, velocity, story point).

**Thất bại dù vẫn "chạy được"**
- Sync Jira huỷ (CANCELED) hoặc ghi đè ticket tự tạo.
- Key của ticket tự tạo trùng với một key Jira, dù là bây giờ hay về sau.
- Ticket Jira bị app gán sang một sprint khác với sprint của nó trên Jira, rồi cứ thế giữ nguyên sai.
- Hoàn thành sprint làm mất ticket chưa xong, khiến ticket không còn nằm trong sprint nào mà người dùng không hề chọn như vậy.
- Đổi kiểu project làm mất ticket hoặc sprint đã có.

## 3. Ràng buộc từ hệ thống hiện có

- `Ticket.jiraKey` là `String @unique` và bắt buộc. Các cột `jiraUrl`, `jiraStatus`, `issueType` cũng bắt buộc. Rất nhiều chỗ đọc `jiraKey`: board, kho ticket, prompt (`promptHeader` in `Ticket ${jiraKey}`), `suggestProjectId`, web types.
- `JiraSyncService.sync()` chạy **toàn cục**, không theo project. Nó kéo `assignee = currentUser() AND statusCategory != Done`. Sau đó, **mọi** ticket chưa DONE/CANCELED mà không có trong kết quả sẽ bị recheck, và bị đặt CANCELED nếu không còn trên Jira. Nếu không sửa, đoạn này sẽ huỷ toàn bộ ticket tự tạo.
- Ticket Jira vào kho ticket (`/tickets`, `TicketStorePage`) với `projectId = null`, rồi người dùng kéo thả để link vào project (`tickets/link`).
- `Project.code` là prefix của ticket và unique toàn hệ thống (`suggestProjectId` so prefix key với `code`).
- Tạo và sửa project nằm ở `WorkspacesController` (`createProject`, `updateProject`, dùng `CreateWorkspaceDto` và `UpdateProjectDto`). Cài đặt agent và repo mặc định nằm ở `ProjectSettingsController`.
- Prompt BA (`buildSpecPrompt`) dựng từ `summary` và `description`. Quyết định cũ: prompt chỉ **trỏ đường dẫn** và không nhồi nội dung file.
- `JiraClient` hiện chỉ lấy các field `summary, description, issuetype, status, assignee`.
- UI dùng kit `@truyenmoinhu/uikit` (`TmnSelect`, `TmnInput.Select`, `TmnAutocomplete`...). Có i18n `vi` và `en`.

## 4. Những gì chủ dự án đã quyết

### 4.1 Nguồn spec của project
- Form tạo và sửa project có thêm field **Nguồn spec**, dùng `TmnSelect` với 3 option:
  - **Local**: nhận spec từ local, tức là từ file `.md` trong thư mục spec hoặc spec gõ trực tiếp trong ticket.
  - **Jira**: nhận ticket qua sync Jira như hiện tại.
  - **Hybrid**: nhận cả hai.
- Khi chọn Local hoặc Hybrid, form hiện thêm field **thư mục spec**. App chỉ đọc file `.md` trong thư mục này.

### 4.2 Ticket tự tạo
- Người dùng tự tạo ticket trong app (ở project Local hoặc Hybrid).
- Ticket có thể **chọn một file `.md`** trong thư mục spec, hoặc chứa **spec gõ trực tiếp**. Spec gõ trực tiếp được lưu vào database.
- Key của ticket tự tạo được sinh theo cách riêng, mang prefix của project và không trùng với ticket Jira.
- Ticket tự tạo **vẫn đi đủ luồng**: TODO, rồi BA viết spec, rồi chủ dự án duyệt, rồi dev, rồi test. File `.md` hay spec gõ tay chỉ là **đầu vào** cho agent BA, không phải spec đã duyệt.

### 4.3 Sprint
- Sprint giống sprint của Jira.
- Với project Jira hoặc Hybrid, sprint **được sync từ Jira**, và ticket Jira nằm đúng sprint như trên Jira.
- Sprint **tự tạo được** cho mọi kiểu project.
- Khi hoàn thành một sprint, ticket chưa xong **chuyển sang sprint tiếp theo**, giống Jira.
- Ở project Hybrid, ticket tự tạo **được thả vào sprint Jira**. Việc này chỉ diễn ra trong app.
- Khi sprint Jira đó bị đóng trên Jira mà ticket tự tạo trong nó chưa xong, ticket **tự chuyển sang sprint Jira kế tiếp** (cách chọn ở mục 5.6).
- Board của mỗi project có **bộ lọc theo sprint**. Mặc định bộ lọc chọn **sprint đang chạy**. Ticket không thuộc sprint nào nằm ngoài các cột, trong **một section riêng**.

## 5. Những quyết định của người viết (chủ dự án chưa xác nhận)

### 5.1 Dữ liệu
- `Project` có thêm `specSource` (enum `LOCAL | JIRA | HYBRID`, mặc định `JIRA` để project cũ giữ nguyên hành vi), `specDir` (đường dẫn **tuyệt đối**, nullable) và `localTicketSeq` (Int, mặc định 0).
- `Ticket` có thêm `source` (enum `JIRA | LOCAL`, mặc định `JIRA`), `specFile` (đường dẫn **tương đối** so với `specDir`, nullable) và `sprintId` (nullable).
- Đổi tên cột `jiraKey` thành `key` thì gọn hơn nhưng phải sửa rất nhiều chỗ. Người viết chọn **giữ tên `jiraKey`** và thêm một comment trong schema rằng đây là key của ticket bất kể nguồn. Builder được phép đổi tên nếu thấy chi phí thấp.
- Với ticket LOCAL: `jiraUrl = ''`, `jiraStatus = ''`, `issueType` do người dùng chọn (mặc định `Task`).
- `specDir` phải là đường dẫn tuyệt đối tới một thư mục đã tồn tại. App kiểm tra khi lưu, giống cách repo path đang được kiểm tra (`assertRepoPath`).

### 5.2 Key của ticket tự tạo
- Định dạng: `<CODE>-L<n>`, ví dụ `FMS-L1`, `FMS-L2`. Key Jira luôn có dạng `<KEY>-<số>`, nên chữ `L` bảo đảm không trùng mãi về sau.
- `n` lấy từ `Project.localTicketSeq`, tăng bằng một câu update nguyên tử trong cùng transaction với lệnh tạo ticket. `n` không bao giờ được dùng lại, kể cả khi ticket bị huỷ.
- Đổi `code` của project không đổi key của các ticket đã có.
- `suggestProjectId` vẫn chạy đúng, vì prefix trước dấu `-` cuối cùng vẫn là `CODE`.

### 5.3 Tạo và sửa ticket tự tạo
- Board của project Local hoặc Hybrid có nút **Tạo ticket**. Nút này mở dialog gồm: **tiêu đề** (bắt buộc), **loại** (Task/Bug/Story), **nguồn spec của ticket** (*File* hoặc *Gõ trực tiếp*), và **sprint** (tuỳ chọn).
  - *File*: một select liệt kê mọi file `.md` trong `specDir`, **kể cả thư mục con**, hiển thị đường dẫn tương đối. Daemon có endpoint để liệt kê các file này.
  - *Gõ trực tiếp*: một ô markdown, lưu vào `description`.
- Ticket mới vào thẳng project với trạng thái TODO, không qua kho ticket.
- Tiêu đề, loại, file và spec gõ tay chỉ sửa được khi ticket còn ở TODO.
- Project Jira không có nút Tạo ticket.

### 5.4 Agent BA với ticket tự tạo
- Nếu ticket có `specFile`, prompt sẽ trỏ tới đường dẫn tuyệt đối `specDir/specFile`, và agent tự đọc file (đúng quyết định cũ là chỉ trỏ đường dẫn). File được đọc **tại thời điểm agent chạy**, nên sửa file rồi chạy lại là có hiệu lực.
- Nếu file không còn tồn tại khi bắt đầu bước SPEC, app chặn việc chuyển trạng thái và báo lỗi rõ ràng, thay vì để agent chạy trên đầu vào rỗng.
- Dòng tiêu đề của prompt bỏ URL Jira khi URL rỗng.

### 5.5 Sync Jira
- Bước recheck và huỷ ticket chỉ áp dụng cho ticket có `source = JIRA`. Sync không bao giờ đụng tới ticket LOCAL, trừ đúng một ngoại lệ đổi sprint ở mục 5.6.
- Sync vẫn chạy toàn cục như hiện tại. Kho ticket **không cho link** ticket Jira vào project Local. Ticket Jira đã nằm trong một project trước khi project đó đổi sang Local thì giữ nguyên và vẫn được sync cập nhật.
- Đổi kiểu project không xoá gì. Nó chỉ bật hoặc tắt nút Tạo ticket, ô thư mục spec, và việc link ticket Jira vào project.

### 5.6 Sprint: dữ liệu và sync
- Bảng `Sprint`: `id`, `source` (`JIRA | LOCAL`), `jiraSprintId` (unique, nullable), `jiraBoardId` (nullable), `projectId` (nullable, chỉ dùng cho sprint LOCAL), `name`, `state` (`FUTURE | ACTIVE | CLOSED`), `startDate`, `endDate`, `completedAt` (đều nullable).
- Sync Jira lấy thêm field sprint của issue. Đây là custom field, id khác nhau tuỳ site; tìm nó qua `GET /rest/api/3/field` với schema `com.pyxis.greenhopper.jira:gh-sprint`, rồi cache lại trong bộ nhớ. Sprint Jira được upsert theo `jiraSprintId`, kèm tên, trạng thái, ngày và `boardId`.
- Một issue Jira có thể nằm trong nhiều sprint (các sprint cũ đã đóng). App chọn sprint ACTIVE; nếu không có thì chọn sprint FUTURE sớm nhất; nếu vẫn không có thì để **`sprintId = null`** (Backlog). Lý do: trên Jira, một issue chưa xong sau khi sprint đóng sẽ về backlog, dù field sprint vẫn ghi sprint cũ.
- **Làm mới trạng thái sprint Jira.** Sau khi sync xong các issue, app gọi `GET /rest/agile/1.0/sprint/{id}` cho mọi sprint Jira chưa CLOSED trong DB, để cập nhật trạng thái và ngày. Lý do: sprint đã đóng thường không còn xuất hiện trong issue nào được sync, nên nếu chỉ dựa vào dữ liệu issue thì nó sẽ mãi là ACTIVE. Nếu Jira từ chối (401/403, ví dụ token thiếu scope `read:sprint:jira-software`), app ghi cảnh báo một lần rồi dùng cách dự phòng: sprint ACTIVE đã quá `endDate` được coi là CLOSED. `.env.example` ghi chú về scope này.
- **Sprint Jira đóng khi còn ticket LOCAL bên trong.** Khi một sprint Jira chuyển sang CLOSED, mọi ticket LOCAL chưa xong trong sprint đó chuyển sang **sprint Jira kế tiếp**: ưu tiên sprint ACTIVE cùng `jiraBoardId`, sau đó là sprint FUTURE sớm nhất cùng `jiraBoardId`. Nếu không có, app dùng sprint ACTIVE hoặc FUTURE sớm nhất trong số sprint Jira đang hiện ở project đó. Nếu vẫn không có thì ticket về Backlog. Đây là ngoại lệ duy nhất cho quy tắc "sync không đụng ticket LOCAL" ở 5.5, và nó chỉ đổi `sprintId`. Sau khi chuyển, app phát sự kiện board.
- Quy tắc ghi đè: nếu Jira có sprint cho issue, sync **luôn** đặt `sprintId` theo Jira. Nếu Jira không có sprint mà ticket đang nằm trong một sprint **Jira**, sync đặt `sprintId = null`. Nếu Jira không có sprint mà ticket đang nằm trong sprint **LOCAL**, sync giữ nguyên. Nhờ vậy project Jira mà không dùng sprint trên Jira vẫn dùng sprint tự tạo được.
- Sprint Jira là **chỉ đọc** trong app. Sprint Jira hiện ở một project khi có ít nhất một ticket của project đó nằm trong sprint ấy.
- Không cấu hình Jira thì không có sprint Jira. Sprint tự tạo vẫn hoạt động.

### 5.7 Sprint tự tạo: vòng đời
- Tạo ở trang board: tên (mặc định `<CODE> Sprint <n>`), ngày bắt đầu và kết thúc (tuỳ chọn). Sprint mới có trạng thái FUTURE.
- **Bắt đầu**: FUTURE chuyển sang ACTIVE. Mỗi project chỉ có **một** sprint LOCAL đang ACTIVE.
- **Hoàn thành**: ACTIVE chuyển sang CLOSED. Một dialog hỏi nơi chuyển ticket chưa xong (trạng thái khác DONE và CANCELED). Mặc định là sprint FUTURE gần nhất của project; nếu project chưa có sprint FUTURE nào thì mặc định là **Sprint mới**, do app tự tạo. Người dùng cũng có thể chọn **Backlog** (không sprint). Ticket Jira đang theo sprint Jira không bao giờ nằm trong sprint LOCAL, nên không bị ảnh hưởng.
- Sửa tên và ngày khi sprint chưa CLOSED. Xoá chỉ được khi sprint FUTURE; ticket của sprint bị xoá về Backlog.

### 5.8 Gán ticket vào sprint
- Ở ticket dialog (phần cài đặt) có thêm select **Sprint**, gồm các sprint chưa CLOSED đang hiện ở project.
- Ticket Jira có sprint Jira: select bị disable, kèm ghi chú "theo Jira".
- Ticket Jira không có sprint Jira: chọn được sprint LOCAL.
- Ticket LOCAL ở project Hybrid: chọn được cả sprint LOCAL lẫn sprint Jira.
- Kéo thả ticket giữa các sprint thì không làm; việc gán sprint đi qua select này.

### 5.9 Board
- Phía trên board có bộ lọc sprint (`TmnSelect`). Các option là các sprint ACTIVE và FUTURE đang hiện ở project, cộng với **Tất cả**. Sprint đã đóng nằm ở cuối danh sách, dưới dạng nhóm riêng nếu `TmnSelect` hỗ trợ nhóm, hoặc kèm hậu tố "(đã đóng)" nếu không.
- Mặc định bộ lọc chọn **các sprint đang chạy**. Ở project Hybrid có thể có cùng lúc một sprint LOCAL và một sprint Jira đang chạy; khi đó mặc định gộp cả hai. Nếu không có sprint nào đang chạy, mặc định là **Tất cả**.
- Các cột kanban chỉ hiện ticket thuộc sprint đang lọc. Ticket không thuộc sprint nào hiện trong section **Backlog** bên dưới các cột. Section này có thể thu gọn, mỗi ticket là một dòng, và bấm vào thì mở ticket dialog. Ở bộ lọc **Tất cả**, các cột hiện mọi ticket và section Backlog bị ẩn.
- Lựa chọn bộ lọc giữ trên URL (search param của TanStack Router).

## 6. Để builder tự quyết
- Tên endpoint, DTO, cách chia module (sprint có thể là module daemon mới, và module mới thì phải tạo bằng skill `daemon-create-module`).
- Cách gọi API Jira để lấy sprint, miễn là giữ đúng quy tắc ở mục 5.6.
- Giao diện chi tiết của dialog và section Backlog, miễn là dùng component của kit.
- Có đổi tên `jiraKey` hay không (xem 5.1).
- Chuỗi i18n `vi` và `en` cho mọi nhãn mới.
