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
import { MOVABLE, TICKET_STATUSES } from './constants';
import { TicketError } from './error';
import { useBoardEvents, useMoveTicket, useProjectTickets } from './hooks';

import type { TicketStatus } from './types';

export interface IProjectBoardProps {
  projectId: number;
}
const ProjectBoard = ({ projectId }: IProjectBoardProps) => {
  const { data, isLoading, error, refetch } = useProjectTickets(projectId);
  const move = useMoveTicket();
  const [pendingId, setPendingId] = useState<number | null>(null);
  useBoardEvents(projectId);

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
    setPendingId(source.ticketId);
    try {
      await move.mutateAsync({ ticketId: source.ticketId, to });
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
            />
          ))}
        </TmnFlex>
      </TmnScrollArea>
    </TmnDnD.Root>
  );
};
export default memo(ProjectBoard);
