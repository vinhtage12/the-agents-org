import { memo } from 'react';

import { TmnBox, TmnDnD, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import BoardCard from './BoardCard';
import { DROP_TARGETS } from './constants';

import type { IBoardTicket, TicketStatus } from './types';
export interface IBoardColumnProps {
  status: TicketStatus;
  tickets: IBoardTicket[];
  pendingId: number | null;
}
const BoardColumn = ({ status, tickets, pendingId }: IBoardColumnProps) => (
  <TmnDnD.Droppable
    id={`board-col-${status}`}
    accept="board-ticket"
    data={{ status }}
    disabled={!DROP_TARGETS.has(status)}
    className="w-56 shrink-0"
  >
    {({ isDropTarget }) => (
      <TmnBox
        className={`flex h-full min-h-60 flex-col gap-2 rounded-lg p-2 transition-colors ${isDropTarget ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/40'}`}
      >
        <TmnFlex direction="row" justify="between" align="center">
          <TmnText weight="bold" className="truncate text-xs uppercase">
            {trans(`ticket.status.${status}`)}
          </TmnText>
          <TmnText className="text-xs text-muted-foreground">
            {tickets.length}
          </TmnText>
        </TmnFlex>
        {tickets.map(t => (
          <BoardCard key={t.id} ticket={t} pending={pendingId === t.id} />
        ))}
      </TmnBox>
    )}
  </TmnDnD.Droppable>
);
export default memo(BoardColumn);
