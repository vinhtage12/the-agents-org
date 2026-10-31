import { memo } from 'react';

import { TmnChip, TmnDnD, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { LABEL_COLORS, MOVABLE } from './constants';

import type { IBoardTicket } from './types';
export interface IBoardCardProps {
  ticket: IBoardTicket;
  pending: boolean;
}
const BoardCard = ({ ticket, pending }: IBoardCardProps) => (
  <TmnDnD.Draggable
    id={`board-ticket-${ticket.id}`}
    type="board-ticket"
    data={{ ticketId: ticket.id, status: ticket.status }}
    disabled={pending || !MOVABLE[ticket.status]}
  >
    {({ isDragging }) => (
      <TmnFlex
        direction="column"
        gap={1}
        className={`rounded-md border border-border bg-card p-2 ${MOVABLE[ticket.status] ? 'cursor-grab' : ''} ${isDragging || pending ? 'opacity-40' : ''}`}
      >
        <TmnFlex direction="row" align="center" gap={2} className="min-w-0">
          <TmnText weight="bold" className="truncate text-xs">
            {ticket.jiraKey}
          </TmnText>
          {ticket.specVersion !== null && (
            <TmnText className="shrink-0 text-xs text-muted-foreground">
              v{ticket.specVersion}
            </TmnText>
          )}
        </TmnFlex>
        <TmnText className="truncate text-sm" title={ticket.summary}>
          {ticket.summary}
        </TmnText>
        {ticket.label && (
          <TmnChip color={LABEL_COLORS[ticket.label]} className="self-start">
            {trans(`ticket.label.${ticket.label}`)}
          </TmnChip>
        )}
      </TmnFlex>
    )}
  </TmnDnD.Draggable>
);
export default memo(BoardCard);
