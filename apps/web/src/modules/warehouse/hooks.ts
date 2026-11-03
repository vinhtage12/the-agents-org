import { useQueryClient } from '@tanstack/react-query';

import {
  RequestMethods,
  useMutationEnhancer,
  useQueryEnhancer
} from '@truyenmoinhu/query';
import { UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { WAREHOUSE_ENDPOINTS, WAREHOUSE_QUERY_KEYS } from './constants';
import { WarehouseError } from './error';

import type {
  IUsage,
  IWarehouseListResponse,
  IWarehouseMutationVariables,
  WarehouseKind
} from './types';

export const useWarehouseList = <TRow>(
  kind: WarehouseKind,
  params?: Record<string, string>
) =>
  useQueryEnhancer<TRow[]>({
    queryKey: [WAREHOUSE_QUERY_KEYS.list, kind, params],
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<
        IWarehouseListResponse<TRow>
      >({
        url: WAREHOUSE_ENDPOINTS[kind](),
        params,
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new WarehouseError(result?.code);
      }
      return result.payload.data;
    }
  });

export const useWarehouseDetail = <TDetail>(
  kind: WarehouseKind,
  id: number | undefined
) =>
  useQueryEnhancer<TDetail>({
    queryKey: [WAREHOUSE_QUERY_KEYS.detail, kind, id],
    enabled: id !== undefined,
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<TDetail>({
        url: WAREHOUSE_ENDPOINTS[kind](String(id)),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new WarehouseError(result?.code);
      }
      return result.payload;
    }
  });

export const useWarehouseUsage = (
  kind: WarehouseKind,
  id: number | undefined
) =>
  useQueryEnhancer<IUsage>({
    queryKey: [WAREHOUSE_QUERY_KEYS.usage, kind, id],
    enabled: id !== undefined,
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IUsage>({
        url: WAREHOUSE_ENDPOINTS[kind](`${id}/usage`),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new WarehouseError(result?.code);
      }
      return result.payload;
    }
  });

export const useWarehouseMutation = <
  TResponse = unknown,
  TData = unknown
>() => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<TResponse, IWarehouseMutationVariables<TData>>({
    mutationFn: async ({ apiManager, variables }) => {
      if (!apiManager || !variables) {
        throw new WarehouseError();
      }
      const { kind, path, ...request } = variables;
      const result = await apiManager.sendRequest<TResponse>({
        ...request,
        url: WAREHOUSE_ENDPOINTS[kind](path),
        suppressNotifyOnError: true
      });
      // Usage and "in use" counts of other kinds depend on this change too.
      await Promise.all(
        Object.values(WAREHOUSE_QUERY_KEYS).map(queryKey =>
          queryClient.invalidateQueries({ queryKey: [queryKey] })
        )
      );
      if (!result.success) {
        throw new WarehouseError(result.code, result.message);
      }
      return result.payload;
    }
  });
};

// Confirms, then deletes; the daemon answers 409 when the item is still in use.
export const useDeleteWarehouseItem = (kind: WarehouseKind) => {
  const mutation = useWarehouseMutation();
  return (id: number, name: string) => {
    const modal = `warehouse-delete-${kind}-${id}`;
    UIUtils.alert.open({
      name: modal,
      title: trans('warehouse.delete_title'),
      message: trans('warehouse.delete_message', { name }),
      cancelTitle: trans('warehouse.cancel'),
      actions: () => [
        {
          kind: 'primary',
          children: trans('warehouse.delete'),
          onClick: async () => {
            UIUtils.alert.dismissByName(modal);
            try {
              await mutation.mutateAsync({
                kind,
                path: String(id),
                method: RequestMethods.DELETE
              });
              UIUtils.notify.success(trans('warehouse.deleted'));
            } catch (e) {
              UIUtils.notify.error(
                e instanceof Error ? e.message : trans('warehouse.save_failed')
              );
            }
          }
        }
      ]
    });
  };
};
