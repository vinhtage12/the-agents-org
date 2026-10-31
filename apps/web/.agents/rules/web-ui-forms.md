---
description: UIKit, controlled forms, translation and presentation rules for web.
globs: "apps/web/src/**"
alwaysApply: false
---

# Web UI, forms and i18n

**Scope:** package `web`, `apps/web/src/**`; đặc biệt components, modules, layouts và form hooks/helpers. Đây là quy ước dùng các package `@truyenmoinhu/*` trong app, không phải yêu cầu sửa source của các package đó.

- Dùng `@truyenmoinhu/uikit` trước khi tự dựng UI hoặc thêm thư viện: `TmnFlex`, `TmnBox`, `TmnText`, `TmnCard`, `TmnButton`, `TmnLink`, `TmnInput`, `TmnCallout`, `TmnLoading`... Dùng `TmnDnD` cho kéo thả và `UIUtils.notify`/`UIUtils.alert` cho thông báo/xác nhận.
- Ưu tiên props uikit (`kind`, `variant`, `gap`...), sau đó Tailwind `className` để override, responsive và sizing. Dùng token theme (`bg-card`, `border-border`, `text-muted-foreground`). Chỉ dùng modifier `!` khi cần override thật sự.
- `TmnFlex` mặc định column: chỉ định `direction="row"` cho hàng ngang. HTML semantic và `canvas` vẫn hợp lệ; không tự viết lại widget đã có trong uikit.
- Kết hợp Router Link qua `asChild`; không lồng interactive elements. Icon dùng `lucide-react`; icon-only action có accessible label. Giữ keyboard/focus, trạng thái disabled/loading và contrast ở cả hai theme.
- Nội dung dài cần `min-w-0`, `truncate`, `shrink-0` phù hợp; kiểm tra chiều rộng sidebar/scroll area và không để action bị đẩy ra ngoài.
- Form dùng `TmnForm`, `useFormResolver`, `validation`, `TmnController` từ `@truyenmoinhu/form`. **Mỗi field uikit đi qua `TmnController`**, kể cả TextField; map `field` và `fieldState.error` sang component, không mặc định dùng `form.register`.
- Khai báo form values có type tái sử dụng, `defaultValues` đầy đủ và schema validate tương ứng. Schema độc lập đặt ngoài component; schema có message dịch dùng factory gọi trong locale hiện tại, không giữ bản dịch từ thời điểm import.
- Submit bằng `handleSubmit`; khóa submit với `isSubmitting`/mutation pending, giữ input khi lỗi; lỗi field hiển thị tại field, lỗi request chung dùng `TmnCallout`.
- **Ưu tiên `trans` từ `#i18n` thay cho `t` lấy từ `useTranslation`** trong JSX, validation, handlers và notifications. `useTranslation` chỉ còn cần cho subscription hoặc đối tượng `i18n`; không destructure `t`.
- Giữ subscription đổi locale ở root để các component dùng `trans` cập nhật. Không bỏ cơ chế đó khi refactor. Thêm key dịch ở cả `vi` và `en`; không hardcode chuỗi UI.
- Dùng `formatDate` từ `#utils/date`: `DD/MM/YYYY` hoặc `DD/MM/YYYY HH:mm`. Không dùng `toLocaleString()` trực tiếp cho ngày trong UI.
- **Không dùng `·` (middle dot) làm dấu phân cách** trong chuỗi UI, label, `title` và bản dịch. Chọn theo vai trò:
  - ` - ` nối hai phần ngang hàng của một tên: `${p.code} - ${p.name}`, `${p.name} - ${p.provider}`.
  - `( )` cho thông tin phụ của phần chính: `${r.name} (${r.path})`, `${agent.name} (${agent.model})`.
  - ` | ` tách các mục độc lập cùng một dòng, như số liệu hay trạng thái: `${w.label} | ${w.usedPercent}%`.
- Navigation nội bộ dùng TanStack Router `Link`/`useNavigate` và params có kiểu; không dùng `window.location` hay reload để điều hướng.
- Chart chỉ dùng dữ liệu thực; không biến thiếu quota/stats thành `0`, không giả lập lịch sử. Cleanup Chart.js instance, socket, subscription và listener khi unmount.
