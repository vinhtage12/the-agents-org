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

import {
  AGENT_START_STATUSES,
  BRANCH_DIALOG,
  MOVABLE,
  TICKET_STATUSES
} from '../constants';
import { TicketError } from '../error';
import {
  useBoardEvents,
  useMoveTicket,
  useProjectSprints,
  useProjectTickets,
  useRepoConflicts
} from '../hooks';
import { filterBoard } from '../utils';
import BacklogSection from './BacklogSection';
import BoardColumn from './BoardColumn';
import BranchDialogRenderer from './BranchDialogRenderer';
import SprintBar from './SprintBar';
import { openTicketDialog } from './ticket/TicketDialogRenderer';

import type { TSpecSource } from '#modules/workspaces';
import type { IBoardTicket, IRepoConflict, TicketStatus } from '../types';

export interface IProjectBoardProps {
  workspaceId: number;
  projectId: number;
  specSource: TSpecSource;
  sprintFilter: string | undefined;
  onSprintFilterChange: (filter: string | undefined) => void;
}
const ProjectBoard = ({
  workspaceId,
  projectId,
  specSource,
  sprintFilter,
  onSprintFilterChange
}: IProjectBoardProps) => {
  const { data, isLoading, error, refetch } = useProjectTickets(projectId);
  const sprints = useProjectSprints(projectId);
  const move = useMoveTicket();
  const conflicts = useRepoConflicts();
  const [pendingId, setPendingId] = useState<number | null>(null);
  useBoardEvents(projectId);

  const openBranchDialog = (ticket: IBoardTicket) => {
    UIUtils.popup.open({
      name: BRANCH_DIALOG,
      size: 'md',
      renderer: BranchDialogRenderer,
      params: {
        ticketId: ticket.id,
        jiraKey: ticket.jiraKey,
        repoId: ticket.repoId
      }
    });
  };

  const doMove = async (ticketId: number, to: TicketStatus) => {
    setPendingId(ticketId);
    try {
      await move.mutateAsync({ ticketId, to });
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
    const ticketId: number = source.ticketId;
    const ticket = data?.find(t => t.id === ticketId);
    // First move to In Progress: pick the branch before anything runs.
    if (to === 'IN_PROGRESS' && ticket && ticket.branch === null) {
      openBranchDialog(ticket);
      return;
    }
    if (AGENT_START_STATUSES.includes(to)) {
      let overlapping: IRepoConflict[] = [];
      try {
        overlapping = (await conflicts.mutateAsync(ticketId)) ?? [];
      } catch {
        // Warning only: a failed lookup must not block the move.
      }
      if (overlapping.length) {
        const modal = `repo-conflict-${ticketId}`;
        UIUtils.alert.open({
          name: modal,
          title: trans('ticket.repo_conflict_title'),
          message: trans('ticket.repo_conflict_body', {
            keys: overlapping.map(t => t.jiraKey).join(', ')
          }),
          cancelTitle: trans('ticket.cancel'),
          actions: () => [
            {
              kind: 'primary',
              children: trans('ticket.continue'),
              onClick: () => {
                UIUtils.alert.dismissByName(modal);
                void doMove(ticketId, to);
              }
            }
          ]
        });
        return;
      }
    }
    await doMove(ticketId, to);
  };

  if (isLoading || sprints.isLoading) {
    return <TmnLoading />;
  }
  if (error || !data || sprints.error || !sprints.data) {
    return (
      <TmnCallout color="red">
        <TmnText>{trans('ticket.load_failed')}</TmnText>
        <TmnButton onClick={() => refetch()}>{trans('ticket.retry')}</TmnButton>
      </TmnCallout>
    );
  }

  const { columns, backlog } = filterBoard(data, sprints.data, sprintFilter);

  return (
    <TmnFlex direction="column" gap={3}>
      <SprintBar
        workspaceId={workspaceId}
        projectId={projectId}
        specSource={specSource}
        sprints={sprints.data}
        filter={sprintFilter}
        onFilterChange={onSprintFilterChange}
      />
      <TmnDnD.Root onDragEnd={onDragEnd}>
        <TmnScrollArea scrollbars="both">
          <TmnFlex direction="row" gap={3} className="min-w-0 pb-2">
            {TICKET_STATUSES.map(status => (
              <BoardColumn
                key={status}
                status={status}
                tickets={columns.filter(t => t.status === status)}
                pendingId={pendingId}
                onOpen={openTicketDialog}
              />
            ))}
          </TmnFlex>
        </TmnScrollArea>
      </TmnDnD.Root>
      <BacklogSection tickets={backlog} onOpen={openTicketDialog} />
    </TmnFlex>
  );
};
export default memo(ProjectBoard);
