import { memo, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';

import { RequestMethods } from '@truyenmoinhu/query';
import { TmnButton, TmnFlex, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { WORKSPACE_ENDPOINTS } from './constants';
import { WorkspaceError } from './error';
import { useWorkspaceMutation } from './hooks';
import WorkspaceLink from './WorkspaceLink';

import type { IProject, IWorkspace } from './types';
export interface IEntityActionsProps {
  workspace: IWorkspace;
  project?: IProject;
}
const EntityActions = ({ workspace, project }: IEntityActionsProps) => {
  const navigate = useNavigate();
  const busy = useRef(false);
  const mutation = useWorkspaceMutation();
  const path = project
    ? `${workspace.id}/projects/${project.id}`
    : String(workspace.id);
  const remove = () => {
    const modal = `delete-${path}`;
    UIUtils.alert.open(modal, {
      title: trans('workspace.delete_title'),
      message: trans(
        project
          ? 'workspace.delete_project_message'
          : 'workspace.delete_workspace_message',
        { name: project?.name ?? workspace.name }
      ),
      cancelTitle: trans('workspace.cancel'),
      actions: () => [
        {
          kind: 'error',
          children: trans('workspace.delete'),
          onClick: async event => {
            event.preventDefault();
            if (busy.current) {
              return;
            }
            busy.current = true;
            try {
              await mutation.mutateAsync({
                url: WORKSPACE_ENDPOINTS.base(path),
                method: RequestMethods.DELETE
              });
              UIUtils.alert.dismissByName(modal);
              UIUtils.notify.success(trans('workspace.deleted'));
              await navigate({
                to: '/workspaces/$',
                params: { _splat: project ? String(workspace.id) : '' }
              });
            } catch (error) {
              UIUtils.notify.error(
                trans(
                  error instanceof WorkspaceError && error.status === 409
                    ? 'workspace.not_empty'
                    : 'workspace.save_failed'
                )
              );
            } finally {
              busy.current = false;
            }
          }
        }
      ]
    });
  };
  return (
    <TmnFlex direction="row" gap={2}>
      <WorkspaceLink path={`${path}/edit`} button>
        <Pencil size={14} />
        {trans('workspace.edit_action')}
      </WorkspaceLink>
      <TmnButton
        kind="error"
        variant="outline"
        startIcon={Trash2}
        onClick={remove}
      >
        {trans('workspace.delete')}
      </TmnButton>
    </TmnFlex>
  );
};
export default memo(EntityActions);
