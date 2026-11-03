import { type KeyboardEvent, memo } from 'react';

import { TmnChip, TmnDnD, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { AgentAvatar } from '#modules/warehouse';

import { LABEL_COLORS } from '../constants';
import { canDrag } from '../utils';
import TicketLink from './ticket/TicketLink';

import type { IBoardTicket } from '../types';
export interface IBoardCardProps {
  ticket: IBoardTicket;
  pending: boolean;
  onOpen: (ticketId: number) => void;
}
const BoardCard = ({ ticket, pending, onOpen }: IBoardCardProps) => {
  const draggable = canDrag(ticket);
  return (
    <TmnDnD.Draggable
      id={`board-ticket-${ticket.id}`}
      type="board-ticket"
      data={{ ticketId: ticket.id, status: ticket.status }}
      disabled={pending || !draggable}
    >
      {({ isDragging }) => (
        <TmnFlex
          direction="column"
          gap={2}
          role="button"
          tabIndex={0}
          aria-label={trans('ticket.open_ticket', { key: ticket.jiraKey })}
          onClick={() => onOpen(ticket.id)}
          onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpen(ticket.id);
            }
          }}
          className={`rounded-md border border-border bg-card p-3 shadow-sm hover:bg-muted/50 ${draggable ? 'cursor-grab' : ''} ${isDragging || pending ? 'opacity-40' : ''}`}
        >
          <TmnText className="line-clamp-3 text-sm" title={ticket.summary}>
            {ticket.summary}
          </TmnText>
          {ticket.label && (
            <TmnFlex direction="row">
              <TmnChip color={LABEL_COLORS[ticket.label]}>
                {trans(`ticket.label.${ticket.label}`)}
              </TmnChip>
            </TmnFlex>
          )}
          <TmnFlex direction="row" align="center" justify="between" gap={2}>
            <TmnFlex direction="row" align="center" gap={2} className="min-w-0">
              <TicketLink
                href={ticket.jiraUrl}
                jiraKey={ticket.jiraKey}
                size={'1'}
                iconSize={12}
                className="font-bold"
              />
              {ticket.specVersion !== null && (
                <TmnText className="shrink-0 text-xs text-muted-foreground">
                  v{ticket.specVersion}
                </TmnText>
              )}
            </TmnFlex>
            <AgentAvatar agent={ticket.agent} size="sm" />
          </TmnFlex>
        </TmnFlex>
      )}
    </TmnDnD.Draggable>
  );
};
export default memo(BoardCard);
