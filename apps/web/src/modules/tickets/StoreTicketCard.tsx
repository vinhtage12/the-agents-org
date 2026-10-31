import { memo } from 'react';

import { TmnBadge, TmnDnD, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import type { IStoreTicket } from './types';
export interface IStoreTicketCardProps {
  ticket: IStoreTicket;
  suggested: boolean;
  disabled: boolean;
}
const StoreTicketCard = ({
  ticket,
  suggested,
  disabled
}: IStoreTicketCardProps) => (
  <TmnDnD.Draggable
    id={`ticket-${ticket.id}`}
    type="ticket"
    data={{ ticketId: ticket.id }}
    disabled={disabled}
    className="mb-2"
  >
    {({ isDragging }) => (
      <TmnFlex
        direction="column"
        gap={1}
        className={`cursor-grab rounded border border-border bg-card p-2 ${isDragging ? 'opacity-40' : ''}`}
      >
        <TmnFlex direction="row" align="center" gap={2}>
          <TmnText weight="bold" className="text-sm">
            {ticket.jiraKey}
          </TmnText>
          {suggested && <TmnBadge>{trans('ticket.suggested')}</TmnBadge>}
        </TmnFlex>
        <TmnText className="line-clamp-2 text-sm">{ticket.summary}</TmnText>
        <TmnText className="text-xs text-muted-foreground">
          {ticket.issueType}
        </TmnText>
      </TmnFlex>
    )}
  </TmnDnD.Draggable>
);
export default memo(StoreTicketCard);
