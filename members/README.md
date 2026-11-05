# Cấu hình agent cho board

Model, effort và allowed tools **không** đọc từ `AGENT.md`; chúng là field của agent trong database. Nhập chúng ở
trang Agents trên web khi tạo agent. Daemon truyền chúng thành flag CLI (`--model`, `--effort`, `--allowedTools`),
xem `apps/daemon/src/modules/agent-runs/utils/agent-args.ts`. File này để người đọc, agent không đọc nó.

## Tổng quan

| Agent | Role | Path | Provider | Model | Effort | Status chạy |
|---|---|---|---|---|---|---|
| Agent BA | `BA` | `members/ba` | claude | `claude-opus-5-5` | `medium` | IN_SPEC |
| Agent FE Dev | `DEV` | `members/fe-dev` | claude | `claude-sonnet-5-5` | `medium` | IN_PROGRESS |
| Agent BE Dev | `DEV` | `members/be-dev` | claude | `claude-sonnet-5-5` | `medium` | IN_PROGRESS |
| Agent Fullstack Dev | `DEV` | `members/fullstack-dev` | claude | `claude-opus-5-5` | `medium` | IN_PROGRESS |
| Agent Tester | `QC` | `members/tester` | claude | `claude-sonnet-5-5` | `medium` | IN_PROGRESS (viết case), IN_TESTING (chạy case) |

Path tính từ gốc repo; khi nhập vào form Agents, dùng đường dẫn tuyệt đối tới thư mục đó.

Effort hợp lệ của Claude Code: `low`, `medium`, `high`, `xhigh`, `max`. Để trống model/effort thì CLI dùng mặc
định của nó.

## Lý do chọn

**BA: Opus, medium.** Spec sai thì mọi bước sau sai theo, và mỗi vòng feedback tốn thời gian của owner. BA chỉ đọc code,
không sửa, nên lượng token output thấp; tốn thêm tiền ở bước này là rẻ nhất. Nâng lên `medium` cho epic lớn hoặc
ticket nhiều quy tắc nghiệp vụ chồng chéo.

**FE Dev: Sonnet, medium.** Việc FE chủ yếu là ghép component có sẵn, ít logic khó; lỗi hiển thị dễ bị Tester bắt
qua trình duyệt. Nâng lên `medium` khi ticket có state phức tạp (form nhiều bước, kéo thả, realtime).

**BE Dev: Sonnet, medium.** Logic nghiệp vụ, migration và quyền truy cập khó phát hiện lỗi hơn và hậu quả nặng hơn
(mất dữ liệu, lộ dữ liệu), nên cần suy luận kỹ hơn FE. Chuyển sang Opus khi ticket đổi schema có dữ liệu thật hoặc
đụng thanh toán, bảo mật.

**Fullstack Dev: Opus, medium.** Phải giữ cả hai app trong đầu và giữ contract API khớp hai bên; ngữ cảnh lớn hơn, sai
một bên là cả tính năng hỏng. Dùng cho ticket nhỏ đến vừa không đáng tách FE/BE. Ticket lớn thì nên tách cho FE Dev
và BE Dev chạy rẻ hơn.

**Tester: Sonnet, medium.** Viết case bám theo AC/BR có sẵn trong spec, chạy case là thao tác trình duyệt lặp lại,
cả hai không cần suy luận sâu nhưng phiên chạy dài nên model rẻ có lợi. Không dùng Haiku: dễ báo pass sai khi thao
tác trình duyệt nhiều bước. Nâng lên `medium` nếu thấy Tester báo pass cho lỗi rõ ràng.

## Allowed tools (gợi ý)

Tool không có trong danh sách sẽ bị hỏi quyền trong pane, run dừng lại và board hiện "needs you". Daemon chỉ chấp
nhận ký tự `A-Z a-z 0-9 _ * : ( ) . -`, **không có dấu cách**, nên dùng dạng `Bash(pnpm:*)`.

| Agent | Allowed tools |
|---|---|
| BA | `Read, Grep, Glob, Bash(curl:*)` |
| FE / BE / Fullstack Dev | `Read, Grep, Glob, Edit, Write, Bash(pnpm:*), Bash(npx:*), Bash(curl:*)` |
| Tester | `Read, Grep, Glob, Write, Bash(pnpm:*), Bash(curl:*), Bash(kill:*)` + tool của browser MCP đang cài |

Không cấp `Bash(git:*)` cho Dev: prompt cấm commit/push/đổi branch, nên đừng tự duyệt sẵn cho nó.
`Write` của Tester để ghi `output.json` vào thư mục run.

## Chọn dev agent cho ticket

- Ticket chỉ đụng giao diện → FE Dev.
- Ticket chỉ đụng API/dữ liệu → BE Dev.
- Ticket đụng cả hai → Fullstack Dev, hoặc tách thành 2 subtask FE/BE trên Jira.
