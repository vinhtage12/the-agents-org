---
description: Function syntax, control flow, naming and reusable types for package web.
globs: "apps/web/**/*.{ts,tsx,js,cjs,mjs}"
alwaysApply: false
---

# Web TypeScript and code style

**Scope:** code do dự án quản lý trong package `web` (`apps/web`), gồm source, config và scripts. Không chỉnh generated code hoặc dependency để thỏa các quy tắc này. Không áp dụng sang daemon/package khác nếu chưa có chỉ định.

- **Ưu tiên arrow function cho mọi định nghĩa hàm và callback, kể cả component**: `const Component = (...) => ...`, `export const helper = (...) => ...`. Không thêm `function` declaration/expression khi arrow đáp ứng semantics. Constructor và syntax bắt buộc bởi API/ngôn ngữ là ngoại lệ; không thay semantics của dynamic `this` chỉ để chuyển syntax.
- Component tách file ưu tiên `const Component = (...) => ...; export default memo(Component)`. Không dùng `memo` hoặc `useMemo` để che lỗi data flow/dependencies.
- **Ưu tiên early return** cho input không hợp lệ, loading, error, missing data và điều kiện không xử lý. Tránh chuỗi `else` và ternary lồng nhau cho logic nghiệp vụ; conditional JSX đơn giản vẫn hợp lệ.
- **Mọi thân `if` phải có `{}`**, dù chỉ chứa một `return`, `throw` hay một câu lệnh. `else` cũng dùng block; `else if (...) { ... }` hợp lệ. Không gọi hook có điều kiện hoặc sau một early return phụ thuộc state/props.
- Interface dùng tiền tố `I`; type alias PascalCase; component/file component PascalCase; functions/variables camelCase; hooks `use...`; constants UPPER_SNAKE_CASE.
- Props phải có interface/type tên rõ ràng. Nếu đã có `IEntityFormProps`, dùng nó; không chép cấu trúc props inline lần nữa.
- **Ưu tiên khả năng kế thừa và generic** khi có quan hệ dùng lại thực tế: interface `extends`, `Pick`/`Omit`, generic có constraints/defaults. Không duplicate entity/request/presentation fields. Không tạo generic không có tác dụng hoặc buộc những cấu trúc khác nghĩa vào cùng abstraction.
- Dùng `unknown` cho dữ liệu chưa xác định, narrow trước khi dùng; tránh `any`, non-null assertion và cast chỉ để compiler im lặng. Giữ khác biệt giữa missing data và giá trị `0`.
- Dùng type-only imports. Biome là nguồn quyết định formatting/import ordering; tách các khối hooks, derived values, handlers và JSX bằng dòng trống.

```ts
export interface IEntity<TId = number> {
  id: TId;
  name: string;
}

export interface IProject extends IEntity {
  workspaceId: number;
}

export const findProject = <TProject extends IProject>(
  projects: TProject[],
  id: number
): TProject | undefined => {
  if (id <= 0) {
    return undefined;
  }

  return projects.find(project => project.id === id);
};
```
