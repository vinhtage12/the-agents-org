import { memo } from 'react';

import { TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import BoardCard from './BoardCard';

import type { IBoardTicket, TicketStatus } from './types';
export interface IBoardColumnProps {
  status: TicketStatus;
  tickets: IBoardTicket[];
}
const BoardColumn = ({ status, tickets }: IBoardColumnProps) => (
  <TmnFlex
    direction="column"
    gap={2}
    className="w-56 shrink-0 rounded-lg bg-muted/40 p-2"
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
      <BoardCard key={t.id} ticket={t} />
    ))}
  </TmnFlex>
);
export default memo(BoardColumn);
