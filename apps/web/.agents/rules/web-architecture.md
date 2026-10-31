---
description: Architecture, component files and export portals for the web app.
globs: "apps/web/**"
alwaysApply: false
---

# Web architecture

**Scope:** package `web`, toàn bộ `apps/web/**`. Không tự áp dụng cho `apps/daemon`, `apps/infrastructure`, external packages hoặc các app khác. Bỏ qua `node_modules`, `dist`, cache và file generated khi audit source.

- Routes chỉ khai báo route và compose module/layout. Đặt feature trong `src/modules/<feature>/`; shared UI trong `src/components/`.
- **Mỗi component có một file `.tsx` riêng**, tên PascalCase trùng tên component. Không định nghĩa nhiều named component trong một file; callback render prop của thư viện không phải component độc lập.
- **Không có `index.tsx`. Chỉ dùng `index.ts` làm portal re-export**, không khai báo component, hook, types, constants hoặc logic bên trong. Public entry export các component và named exports của module; giữ default export nếu caller đang dùng.
- Index route của TanStack Router dùng `home.ts` theo `indexToken: 'home'` trong cả `tsr.config.json` và Vite plugin. File này khai báo route và import component từ module, giữ nguyên URL `/`. Không dùng `index.ts` chứa logic route hoặc re-export route mà generator không nhận diện. **File trong `src/routes/**` chấp nhận cả `.ts` và `.tsx`**: dùng `.ts` khi route chỉ trỏ tới component của module, dùng `.tsx` khi route cần JSX (`component: () => <Page />`, `pendingComponent`, `errorComponent`...). Route `.tsx` vẫn không định nghĩa component nghiệp vụ; tên file theo quy ước TanStack, không theo PascalCase. Không sửa tay `src/routeTree.gen.ts`; dùng `generate-routes`.
- Tách trách nhiệm: `EntityForm.tsx`, `WorkspaceLink.tsx`, `types.ts`, `hooks.ts`, `constants.ts`, `utils.ts`, `error.ts`. Module lớn có thể nhóm vào `components/`, `hooks/`, `utils/`... Không tạo file/thư mục rỗng chỉ để đủ mẫu.
- Bên ngoài module, import qua portal `#modules/<feature>`. Bên trong module dùng relative imports. Không import xuyên vào implementation của feature khác.
- Giữ chiều phụ thuộc các lớp dùng chung: `types/utils/constants → stores → hooks → components → layouts/modules → routes`. Shared component không import feature module; compose ở layout/module/route rồi truyền props/children.
- Helper dùng chung nằm trong `src/utils/`; helper đặc thù feature ở lại feature. Không duplicate helper như `withGenerateEndpoint`.
- Dùng alias `#components`, `#hooks`, `#constants`, `#utils`, `#i18n`, `#modules`, `#layouts` giữa các vùng của app. Import folder, không ghi `/index`, `/index.ts`, `/index.tsx`.

```text
modules/example/
  ExamplePage.tsx
  ExampleForm.tsx
  types.ts
  hooks.ts
  constants.ts
  utils.ts
  index.ts          # chỉ export ... from './...'
```

Trước khi hoàn thành thay đổi code, chạy từ repo root:

```bash
rtk pnpm --filter web audit:codestyle
rtk proxy pnpm --filter web typecheck
rtk pnpm --filter web exec biome check .
rtk pnpm --filter web build
```

Không dùng root `pnpm test` để xác nhận web. Với thay đổi UI, kiểm tra desktop/mobile, light/dark, loading/error/empty và luồng tương tác bị ảnh hưởng. Không format hoặc refactor code ngoài scope task.
