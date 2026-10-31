import { memo, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';

import {
  TmnButton,
  TmnCard,
  TmnDnD,
  type TmnDnDRootProps,
  TmnFlex,
  TmnLoading,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { TicketError } from './error';
import { useLinkTickets, useSyncTickets, useTicketStore } from './hooks';
import StoreColumn from './StoreColumn';
import { applyMoves, buildInitialPlacement, toLinks } from './utils';

import type { TicketPlacement } from './types';

const TicketStorePage = () => {
  const { data, isLoading, error, refetch } = useTicketStore();
  const sync = useSyncTickets();
  const link = useLinkTickets();
  const [moved, setMoved] = useState<TicketPlacement>({});

  const busy = sync.isPending || link.isPending;
  const placement = applyMoves(
    buildInitialPlacement(data?.tickets ?? []),
    moved
  );
  const links = toLinks(placement);
  const movedIds = new Set(Object.keys(moved).map(Number));

  const onDragEnd: TmnDnDRootProps['onDragEnd'] = event => {
    if (event.canceled) {
      return;
    }
    const ticketId = event.operation.source?.data?.ticketId;
    const target = event.operation.target?.data;
    if (typeof ticketId !== 'number' || !target || !('projectId' in target)) {
      return;
    }
    const projectId = target.projectId;
    if (projectId !== null && typeof projectId !== 'number') {
      return;
    }
    setMoved(current => ({ ...current, [ticketId]: projectId }));
  };

  const runSync = async () => {
    try {
      const result = await sync.mutateAsync(undefined);
      UIUtils.notify.success(trans('ticket.synced', { ...result }));
    } catch (e) {
      UIUtils.notify.error(
        trans(
          e instanceof TicketError && e.status === 503
            ? 'ticket.jira_not_configured'
            : 'ticket.sync_failed'
        )
      );
    }
  };

  const save = async () => {
    try {
      const result = await link.mutateAsync(links);
      setMoved({});
      UIUtils.notify.success(trans('ticket.linked', { ...result }));
    } catch (e) {
      UIUtils.notify.error(
        trans(
          e instanceof TicketError && e.status === 409
            ? 'ticket.already_linked'
            : 'ticket.save_failed'
        )
      );
      await refetch();
    }
  };

  if (isLoading) {
    return <TmnLoading />;
  }
  if (error || !data) {
    return (
      <TmnCard header={{ title: trans('ticket.load_failed') }}>
        <TmnButton onClick={() => refetch()}>{trans('ticket.retry')}</TmnButton>
      </TmnCard>
    );
  }

  const columnTickets = (projectId: number | null) =>
    data.tickets.filter(t => placement[t.id] === projectId);

  return (
    <TmnFlex direction="column" gap={4} className="min-w-0">
      <TmnFlex
        direction="row"
        align="center"
        justify="between"
        wrap="wrap"
        gap={3}
      >
        <TmnText size="6" weight="bold" asChild>
          <h1>{trans('ticket.store_title')}</h1>
        </TmnText>
        <TmnFlex direction="row" gap={2}>
          <TmnButton startIcon={RefreshCw} disabled={busy} onClick={runSync}>
            {trans(sync.isPending ? 'ticket.syncing' : 'ticket.sync')}
          </TmnButton>
          <TmnButton
            kind="primary"
            startIcon={Save}
            disabled={busy || links.length === 0}
            onClick={save}
          >
            {trans('ticket.save', { count: links.length })}
          </TmnButton>
        </TmnFlex>
      </TmnFlex>
      {data.tickets.length === 0 ? (
        <TmnText as="p" className="text-sm text-muted-foreground">
          {trans('ticket.store_empty')}
        </TmnText>
      ) : (
        <TmnDnD.Root onDragEnd={onDragEnd}>
          <TmnFlex direction="row" gap={3} className="overflow-x-auto pb-2">
            <StoreColumn
              projectId={null}
              title={trans('ticket.unassigned')}
              hint={trans('ticket.unassigned_hint')}
              tickets={columnTickets(null)}
              moved={movedIds}
              disabled={busy}
            />
            {data.projects.map(p => (
              <StoreColumn
                key={p.id}
                projectId={p.id}
                title={`${p.code} - ${p.name}`}
                hint={trans('ticket.project_hint', { code: p.code })}
                tickets={columnTickets(p.id)}
                moved={movedIds}
                disabled={busy}
              />
            ))}
          </TmnFlex>
        </TmnDnD.Root>
      )}
    </TmnFlex>
  );
};
export default memo(TicketStorePage);
