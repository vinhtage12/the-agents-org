# Dispatching Agent

# AS-IS

> Trạng thái code tại `main` (2196466), ngày 2026-11-04. Chỉ mô tả daemon (`apps/daemon`); web chỉ gọi API.

## 1. Tóm tắt

"Dispatch agent" = daemon mở một pane Herdr, khởi động CLI coding agent (claude / codex / copilot / agy) trong
repo của ticket, gõ một prompt vào pane, rồi **chờ agent tự gọi lại** (curl) khi xong. Daemon không đọc màn hình để
biết agent xong chưa; nó chỉ tin vào callback + file output.

Có 3 đường dispatch:

| Đường | Ai kích hoạt | Code |
|---|---|---|
| **Ticket flow** (chính) — SPEC → DEV → TEST | Owner kéo ticket trên board / gửi feedback; daemon tự nối bước tiếp | `agent-runs/services/agent-runs.service.ts`, `agent-runs/services/ticket-flow.service.ts`, `tickets/services/tickets.service.ts` |
| **Scheduled task** | Cron của scheduler | `scheduled-tasks/services/scheduled-runner.service.ts` (cùng pattern, bảng `scheduled_runs` riêng) |
| **Agent thủ công** | Trang Agents trên web: `POST /api/v1/agents`, `POST /agents/:id/prompts` | `herdr/controllers/herdr.controller.ts` — chỉ mở pane + gửi prompt, không có run/callback |

Phần dưới mô tả Ticket flow.

## 2. Các khái niệm & dữ liệu

- **Agent profile** (`agents`): tên, role (`BA` / `DEV` / `QC`), provider, model, effort, `allowedTools`,
  `path` (thư mục chứa `AGENT.md`), skills, rules.
- **Project** giữ 3 agent mặc định: `specAgentId` (role BA), `devAgentId` (DEV), `testAgentId` (QC).
  Khi ticket được link vào project / tạo local / đổi project, 3 id này + `repoId = project.defaultRepoId` được
  **copy** vào ticket. Owner có thể đổi agent từng ticket (`PATCH ticket`), bị khoá khi step đó đang chạy.
- **Ticket** thêm: `extraInstructions`, skills, rules riêng, `branch`, `fixRound`, `specFile`.
- **AgentRun** (`agent_runs`): `ticketId`, `step` (`SPEC|DEV|TEST`), `testMode` (`WRITE_CASES|RUN_CASES`, chỉ TEST),
  `agentId` + `agentSlug` (tên lúc chạy), `paneId`, `token` (24 byte random hex), `status`
  (`RUNNING|COMPLETED|FAILED|STOPPED`), `feedback`, `error`, `startedAt/finishedAt`.
  - Unique index một phần `agent_runs_one_running_per_step (ticket_id, step) WHERE status='RUNNING'`:
    **mỗi ticket tối đa 1 run RUNNING cho mỗi step** (nhưng SPEC/DEV/TEST có thể chạy song song nhau).
- Kết quả: `spec_versions` (SPEC), `test_cases` (WRITE_CASES), `test_results` (RUN_CASES).
- Thư mục run: `RUNS_DIR` hoặc `~/.the-agents-org/runs/<runId>/` — agent ghi `output.md` (SPEC/DEV) hoặc
  `output.json` (TEST) vào đây.

## 3. Vòng đời ticket & điểm dispatch

```
TODO ──kéo──▶ IN_SPEC ──(SPEC xong)──▶ IN_REVIEW_SPEC ──approve + kéo──▶ IN_PROGRESS
                 ▲                          │ feedback spec                    │ (DEV xong)
                 └──────────────────────────┘                                  ▼
                                                      IN_REVIEW ◀──(pass hết)── IN_TESTING
                                                         │  ▲                   │ (có fail, fixRound < 2)
                                                         │  └─ feedback dev ─┐  └──▶ IN_PROGRESS (DEV fix)
                                                         ▼                   │
                                                        DONE (đóng pane)     └─ từ IN_REVIEW/IN_TESTING/IN_PROGRESS
```

Owner chỉ được kéo: `TODO→IN_SPEC`, `IN_REVIEW_SPEC→IN_PROGRESS`, `IN_TESTING→IN_REVIEW`, `IN_REVIEW→DONE`
(`tickets/utils/transitions.ts`). Còn lại do daemon tự chuyển khi agent callback.

| Sự kiện | Dispatch |
|---|---|
| Kéo `TODO → IN_SPEC` | `startSpec` — agent BA viết spec |
| Feedback spec (ở `IN_REVIEW_SPEC`) | `startSpec` kèm spec cũ + feedback → về `IN_SPEC`, bỏ approve |
| Kéo `IN_REVIEW_SPEC → IN_PROGRESS` (spec phải đã approve) | Lần đầu: tạo git branch (repo phải sạch, không ticket khác đang dùng repo, có thể push). Sau đó `startDevelopment`: chạy **DEV** + nếu ticket chưa có test case thì chạy song song **TEST/WRITE_CASES** |
| Feedback dev (`IN_REVIEW`; hoặc `IN_TESTING`/`IN_PROGRESS` khi không có agent chạy) | `startDevelopment` với feedback, reset `fixRound = 0`, về `IN_PROGRESS` |
| Callback DEV xong | Ticket → `IN_TESTING`, rồi `maybeRunCases` |
| Callback WRITE_CASES xong | Thay toàn bộ test case, rồi `maybeRunCases` |
| `maybeRunCases` | Chỉ chạy **TEST/RUN_CASES** khi: ticket `IN_TESTING`, không có TEST đang chạy, đã có test case, có DEV `COMPLETED` mới hơn lần RUN_CASES gần nhất |
| Callback RUN_CASES | Pass hết → `IN_REVIEW`. Có fail và `fixRound < MAX_FIX_ROUNDS (2)` → `fixRound+1`, `IN_PROGRESS`, dispatch DEV với danh sách lỗi. Hết lượt fix → giữ `IN_TESTING` (board hiện "needs you") |
| Kéo `IN_REVIEW → DONE` / Jira sync huỷ ticket | `closeTicketPanes`: STOP mọi run RUNNING và đóng mọi pane của ticket |

Chuyển trạng thái do owner dùng "claim" có điều kiện (`updateMany where status = from`) rồi mới dispatch; dispatch
lỗi thì trả ticket về trạng thái cũ (`TicketsService.enterStatus`). Riêng branch đã tạo thì giữ lại.

## 4. `AgentRunsService.start()` — một lần dispatch

1. Load ticket (repo, skills, rules, project). Chặn nếu ticket `DONE/CANCELED`, không có repo, không có agent cho
   step.
2. Kiểm tra repo path hợp lệ, `AGENT.md` tồn tại trong thư mục agent.
3. DEV/TEST: repo phải đang ở đúng `ticket.branch` (ticket cũ không có branch thì bỏ qua — `shortcut:` đã đánh dấu).
4. SPEC có `specFile`: resolve file trong `project.specDir`.
5. Đã có run RUNNING cùng step → 409. Tạo `AgentRun` RUNNING với token mới (unique index chặn race → 409).
6. Tạo thư mục run, build prompt (mục 5).
7. Chọn pane (`reusablePane`): lấy pane của run gần nhất **cùng ticket + cùng step**; nếu pane còn sống, cùng agent và
   cùng cwd = repo → dùng lại (agent giữ ngữ cảnh). Khác agent/cwd → đóng pane đó. Không có → `herdr.createAgent`:
   `pane.split` (cwd = repo) + `agent.start` với args từ profile (`buildAgentArgs`: `--model`, effort,
   allowed tools, `--add-dir <RUNS_DIR>`; codex thêm `network_access=true` để curl được). Retry khi pane busy
   (tối đa 6 lần / 20s). Agent chưa sẵn sàng (`agent_not_ready`, ví dụ hỏi trust folder) → run FAILED, báo owner trả
   lời trong pane rồi thử lại.
8. `herdr.sendPrompt(paneId, prompt)` (Herdr `agent.prompt`).
9. Bất kỳ lỗi nào ở 6–8 → run `FAILED` + lưu `error`, ném lỗi lên.
10. Gắn `paneId` vào run (nếu run đã bị STOP trong lúc khởi động → đóng pane, 409).
11. Subscribe sự kiện Herdr của pane → mỗi thay đổi bắn `board changed` qua Socket.IO; bắn thêm 1 lần sau
    `STARTUP_GRACE_MS + 1s` (16s).

## 5. Prompt gửi cho agent

Ghép từ các phần (`agent-runs/utils/`):

- **Header** (`promptHeader`): "Read and follow `<path>/AGENT.md`", `extraInstructions` của ticket, danh sách rule
  (profile ∪ ticket, bỏ trùng), skill (profile + skill ticket cùng provider), ticket cha (key, summary, description),
  ticket (key, summary, Jira URL, description), spec file nếu có, đường dẫn repo.
- **Task theo step**:
  - SPEC: viết spec tiếng Việt, chỉ đọc code, thiếu thông tin thì hỏi owner. Có feedback → kèm spec hiện tại
    (có thể đã được owner sửa) + feedback, yêu cầu viết lại.
  - DEV: implement spec đã duyệt / sửa theo feedback / sửa **tất cả** test fail trong một lượt. Không commit, push,
    đổi branch.
  - TEST/WRITE_CASES: viết test case (gồm thao tác browser), không sửa file repo.
  - TEST/RUN_CASES: tự bật dev server, chạy tất cả case, không sửa code, tắt server khi xong.
- **Output contract**: ghi kết quả vào `<runDir>/output.md|json`, rồi chạy
  `curl -X POST -H 'x-run-token: <token>' http://127.0.0.1:<PORT>/api/v1/agent-runs/<id>/complete`.

## 6. Hoàn thành run — `POST /agent-runs/:id/complete`

Endpoint không cần client header (agent gọi bằng curl), xác thực bằng `x-run-token` (so sánh timing-safe).

1. `claim`: run phải `RUNNING`; đọc file output, rỗng/thiếu → 400 và run **vẫn RUNNING** để agent sửa rồi gọi lại.
2. TEST: parse JSON (`parseTestCases` / `parseTestResults`); sai format → 400, run vẫn RUNNING.
3. Trong 1 transaction: kiểm tra ticket còn ở trạng thái mong đợi (SPEC→`IN_SPEC`, DEV→`IN_PROGRESS`,
   RUN_CASES→`IN_TESTING`; WRITE_CASES chỉ cần ticket chưa đóng). Không khớp → run `STOPPED`, bỏ kết quả. Khớp → run
   `COMPLETED` và ghi kết quả + chuyển trạng thái (bảng mục 3).
4. Ngoài transaction: huỷ subscribe pane, bắn board changed, dispatch bước tiếp theo (DEV fix / RUN_CASES). Lỗi
   dispatch bước tiếp chỉ được `logger.warn`.

Pane **không bị đóng** khi run xong — để lần sau dùng lại (mục 4.7). Pane chỉ đóng khi ticket DONE/CANCELED.

## 7. Dừng, khôi phục, hiển thị

- **Stop** (`POST tickets/:id/stop`, nút "Stop agents"): đánh dấu run RUNNING → `STOPPED` (ở `IN_SPEC` chỉ SPEC, và
  đưa ticket về `IN_REVIEW_SPEC` nếu đã có spec, ngược lại `TODO`). Chỉ huỷ subscribe; **không đóng pane, không
  ngắt agent**. Callback đến sau sẽ nhận 409.
- **Daemon restart** (`onModuleInit`): run RUNNING có pane còn sống → subscribe lại; pane mất → `FAILED`
  ("Agent pane is gone"). Nếu Herdr không trả lời lúc khởi động thì bỏ qua toàn bộ bước này.
- **Board label** (`tickets/utils/board-label.ts`), dùng trạng thái pane sống từ Herdr:
  - `needs_you`: có run RUNNING mà pane `blocked`, hoặc đã quá 15s mà pane không `working`; hoặc run gần nhất
    `FAILED` khi ticket ở `IN_SPEC/IN_PROGRESS/IN_TESTING`; hoặc ticket `IN_TESTING` không có run.
  - `running`: có run RUNNING; `approved`: `IN_REVIEW_SPEC` đã approve.

## 8. Giới hạn & vấn đề đã thấy

Tải giả định: 1 owner, 1 daemon local, vài ticket chạy song song. Kiểm tra trên code, chưa chạy thử.

1. **Stop không dừng agent thật** (`agent-runs.service.ts:315-329`). Run bị đánh dấu STOPPED nhưng agent trong pane
   vẫn tiếp tục sửa repo. Lần dispatch sau cùng step (ví dụ owner gửi feedback ngay) đi qua `reusablePane`
   (`:357-380`) và gõ prompt mới vào **chính pane đang bận** đó → hai nhiệm vụ chồng lên nhau trong một phiên agent.
   Hướng sửa nhỏ: Stop thì `closeAgent(paneId)` cho các run vừa dừng (như `closeTicketPanes` đã làm).
2. **Ticket kẹt im lặng ở `IN_PROGRESS`** (`ticket-flow.service.ts:126-158`). RUN_CASES có lỗi → transaction đã chuyển
   ticket sang `IN_PROGRESS`; sau đó `startDev` ném lỗi **trước khi tạo run** (repo bị chuyển sang branch khác,
   thiếu `AGENT.md`, ticket bị gỡ dev agent…) → chỉ có `logger.warn`. Board: không run RUNNING, run gần nhất là
   RUN_CASES `COMPLETED` → label `null`; owner không thấy gì cần xử lý. Lối thoát duy nhất là tự gửi feedback dev.
3. **Hết lượt fix** (`MAX_FIX_ROUNDS = 2`): ticket nằm ở `IN_TESTING` với test fail; owner phải tự kéo sang
   `IN_REVIEW` hoặc gửi feedback (reset `fixRound`). Đây là thiết kế, ghi lại để rõ hành vi.
4. **Không có timeout cho run**: agent không bao giờ gọi curl (crash, quên, bị từ chối quyền) thì run RUNNING mãi;
   chỉ có label `needs_you` (khi pane không còn `working`) và nút Stop.
5. **Agent chọn theo ticket, không theo hàng đợi**: không có giới hạn số agent chạy đồng thời toàn hệ thống, không có
   hàng đợi / ưu tiên; mỗi lần dispatch mở một pane mới (trừ khi dùng lại được). Một repo chỉ bị khoá với ticket khác
   ở thời điểm tạo branch (`repoConflicts`).
