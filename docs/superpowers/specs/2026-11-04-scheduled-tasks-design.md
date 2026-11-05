# Scheduled tasks

Ngày: 2026-11-04 - Trạng thái: bản nháp, chờ chủ dự án duyệt
Mockup: `.superpowers/brainstorm/36457-1793750838/content/scheduled-tasks.html` (không commit).

## 1. Mục đích

Mỗi ngày chủ dự án phải tự gom việc từ Jira, commit và PR để viết báo cáo EOD (hôm qua đã làm gì) và Stand-up (hôm nay sẽ làm gì), rồi dán vào MS Teams của công ty. Họ muốn app tự làm việc này theo lịch: đến giờ, một coding agent chạy một prompt định sẵn trên các repo đã chọn, và ghi kết quả ra file `.md` trong một thư mục chỉ định. Họ chỉ việc copy và dán.

Đây là **tính năng chung**. Người dùng tự tạo nhiều task, mỗi task có lịch và prompt riêng. Báo cáo EOD/Stand-up chỉ là task đầu tiên. Ví dụ lịch họ đưa ra:
- 08:30, thứ 2, 4, 6
- 09:30, mỗi ngày (T2 đến CN)
- 18:00, thứ 7

Daemon chạy trên laptop, nên máy có thể tắt hoặc ngủ đúng giờ hẹn. Lần bị lỡ **không chạy bù**, nhưng phải được ghi lại, có thông báo, và chạy lại được bằng một nút bấm.

## 2. Mục tiêu, không làm, và thất bại

**Mục tiêu**
- CRUD scheduled task gồm: tên, giờ (HH:mm), các ngày trong tuần, agent, một hoặc nhiều repo (có thứ tự), thư mục output, prompt, bật/tắt.
- Đến giờ, daemon mở pane Herdr, khởi động agent và gửi prompt. Agent ghi file `.md` vào thư mục output rồi gọi callback báo xong.
- Ghi lịch sử từng lần chạy: thời điểm dự kiến, trạng thái, file kết quả, lỗi.
- Phát hiện lần bị lỡ khi máy tắt hoặc ngủ, ghi lại với trạng thái MISSED, rồi thông báo qua **badge trên menu** và **toast khi mở dashboard**. Lần chạy **lỗi hoặc bị treo** (FAILED) cũng được thông báo như vậy. Mỗi dòng có nút **Chạy lại** và **Bỏ qua**.
- Nút **Chạy ngay** cho mỗi task.
- Xem và **copy** nội dung file kết quả ngay trong app.

**Không làm**
- Không gửi gì lên MS Teams, Slack hay email. Người dùng tự copy.
- Không tự chạy bù lần bị lỡ.
- Không hỗ trợ cron expression, nhiều giờ trong cùng một task, hay múi giờ khác giờ máy.
- Không có notification của hệ điều hành (macOS).
- Daemon không tự đọc Jira, GitHub hay git để làm báo cáo. Agent tự làm bằng công cụ của nó (Jira MCP, `git log`, `gh`).
- Không sửa file kết quả trong app.

**Thất bại dù vẫn "chạy được"**
- Một lần chạy treo hoặc lỗi mà không có thông báo, khiến người dùng tới giờ họp mới biết không có báo cáo.
- Một lần hẹn bị chạy hai lần, ví dụ vì hai tick liên tiếp hoặc daemon khởi động lại ngay trong khoảng ân hạn.
- Máy tắt đúng giờ hẹn mà khi bật lại không có dòng MISSED nào và không có thông báo gì.
- Lần bị lỡ tự chạy mà người dùng không bấm.
- Chạy lại một lần lỡ của thứ 2 vào hôm thứ 4, mà báo cáo lại viết về "hôm qua" theo thứ 4.
- Agent ghi file ra ngoài thư mục output, hoặc ghi đè file của task khác.

## 3. Những gì chủ dự án đã quyết

- Lịch là **một giờ cố định + tập ngày trong tuần**, chọn bằng các nút T2 đến CN.
- "Nội dung" của task là **prompt cho coding agent** chạy qua Herdr, giống các agent run hiện có.
- Mỗi task chọn **một agent** và **nhiều repo**.
- Kết quả là file `.md` trong **thư mục do người dùng chỉ định** cho từng task.
- Lần bị lỡ: **bỏ qua, không chạy bù**. Có thông báo, có nơi liệt kê, có nút chạy lại.
- Thông báo gồm **badge trên menu** và **toast khi mở dashboard**, ngoài khung cảnh báo trong trang.
- Lần chạy **lỗi hoặc bị treo** cũng được thông báo và có nút chạy lại, giống lần bị bỏ lỡ.
- Bố cục màn hình theo mockup: trang danh sách có khung "lần bị bỏ lỡ" ở trên cùng, form tạo/sửa task, và lịch sử chạy của từng task.

## 4. Thiết kế

### 4.1 Dữ liệu (Prisma)

Module daemon mới `scheduled-tasks`, tạo bằng skill `daemon-create-module`.

`ScheduledTask`
- `id`, `name` (unique), `prompt` (Text), `enabled` (mặc định true)
- `slug`: sinh từ `name` (chữ thường, bỏ dấu, `-`), **unique**. Tạo hay sửa task mà slug trùng thì trả 409. Nhờ vậy hai task không bao giờ ghi cùng một file (*quyết định của tôi*).
- `time`: phút trong ngày, `Int` từ 0 đến 1439 (08:30 → 510)
- `days`: `Int[]`, giá trị 0 đến 6 theo `Date.getDay()` (0 = CN). Không được rỗng.
- `agentId` → `Agent`, `onDelete: Restrict` (*quyết định của tôi*). Ticket/project dùng `SetNull`, nhưng một task không có agent thì không chạy được, nên ở đây cấm xoá agent đang được task dùng. Luồng xoá agent hiện có phải trả 409 kèm thông báo dễ hiểu.
- Repo có thứ tự: bảng nối `ScheduledTaskRepo(taskId, repoId, position)`. Repo `position = 0` là repo chính, agent chạy trong thư mục của repo này. Phải có ít nhất một repo. FK tới `Repo` là `onDelete: Restrict` (*quyết định của tôi*). Luồng xoá repo hiện có phải trả 409 nếu repo đang được task dùng.
- `outputDir`: đường dẫn tuyệt đối, cho phép nhập `~` rồi lưu dạng đã expand.
- `checkedUntil DateTime`: mốc mà scheduler đã xét đến (xem 4.2).
- `createdAt`, `updatedAt`

`ScheduledRun`
- `id`, `taskId` (cascade khi xoá task)
- `scheduledFor DateTime`: thời điểm dự kiến. Với "Chạy ngay" thì bằng lúc bấm.
- `trigger`: enum `SCHEDULE | MANUAL | RERUN`
- `status`: enum `RUNNING | COMPLETED | FAILED | STOPPED | MISSED | SKIPPED`
- `rerunOfId` → `ScheduledRun?`: lần chạy lại trỏ về lần gốc (MISSED/FAILED)
- `dismissedAt DateTime?`: được set khi người dùng bấm "Bỏ qua" một lần MISSED hoặc FAILED
- `agentId` (`onDelete: SetNull`), `agentName` (giữ tên lúc chạy cho lịch sử, giống `AgentRun.agentSlug`), `paneId`, `token`
- `outputPath String?`, `output Text?` (nội dung file, chụp lại lúc COMPLETED), `error Text?`, `startedAt DateTime?`, `finishedAt DateTime?`
- **Unique `(taskId, scheduledFor)` cho `trigger = SCHEDULE`**, dùng partial unique index trong migration giống `running_run_unique`. Đây là lớp chặn chạy trùng.
- **Unique `taskId` cho `status = RUNNING`** (partial index): mỗi task chỉ có một run đang chạy, dù run đó đến từ lịch, Chạy ngay hay Chạy lại.
- **Unique `rerunOfId`**: mỗi run chỉ được chạy lại một lần.

Enum đặt trong `scheduled-tasks/enum.ts`, hằng số (khoảng ân hạn, chu kỳ tick, số ngày tối đa ghi MISSED, tên event socket...) đặt trong `constants.ts`, theo quy ước repo.

### 4.2 Scheduler

Dùng `setInterval` trong service, mỗi 30 giây một tick, chạy luôn một lần trong `onModuleInit`. Không thêm dependency.

Mỗi tick, với từng task đang bật:
1. Liệt kê các lần hẹn `t` nằm trong `(checkedUntil, now]`, tính theo **giờ local của máy**.
2. Lần hẹn có `now - t ≤ GRACE` (2 phút) thì **chạy** nó (4.3). Lần cũ hơn thì tạo dòng `MISSED`.
3. Cập nhật `checkedUntil = now`.

Bước tạo run, MISSED hay chạy thật, đều dựa vào unique index. Nếu insert bị trùng (P2002) thì coi như lần đó đã được xử lý và bỏ qua. Vì vậy hai tick chồng nhau hoặc daemon khởi động lại cũng không chạy trùng.

Cùng một cơ chế này xử lý cả máy tắt (lúc khởi động) lẫn máy ngủ (tick đầu tiên sau khi thức dậy thấy một khoảng trống lớn).

- **Giới hạn khi máy tắt lâu** (*quyết định của tôi*): chỉ ghi MISSED cho các lần hẹn trong 7 ngày gần nhất. Lần cũ hơn thì bỏ, không ghi.
- **Task đang chạy mà đến lần hẹn mới** (*quyết định của tôi*): ghi `SKIPPED` với `error = "previous run still running"` và không chạy chồng. SKIPPED không tính vào thông báo.
- **Tạo task, bật lại task, hoặc sửa giờ/ngày**: đặt `checkedUntil = now`, để không sinh MISSED cho quá khứ. Khi task bị tắt thì không ghi gì.

### 4.3 Chạy một lần

Đi theo đúng đường của `AgentRunsService.start`, nhưng không gắn với ticket:

1. Kiểm tra: agent tồn tại và thư mục của nó có `AGENT.md`, mọi repo qua được `assertRepoPath`, và `outputDir` tạo được (`mkdir -p`). Lỗi ở bước này thì run thành `FAILED` kèm thông báo lỗi.
2. Tạo `ScheduledRun` với trạng thái `RUNNING` và token ngẫu nhiên.
3. `herdr.createAgent({ agent: provider, cwd: repo chính, args })`. `args` lấy từ `buildAgentArgs`, nhưng hàm này cần mở rộng để nhận **nhiều thư mục**: runs dir, các repo phụ và `outputDir`, mỗi thư mục một cờ `--add-dir`. Provider không có cờ thư mục (agy) thì chỉ dựa vào prompt. Agent chưa sẵn sàng thì xử lý giống ticket run: FAILED kèm lời nhắn trả lời trong pane.
4. Gửi prompt (4.4).
5. Callback `POST /api/v1/scheduled-runs/:id/complete`, header `x-run-token`, `@AllowWithoutClientHeader`. Nếu file output tồn tại và có `mtime ≥ startedAt`, daemon đọc nội dung vào `output` rồi chuyển `COMPLETED`. Ngược lại thì `FAILED` ("output file missing"), để tránh trường hợp file cũ còn sót lại từ lần chạy trước bị tính là xong.
6. Sau khi COMPLETED thì đóng pane (*quyết định của tôi*: tránh mỗi ngày dồn thêm pane). Khi FAILED thì giữ pane để xem lại.

**Treo**: run `RUNNING` quá `MAX_RUN_MINUTES` (30 phút, đặt trong constants) thì tick chuyển nó sang `FAILED` ("timed out") và giữ pane để xem lại. Như vậy một run treo không làm mọi lần sau bị SKIPPED mãi.

Pane mở theo mặc định của `herdr.createAgent({ cwd })`, giống ticket run, không cần workspace Herdr riêng (*quyết định của tôi*).

Khi daemon khởi động lại: run `RUNNING` mà pane không còn thì chuyển `FAILED`, giống `AgentRunsService.onModuleInit`. Có nút **Dừng** để chuyển `STOPPED` và đóng pane.

Agent: chọn agent nào cũng được, không lọc theo role (*quyết định của tôi*). Rules và skills của agent đưa vào prompt giống ticket run.

### 4.4 Prompt

Gồm các phần, theo thứ tự:
- `Read and follow your role description: <agent path>/AGENT.md`, cùng rules và skills của agent (dùng lại các phần của `promptHeader` mà không cần ticket).
- Khối ngữ cảnh do daemon sinh:
  - `Scheduled for: <YYYY-MM-DD HH:mm, thứ trong tuần>, local time.` Kèm dòng: *"Treat this as 'today' for any relative dates (yesterday, today) in the task, even if the current time is later."* Dòng này để khi bấm Chạy lại một lần lỡ, báo cáo vẫn đúng ngày.
  - Danh sách đường dẫn các repo, repo chính đứng đầu.
- Prompt của người dùng, giữ nguyên.
- Hợp đồng output: ghi kết quả ra `<outputDir>/<file>` (ghi đè nếu đã có), rồi chạy lệnh `curl` callback. Chỉ chạy curl sau khi file đã ghi xong.

**Tên file** (*quyết định của tôi*): `YYYY-MM-DD-<slug tên task>.md`, ngày lấy theo `scheduledFor`. Chạy lại cùng ngày thì ghi đè file cũ. Nếu "Chạy ngay" nhiều lần trong ngày thì cũng ghi đè.

### 4.5 Chạy lại, Bỏ qua, Chạy ngay

- **Chạy lại** (với MISSED hoặc FAILED, kể cả một lần chạy lại bị FAILED): tạo run mới với `trigger = RERUN`, `rerunOfId` = run vừa được bấm, `scheduledFor` = `scheduledFor` của run đó. Nếu task đang có run RUNNING, hoặc run này đã được chạy lại rồi, thì trả 409.
- **Bỏ qua** (với MISSED hoặc FAILED): set `dismissedAt`.
- **Chạy ngay**: `trigger = MANUAL`, `scheduledFor = now`. Nếu task đang có run RUNNING thì trả 409.
- **Xem / Copy** dùng `output` lưu trong DB, nên không phụ thuộc vào việc file trên đĩa đã bị ghi đè hay bị xoá.

"Lần cần xử lý" = `status IN (MISSED, FAILED)`, `dismissedAt IS NULL` và chưa có run nào trỏ `rerunOfId` về nó. STOPPED là do người dùng tự dừng, nên không tính. SKIPPED cũng không tính.

### 4.6 API (prefix `api/v1`)

- `GET/POST /scheduled-tasks`, `GET/PATCH/DELETE /scheduled-tasks/:id`. Danh sách trả kèm lần chạy gần nhất và lần chạy tới. Không xoá được task đang RUNNING (409).
- `POST /scheduled-tasks/:id/run`: Chạy ngay.
- `GET /scheduled-tasks/:id/runs`: lịch sử, mới nhất trước, có phân trang.
- `GET /scheduled-runs/attention`: các lần cần xử lý (MISSED và FAILED), kèm tên task và lý do. Badge, toast và khung cảnh báo đều dùng endpoint này.
- `POST /scheduled-runs/:id/rerun`, `POST /scheduled-runs/:id/dismiss`, `POST /scheduled-runs/:id/stop`
- `GET /scheduled-runs/:id/output`: trả `output` lưu trong DB.
- `POST /scheduled-runs/:id/complete`: callback từ agent.

### 4.7 Web

Module mới `scheduled-tasks`, tạo bằng skill `web-create-module`. Route `/scheduled-tasks`, thêm vào `MENU_ITEMS`. Chữ có cả `vi` và `en`.

- **Trang danh sách**: khung "cần xử lý" ở trên cùng (ẩn nếu không có). Mỗi dòng ghi rõ "bỏ lỡ" hay "lỗi: <lý do>", kèm nút Chạy lại / Bỏ qua. Bên dưới là bảng task: tên, lịch (`08:30 (T2, T4, T6)`), agent, lần chạy gần nhất, lần tới, công tắc bật/tắt, Chạy ngay, Sửa, Xoá.
- **Form tạo/sửa** (dialog): tên, giờ, 7 nút chọn ngày, agent (select), repo (multi-select có thứ tự, repo đầu tiên là repo chính), thư mục output, prompt (textarea). Validate: tên không rỗng, có ít nhất một ngày, có ít nhất một repo, đã chọn agent, có thư mục output.
- **Lịch sử của task**: bảng gồm thời điểm dự kiến, nguồn (lịch / tay / chạy lại), trạng thái, lỗi, và với lần COMPLETED thì có nút **Xem** (markdown) và **Copy** (copy nội dung thô vào clipboard).
- **Badge** trên menu "Scheduled tasks" hiện số lần cần xử lý (ẩn khi bằng 0).
- **Toast** khi mở dashboard, mỗi phiên trình duyệt một lần (*quyết định của tôi*), nếu số lần cần xử lý > 0: "Có N lần chạy bị bỏ lỡ hoặc lỗi", kèm link tới trang.
- Cập nhật realtime (*quyết định của tôi*): daemon phát một event socket khi trạng thái run thay đổi, theo kiểu `BoardGateway.emitChanged`, và web invalidate các query liên quan. Nếu cách này phức tạp thì polling 30 giây khi trang đang mở cũng chấp nhận được.

## 5. Kiểm thử

- Unit test cho hàm tính các lần hẹn trong một khoảng `(from, to]`: qua nửa đêm, nhiều ngày, task chỉ chạy CN, giới hạn 7 ngày.
- Unit test cho tick: lần hẹn trong khoảng ân hạn thì chạy, cũ hơn thì MISSED, insert trùng thì bỏ qua, task đang chạy thì SKIPPED, task bị tắt thì không làm gì.
- Unit test cho callback: token sai, file chưa có, thành công.
- Unit test cho rerun/dismiss, timeout 30 phút, và điều kiện "lần cần xử lý".
- `buildAgentArgs` với nhiều thư mục, cho từng provider.
- Web: kiểm tra trên trình duyệt bằng skill `web-browser-testing`: tạo task, Chạy ngay, badge và toast (giả lập bằng một dòng MISSED trong DB local).

## 6. Để lại cho người làm

- Đặt tên file/class cụ thể và cách chia service (scheduler / runner / CRUD).
- Event socket riêng hay dùng chung gateway có sẵn.
- Chi tiết UI theo uikit (`TmnTable`, `TmnDialog`...), miễn bố cục giống mockup.
- Prompt tiếng Anh viết thế nào, miễn có đủ các phần ở 4.4.
