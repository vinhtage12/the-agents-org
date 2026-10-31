import { memo } from 'react';

import { TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import type { IBoardTicket } from './types';
export interface IBoardCardProps {
  ticket: IBoardTicket;
}
const BoardCard = ({ ticket }: IBoardCardProps) => (
  <TmnFlex
    direction="column"
    gap={1}
    className="rounded-md border border-border bg-card p-2"
  >
    <TmnText weight="bold" className="text-xs">
      {ticket.jiraKey}
    </TmnText>
    <TmnText className="truncate text-sm" title={ticket.summary}>
      {ticket.summary}
    </TmnText>
  </TmnFlex>
);
export default memo(BoardCard);
