import { memo, useState } from 'react';

import {
  TmnButton,
  TmnCallout,
  TmnDnD,
  type TmnDnDRootProps,
  TmnFlex,
  TmnLoading,
  TmnScrollArea,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import BoardColumn from './BoardColumn';
import {
  AGENT_START_STATUSES,
  MOVABLE,
  TICKET_DIALOG,
  TICKET_STATUSES
} from './constants';
import { TicketError } from './error';
import {
  useBoardEvents,
  useMoveTicket,
  useProjectTickets,
  useRepoConflicts
} from './hooks';
import TicketDialog from './TicketDialog';

import type { IAgentOption, IRepoConflict, TicketStatus } from './types';

export interface IProjectBoardProps {
  projectId: number;
  profiles: IAgentOption[];
}
const ProjectBoard = ({ projectId, profiles }: IProjectBoardProps) => {
  const { data, isLoading, error, refetch } = useProjectTickets(projectId);
  const move = useMoveTicket();
  const conflicts = useRepoConflicts();
  const [pendingId, setPendingId] = useState<number | null>(null);
  useBoardEvents(projectId);

  const openTicket = (ticketId: number) => {
    UIUtils.popup.open(TICKET_DIALOG, {
      size: 'xl',
      content: () => <TicketDialog ticketId={ticketId} profiles={profiles} />
    });
  };

  const doMove = async (ticketId: number, to: TicketStatus) => {
    setPendingId(ticketId);
    try {
      await move.mutateAsync({ ticketId, to });
    } catch (e) {
      UIUtils.notify.error(
        e instanceof TicketError && e.message
          ? e.message
          : trans('ticket.move_failed')
      );
    } finally {
      setPendingId(null);
    }
  };

  const onDragEnd: TmnDnDRootProps['onDragEnd'] = async event => {
    if (event.canceled) {
      return;
    }
    const source = event.operation.source?.data;
    const target = event.operation.target?.data;
    if (!source || !target || typeof source.ticketId !== 'number') {
      return;
    }
    const from = source.status as TicketStatus;
    const to = target.status as TicketStatus;
    if (from === to || !MOVABLE[from]?.includes(to)) {
      return;
    }
    const ticketId: number = source.ticketId;
    if (AGENT_START_STATUSES.includes(to)) {
      let overlapping: IRepoConflict[] = [];
      try {
        overlapping = (await conflicts.mutateAsync(ticketId)) ?? [];
      } catch {
        // Warning only: a failed lookup must not block the move.
      }
      if (overlapping.length) {
        const modal = `repo-conflict-${ticketId}`;
        UIUtils.alert.open(modal, {
          title: trans('ticket.repo_conflict_title'),
          message: trans('ticket.repo_conflict_body', {
            keys: overlapping.map(t => t.jiraKey).join(', ')
          }),
          cancelTitle: trans('ticket.cancel'),
          actions: () => [
            {
              kind: 'primary',
              children: trans('ticket.continue'),
              onClick: () => {
                UIUtils.alert.dismissByName(modal);
                void doMove(ticketId, to);
              }
            }
          ]
        });
        return;
      }
    }
    await doMove(ticketId, to);
  };

  if (isLoading) {
    return <TmnLoading />;
  }
  if (error || !data) {
    return (
      <TmnCallout color="red">
        <TmnText>{trans('ticket.load_failed')}</TmnText>
        <TmnButton onClick={() => refetch()}>{trans('ticket.retry')}</TmnButton>
      </TmnCallout>
    );
  }

  return (
    <TmnDnD.Root onDragEnd={onDragEnd}>
      <TmnScrollArea scrollbars="both">
        <TmnFlex direction="row" gap={3} className="min-w-0 pb-2">
          {TICKET_STATUSES.map(status => (
            <BoardColumn
              key={status}
              status={status}
              tickets={data.filter(t => t.status === status)}
              pendingId={pendingId}
              onOpen={openTicket}
            />
          ))}
        </TmnFlex>
      </TmnScrollArea>
    </TmnDnD.Root>
  );
};
export default memo(ProjectBoard);
