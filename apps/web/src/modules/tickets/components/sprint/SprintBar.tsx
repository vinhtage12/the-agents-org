import { memo } from 'react';

import { RequestMethods } from '@truyenmoinhu/query';
import { TmnButton, TmnFlex, TmnInput, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import {
  COMPLETE_SPRINT_DIALOG,
  LOCAL_TICKET_DIALOG,
  SPRINT_ALL,
  SPRINT_DIALOG,
  SPRINT_RUNNING,
  TICKET_ENDPOINTS
} from '../../constants';
import { useSprintMutation } from '../../hooks';
import CompleteSprintDialogRenderer from '../CompleteSprintDialogRenderer';
import LocalTicketDialogRenderer from '../LocalTicketDialogRenderer';
import SprintDialogRenderer from './SprintDialogRenderer';

import type { TSpecSource } from '#modules/workspaces';
import type { ISprint } from '../../types';

export interface ISprintBarProps {
  workspaceId: number;
  projectId: number;
  specSource: TSpecSource;
  sprints: ISprint[];
  filter: string | undefined;
  onFilterChange: (filter: string | undefined) => void;
}
const SprintBar = ({
  workspaceId,
  projectId,
  specSource,
  sprints,
  filter,
  onFilterChange
}: ISprintBarProps) => {
  const mutation = useSprintMutation();
  // Without an explicit filter the running LOCAL sprint is the one acted on.
  const selected =
    filter === undefined
      ? sprints.find(s => s.source === 'LOCAL' && s.state === 'ACTIVE')
      : sprints.find(s => String(s.id) === filter);
  const local = selected?.source === 'LOCAL' ? selected : undefined;

  const run = async (url: string, method: RequestMethods) => {
    try {
      await mutation.mutateAsync({ url, method });
    } catch (e) {
      UIUtils.notify.error(
        e instanceof Error && e.message ? e.message : trans('sprint.failed')
      );
    }
  };

  const openForm = (sprint?: ISprint) => {
    UIUtils.popup.open({
      name: SPRINT_DIALOG,
      size: 'md',
      title: trans(sprint ? 'sprint.edit_title' : 'sprint.create_title'),
      renderer: SprintDialogRenderer,
      params: { projectId, sprint }
    });
  };

  const openTicketForm = () => {
    UIUtils.popup.open({
      name: LOCAL_TICKET_DIALOG,
      size: 'lg',
      title: trans('ticket.local.create_title'),
      renderer: LocalTicketDialogRenderer,
      params: {
        workspaceId,
        projectId,
        hybrid: specSource === 'HYBRID',
        sprints
      }
    });
  };

  const openComplete = (sprint: ISprint) => {
    UIUtils.popup.open({
      name: COMPLETE_SPRINT_DIALOG,
      size: 'md',
      title: trans('sprint.complete_title', { name: sprint.name }),
      renderer: CompleteSprintDialogRenderer,
      params: {
        sprint,
        futures: sprints.filter(
          s => s.source === 'LOCAL' && s.state === 'FUTURE'
        )
      }
    });
  };

  const confirmDelete = (sprint: ISprint) => {
    const modal = `sprint-delete-${sprint.id}`;
    UIUtils.alert.open({
      name: modal,
      title: trans('sprint.delete_title'),
      message: trans('sprint.delete_body', { name: sprint.name }),
      cancelTitle: trans('ticket.cancel'),
      actions: () => [
        {
          kind: 'primary',
          children: trans('sprint.delete'),
          onClick: () => {
            UIUtils.alert.dismissByName(modal);
            void run(
              TICKET_ENDPOINTS.sprints(String(sprint.id)),
              RequestMethods.DELETE
            );
            if (filter === String(sprint.id)) {
              onFilterChange(undefined);
            }
          }
        }
      ]
    });
  };

  const open = sprints.filter(s => s.state !== 'CLOSED');
  const closed = sprints.filter(s => s.state === 'CLOSED');

  return (
    <TmnFlex direction="row" gap={2} align="end" wrap="wrap">
      <TmnInput.Select
        label={trans('sprint.filter')}
        value={filter ?? SPRINT_RUNNING}
        onChange={value =>
          onFilterChange(value === SPRINT_RUNNING ? undefined : String(value))
        }
        options={[
          { value: SPRINT_RUNNING, label: trans('sprint.running') },
          { value: SPRINT_ALL, label: trans('sprint.all') },
          ...open.map(s => ({ value: String(s.id), label: s.name })),
          ...closed.map(s => ({
            value: String(s.id),
            label: `${s.name} ${trans('sprint.closed_suffix')}`
          }))
        ]}
      />
      <TmnButton onClick={() => openForm()}>{trans('sprint.create')}</TmnButton>
      {specSource !== 'JIRA' && (
        <TmnButton kind="primary" onClick={openTicketForm}>
          {trans('ticket.local.create')}
        </TmnButton>
      )}
      {local && local.state !== 'CLOSED' && (
        <TmnButton onClick={() => openForm(local)}>
          {trans('sprint.edit')}
        </TmnButton>
      )}
      {local?.state === 'FUTURE' && (
        <>
          <TmnButton
            kind="primary"
            disabled={mutation.isPending}
            onClick={() =>
              run(
                TICKET_ENDPOINTS.sprints(`${local.id}/start`),
                RequestMethods.POST
              )
            }
          >
            {trans('sprint.start')}
          </TmnButton>
          <TmnButton
            disabled={mutation.isPending}
            onClick={() => confirmDelete(local)}
          >
            {trans('sprint.delete')}
          </TmnButton>
        </>
      )}
      {local?.state === 'ACTIVE' && (
        <TmnButton
          kind="primary"
          disabled={mutation.isPending}
          onClick={() => openComplete(local)}
        >
          {trans('sprint.complete')}
        </TmnButton>
      )}
    </TmnFlex>
  );
};
export default memo(SprintBar);
