import { memo, useRef, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import { RequestMethods } from '@truyenmoinhu/query';
import {
  TmnBox,
  TmnButton,
  TmnDnD,
  type TmnDnDRootProps,
  TmnFlex,
  TmnLoading,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { WORKSPACE_ENDPOINTS } from './constants';
import { useWorkspaceMutation, useWorkspaces } from './hooks';
import TreeItem from './TreeItem';
import { getWorkspaceRoute } from './utils';
import WorkspaceLink from './WorkspaceLink';

const WorkspaceTree = () => {
  const navigate = useNavigate();
  const pathname = useLocation({ select: l => l.pathname });
  const { data, isLoading, error, refetch } = useWorkspaces();
  const [pending, setPending] = useState(false);
  const moving = useRef(false);
  const mutation = useWorkspaceMutation();
  const onDragEnd: TmnDnDRootProps['onDragEnd'] = async event => {
    if (event.canceled || moving.current) {
      return;
    }
    const sourceId = String(event.operation.source?.id ?? '');
    const targetId = String(event.operation.target?.id ?? '');
    if (
      !sourceId.startsWith('project-') ||
      !targetId.startsWith('workspace-')
    ) {
      return;
    }
    const project = data
      ?.flatMap(w => w.projects)
      .find(p => p.id === Number(sourceId.slice(8)));
    const destination = data?.find(w => w.id === Number(targetId.slice(10)));
    if (!project || !destination || project.workspaceId === destination.id) {
      return;
    }
    moving.current = true;
    setPending(true);
    try {
      await mutation.mutateAsync({
        url: WORKSPACE_ENDPOINTS.base(
          `${project.workspaceId}/projects/${project.id}`
        ),
        method: RequestMethods.PATCH,
        data: { workspaceId: destination.id }
      });
      UIUtils.notify.success(trans('workspace.moved'));
      if (
        pathname.startsWith(
          `/workspaces/${project.workspaceId}/projects/${project.id}`
        )
      ) {
        await navigate(
          getWorkspaceRoute(`${destination.id}/projects/${project.id}`)
        );
      }
    } catch {
      UIUtils.notify.error(trans('workspace.move_failed'));
    } finally {
      moving.current = false;
      setPending(false);
    }
  };
  return (
    <TmnBox className="mt-4 border-t border-border pt-3">
      <TmnFlex
        direction="row"
        align="center"
        justify="between"
        className="mb-2 px-2"
      >
        <TmnText className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {trans('workspace.title')}
        </TmnText>
        <WorkspaceLink path="new" label={trans('workspace.create')} icon>
          <Plus size={16} />
        </WorkspaceLink>
      </TmnFlex>
      {isLoading && <TmnLoading />}
      {error && (
        <TmnButton onClick={() => refetch()}>
          {trans('workspace.retry')}
        </TmnButton>
      )}
      {data?.length === 0 && (
        <TmnText as="p" className="p-2 text-sm text-muted-foreground">
          {trans('workspace.empty')}
        </TmnText>
      )}
      <TmnDnD.Root onDragEnd={onDragEnd}>
        {data?.map(w => (
          <TreeItem key={w.id} workspace={w} pending={pending} />
        ))}
      </TmnDnD.Root>
      {pending && (
        <TmnText as="p" aria-live="polite" className="p-2 text-xs">
          {trans('workspace.moving')}
        </TmnText>
      )}
    </TmnBox>
  );
};
export default memo(WorkspaceTree);
