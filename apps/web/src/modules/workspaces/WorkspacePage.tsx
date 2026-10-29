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
  const project = workspace?.projects.find(p => String(p.id) === parts[3]);
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
  if (
    workspace &&
    parts.length === 4 &&
    parts[2] === 'projects' &&
    parts[3] === 'new'
  ) {
    return <EntityForm key={pathname} workspace={workspace} projectMode />;
  }
  if (workspace && parts.length === 3 && parts[2] === 'edit') {
    return <EntityForm key={pathname} entity={workspace} />;
  }
  if (workspace && project && parts.length === 5 && parts[4] === 'edit') {
    return (
      <EntityForm
        key={pathname}
        workspace={workspace}
        entity={project}
        projectMode
        workspaces={data}
      />
    );
  }
  if (
    !overview &&
    (!workspace ||
      (parts.length > 2 &&
        (!project || parts[2] !== 'projects' || parts.length !== 4)))
  ) {
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
            <h1>
              {project?.name ?? workspace?.name ?? trans('workspace.title')}
            </h1>
          </TmnText>
          <TmnText as="p" className="mt-1 text-sm text-muted-foreground">
            {project?.code ??
              workspace?.code ??
              trans('workspace.summary', {
                workspaces: data?.length ?? 0,
                projects: data?.reduce((n, w) => n + w.projects.length, 0) ?? 0
              })}
          </TmnText>
        </TmnBox>
        <TmnFlex direction="row" gap={2} wrap="wrap">
          {!project && (
            <WorkspaceLink
              path={workspace ? `${workspace.id}/projects/new` : 'new'}
              button
            >
              <Plus size={16} />
              {trans(
                workspace ? 'workspace.create_project' : 'workspace.create'
              )}
            </WorkspaceLink>
          )}
          {workspace && (
            <EntityActions workspace={workspace} project={project} />
          )}
        </TmnFlex>
      </TmnFlex>
      {project && workspace ? (
        <TmnCard header={{ title: trans('workspace.details') }}>
          <TmnFlex direction="column" gap={3}>
            <TmnText>
              {trans('workspace.name')}: {project.name}
            </TmnText>
            <TmnText>
              {trans('workspace.code')}: {project.code}
            </TmnText>
            <TmnText>
              {trans('workspace.parent')}:{' '}
              <WorkspaceLink path={String(workspace.id)}>
                {workspace.name}
              </WorkspaceLink>
            </TmnText>
          </TmnFlex>
        </TmnCard>
      ) : (
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
          {(workspace
            ? workspace.projects.length === 0
            : data?.length === 0) && (
            <TmnText as="p" className="text-sm text-muted-foreground">
              {trans(workspace ? 'workspace.no_projects' : 'workspace.empty')}
            </TmnText>
          )}
        </TmnBox>
      )}
    </TmnFlex>
  );
};
export default memo(WorkspacePage);
