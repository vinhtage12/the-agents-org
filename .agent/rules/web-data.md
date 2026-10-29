---
description: Query and mutation callback context, endpoints, cache and API errors for web.
globs: "apps/web/src/**"
alwaysApply: false
---

# Web queries and mutations

**Scope:** package `web`, query/mutation hooks, API helpers và caller trong `apps/web/src/**`. Không thay đổi API daemon hoặc internals của `@truyenmoinhu/query` theo file này.

- Ưu tiên `@truyenmoinhu/query`; không tạo fetch/Axios client song song cho API daemon. Hooks nằm trong `hooks.ts` hoặc `hooks/`, không nhét request vào JSX.
- **Lấy `apiManager` từ callback context cho cả query lẫn mutation**: `queryFn: async ({ apiManager }) => ...`, `mutationFn: async ({ apiManager, variables }) => ...`. Quy tắc áp dụng cho mọi enhancer/custom callback của `@truyenmoinhu/query` có cung cấp context.
- Không đóng kín singleton `apiManagerInstance` trong query/mutation callback hoặc helper mà callback gọi. Helper tái sử dụng nhận manager qua tham số; truyền tiếp manager từ context. Singleton chỉ dùng ở provider/bootstrap hoặc imperative API ngoài query/mutation.
- Đặt query keys/endpoints theo feature trong `constants.ts`; dùng `generateQueryKey`, `withGenerateEndpoint` từ `#utils/query`, `RequestMethods` thay literal HTTP method. Query và invalidation dùng cùng constants/key shape.
- Type request/response bằng interface tái sử dụng, dùng generic cho helper/mutation có cùng contract. Kiểm tra `success` trước khi dùng payload. DELETE 204 có thể trả null payload và vẫn là thành công.
- Custom mutation phải invalidate cache sau thành công, kể cả DELETE không có response ID. Không phụ thuộc một invalidation helper nếu helper đó chỉ chạy khi response có ID.
- Chỉ dùng QueryClient/provider hiện có; trong hook lấy client bằng `useQueryClient`. Không tạo QueryClient riêng trong feature/component.
- Error class đặc thù đặt trong `error.ts`. Dùng status để phân biệt lỗi nghiệp vụ; không nuốt lỗi và không báo thành công khi request thất bại.
- Dùng `suppressNotifyOnError` khi caller tự hiển thị lỗi để tránh thông báo trùng. Giữ trạng thái pending và dữ liệu hiện tại khi mutation thất bại.

```ts
export const useSaveEntity = () => useMutationEnhancer<
  IEntity,
  ISaveEntityVariables
>({
  mutationFn: async ({ apiManager, variables }) => {
    if (!apiManager || !variables) {
      throw new Error('Missing API context or mutation variables');
    }

    const result = await apiManager.sendRequest<IEntity>({
      url: ENTITY_ENDPOINTS.base(),
      method: RequestMethods.POST,
      data: variables
    });

    if (!result.success) {
      throw new EntityError(result.code);
    }

    return result.payload;
  }
});
```
