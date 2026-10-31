import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import {
  RequestMethods,
  useMutationEnhancer,
  useQueryEnhancer
} from '@truyenmoinhu/query';

import { TICKET_ENDPOINTS, TICKET_QUERY_KEYS } from './constants';
import { TicketError } from './error';
import { openBoardEvents } from './socket';

import type {
  IBoardTicket,
  ILinkTicket,
  IMoveTicket,
  ISyncResult,
  ITicketDetail,
  ITicketRequest,
  ITicketStore,
  IUpdateTicket
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
export const useMoveTicket = () => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<unknown, IMoveTicket>({
    mutationFn: async ({ apiManager, variables }) => {
      if (!apiManager || !variables) {
        throw new TicketError();
      }
      try {
        const result = await apiManager.sendRequest<unknown>({
          url: TICKET_ENDPOINTS.tickets(`${variables.ticketId}/move`),
          method: RequestMethods.POST,
          data: { to: variables.to },
          suppressNotifyOnError: true
        });
        if (!result.success) {
          throw new TicketError(result.code, result.message);
        }
        return result.payload;
      } finally {
        // Refetch even on failure: the daemon may have rolled the card back.
        await queryClient.invalidateQueries({
          queryKey: [TICKET_QUERY_KEYS.board]
        });
        await queryClient.invalidateQueries({
          queryKey: [TICKET_QUERY_KEYS.detail]
        });
      }
    }
  });
};
export const useBoardEvents = (projectId: number) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = openBoardEvents(changed => {
      if (changed !== projectId) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.board, projectId]
      });
      void queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.detail]
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [projectId, queryClient]);
};
export const useTicketDetail = (ticketId: number) =>
  useQueryEnhancer<ITicketDetail>({
    queryKey: [TICKET_QUERY_KEYS.detail, ticketId],
    queryFn: async ({ apiManager }) => {
      const result = await apiManager?.sendRequest<ITicketDetail>({
        url: TICKET_ENDPOINTS.tickets(String(ticketId)),
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload) {
        throw new TicketError(result?.code, result?.message);
      }
      return result.payload;
    }
  });
const useTicketRequest = <TData>(path: string, method: RequestMethods) => {
  const queryClient = useQueryClient();
  return useMutationEnhancer<ITicketDetail, ITicketRequest<TData>>({
    mutationFn: async ({ apiManager, variables }) => {
      if (!apiManager || !variables) {
        throw new TicketError();
      }
      const result = await apiManager.sendRequest<ITicketDetail>({
        url: TICKET_ENDPOINTS.tickets(`${variables.ticketId}${path}`),
        method,
        data: variables.data,
        suppressNotifyOnError: true
      });
      // Failed spec runs roll the card back, so refetch either way.
      await queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.detail, variables.ticketId]
      });
      await queryClient.invalidateQueries({
        queryKey: [TICKET_QUERY_KEYS.board]
      });
      if (!result.success || !result.payload) {
        throw new TicketError(result.code, result.message);
      }
      return result.payload;
    }
  });
};
export const useUpdateTicket = () =>
  useTicketRequest<IUpdateTicket>('', RequestMethods.PATCH);
export const useSaveSpec = () =>
  useTicketRequest<{ content: string }>('/spec', RequestMethods.PUT);
export const useSpecFeedback = () =>
  useTicketRequest<{ feedback: string }>('/spec/feedback', RequestMethods.POST);
export const useStopSpec = () =>
  useTicketRequest<undefined>('/spec/stop', RequestMethods.POST);
export const useApproveSpec = () =>
  useTicketRequest<undefined>('/spec/approve', RequestMethods.POST);
