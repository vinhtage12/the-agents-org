import { memo } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import {
  TmnBox,
  TmnButton,
  TmnCard,
  TmnFlex,
  TmnLoading,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import EntityActions from './EntityActions';
import EntityForm from './EntityForm';
import { useWorkspaces } from './hooks';
import WorkspaceLink from './WorkspaceLink';

const WorkspacePage = () => {
  const { data, isLoading, error, refetch } = useWorkspaces();
  const pathname = useLocation({ select: l => l.pathname });
  const parts = pathname.split('/').filter(Boolean);
  const overview =
    pathname === '/' ||
    pathname === '/workspaces' ||
    pathname === '/workspaces/';
  const workspace = data?.find(w => String(w.id) === parts[1]);
  if (isLoading) {
    return <TmnLoading />;
  }
  if (error) {
    return (
      <TmnCard header={{ title: trans('workspace.load_failed') }}>
        <TmnButton onClick={() => refetch()}>
          {trans('workspace.retry')}
        </TmnButton>
      </TmnCard>
    );
  }
  if (pathname === '/workspaces/new') {
    return <EntityForm key={pathname} />;
  }
  if (workspace && parts.length === 3 && parts[2] === 'edit') {
    return <EntityForm key={pathname} entity={workspace} />;
  }
  if (!overview && (!workspace || parts.length > 2)) {
    return (
      <TmnCard header={{ title: trans('workspace.not_found') }}>
        <WorkspaceLink path="">{trans('workspace.title')}</WorkspaceLink>
      </TmnCard>
    );
  }
  return (
    <TmnFlex direction="column" gap={5}>
      <TmnFlex
        direction="row"
        align="center"
        justify="between"
        wrap="wrap"
        gap={3}
      >
        <TmnBox>
          <TmnText size="6" weight="bold" asChild>
            <h1>{workspace?.name ?? trans('workspace.title')}</h1>
          </TmnText>
          <TmnText as="p" className="mt-1 text-sm text-muted-foreground">
            {workspace?.code ??
              trans('workspace.summary', {
                workspaces: data?.length ?? 0,
                projects: data?.reduce((n, w) => n + w.projects.length, 0) ?? 0
              })}
          </TmnText>
        </TmnBox>
        <TmnFlex direction="row" gap={2} wrap="wrap">
          <WorkspaceLink
            path={workspace ? `${workspace.id}/projects/new` : 'new'}
            button
          >
            <Plus size={16} />
            {trans(workspace ? 'workspace.create_project' : 'workspace.create')}
          </WorkspaceLink>
          {workspace && <EntityActions workspace={workspace} />}
        </TmnFlex>
      </TmnFlex>
      <TmnBox className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workspace
          ? workspace.projects.map(p => (
              <TmnCard key={p.id} header={{ title: p.name }}>
                <TmnText as="p" className="text-sm text-muted-foreground">
                  {p.code}
                </TmnText>
                <WorkspaceLink
                  path={`${workspace.id}/projects/${p.id}`}
                  className="mt-3 inline-block text-sm"
                >
                  {trans('workspace.open')}
                </WorkspaceLink>
              </TmnCard>
            ))
          : data?.map(w => (
              <TmnCard key={w.id} header={{ title: w.name }}>
                <TmnText as="p" className="text-sm text-muted-foreground">
                  {w.code} ·{' '}
                  {trans('workspace.project_count', {
                    count: w.projects.length
                  })}
                </TmnText>
                <WorkspaceLink
                  path={String(w.id)}
                  className="mt-3 inline-block text-sm"
                >
                  {trans('workspace.open')}
                </WorkspaceLink>
              </TmnCard>
            ))}
        {(workspace ? workspace.projects.length === 0 : data?.length === 0) && (
          <TmnText as="p" className="text-sm text-muted-foreground">
            {trans(workspace ? 'workspace.no_projects' : 'workspace.empty')}
          </TmnText>
        )}
      </TmnBox>
    </TmnFlex>
  );
};
export default memo(WorkspacePage);
