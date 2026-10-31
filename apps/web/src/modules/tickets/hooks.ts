import { useQueryClient } from '@tanstack/react-query';

import {
  RequestMethods,
  useMutationEnhancer,
  useQueryEnhancer
} from '@truyenmoinhu/query';

import { TICKET_ENDPOINTS, TICKET_QUERY_KEYS } from './constants';
import { TicketError } from './error';

import type {
  IBoardTicket,
  ILinkTicket,
  ISyncResult,
  ITicketStore
} from './types';
export const useTicketStore = () =>
  useQueryEnhancer<ITicketStore>({
    queryKey: [TICKET_QUERY_KEYS.store],
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<ITicketStore>({
        url: TICKET_ENDPOINTS.tickets('store'),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new TicketError(result?.code);
      }
      return result.payload;
    }
  });
export const useProjectTickets = (projectId: number) =>
  useQueryEnhancer<IBoardTicket[]>({
    queryKey: [TICKET_QUERY_KEYS.board, projectId],
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<IBoardTicket[]>({
        url: TICKET_ENDPOINTS.projects(`${projectId}/tickets`),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new TicketError(result?.code);
      }
      return result.payload;
    }
  });
export const useSyncTickets = () => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<ISyncResult, undefined>({
    mutationFn: async ({ apiManager }) => {
      if (!apiManager) {
        throw new TicketError();
      }
      const result = await apiManager.sendRequest<ISyncResult>({
        url: TICKET_ENDPOINTS.tickets('sync'),
        method: RequestMethods.POST,
        suppressNotifyOnError: true
      });
      if (!result.success || !result.payload) {
        throw new TicketError(result.code);
      }
      await queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.store]
      });
      await queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.board]
      });
      return result.payload;
    }
  });
};
export const useLinkTickets = () => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<{ linked: number }, ILinkTicket[]>({
    mutationFn: async ({ apiManager, variables }) => {
      if (!apiManager || !variables) {
        throw new TicketError();
      }
      const result = await apiManager.sendRequest<{ linked: number }>({
        url: TICKET_ENDPOINTS.tickets('link'),
        method: RequestMethods.POST,
        data: { links: variables },
        suppressNotifyOnError: true
      });
      if (!result.success || !result.payload) {
        throw new TicketError(result.code);
      }
      await queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.store]
      });
      await queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.board]
      });
      return result.payload;
    }
  });
};
