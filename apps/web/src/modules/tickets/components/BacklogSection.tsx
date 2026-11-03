import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { TmnButton, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import type { IBoardTicket } from '../types';

export interface IBacklogSectionProps {
  tickets: IBoardTicket[];
  onOpen: (ticketId: number) => void;
}
const BacklogSection = ({ tickets, onOpen }: IBacklogSectionProps) => {
  const [open, setOpen] = useState(true);

  if (!tickets.length) {
    return null;
  }

  return (
    <TmnFlex direction="column" gap={1} className="min-w-0">
      <TmnButton
        variant="text"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="self-start"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {trans('sprint.backlog')} ({tickets.length})
      </TmnButton>
      {open &&
        tickets.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpen(t.id)}
            className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-left text-sm hover:bg-muted/60"
          >
            <TmnText weight="bold" className="shrink-0">
              {t.jiraKey}
            </TmnText>
            <TmnText className="truncate">{t.summary}</TmnText>
          </button>
        ))}
    </TmnFlex>
  );
};
export default memo(BacklogSection);
