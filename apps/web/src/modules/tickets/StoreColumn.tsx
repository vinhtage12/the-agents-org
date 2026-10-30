import { memo } from 'react';

import { TmnBox, TmnDnD, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import StoreTicketCard from './StoreTicketCard';
import { columnId } from './utils';

import type { IStoreTicket } from './types';
export interface IStoreColumnProps {
  projectId: number | null;
  title: string;
  hint: string;
  tickets: IStoreTicket[];
  moved: Set<number>;
  disabled: boolean;
}
const StoreColumn = ({
  projectId,
  title,
  hint,
  tickets,
  moved,
  disabled
}: IStoreColumnProps) => (
  <TmnDnD.Droppable
    id={columnId(projectId)}
    accept="ticket"
    data={{ projectId }}
    disabled={disabled}
    className="w-64 shrink-0"
  >
    {({ isDropTarget }) => (
      <TmnBox
        className={`flex h-full min-h-60 flex-col rounded-lg border border-dashed border-border p-2 transition-colors ${isDropTarget ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/40'}`}
      >
        <TmnFlex direction="row" justify="between" className="mb-1">
          <TmnText weight="bold" className="truncate text-sm">
            {title}
          </TmnText>
          <TmnText className="text-xs text-muted-foreground">
            {tickets.length}
          </TmnText>
        </TmnFlex>
        <TmnText className="mb-2 truncate text-xs text-muted-foreground">
          {hint}
        </TmnText>
        {tickets.map(t => (
          <StoreTicketCard
            key={t.id}
            ticket={t}
            suggested={!moved.has(t.id) && t.suggestedProjectId !== null}
            disabled={disabled}
          />
        ))}
      </TmnBox>
    )}
  </TmnDnD.Droppable>
);
export default memo(StoreColumn);
