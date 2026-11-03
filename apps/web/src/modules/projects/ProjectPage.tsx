import { memo, useEffect } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearch
} from '@tanstack/react-router';
import { Settings } from 'lucide-react';

import {
  TmnBox,
  TmnButton,
  TmnCard,
  TmnFlex,
  TmnHeading,
  TmnLoading,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { ProjectBoard, openTicketDialog } from '#modules/tickets';
import {
  EntityActions,
  EntityForm,
  WorkspaceLink,
  useWorkspaces
} from '#modules/workspaces';

import ProjectSettings from './ProjectSettings';

const ProjectPage = () => {
  const { data, isLoading, error, refetch } = useWorkspaces();
  const navigate = useNavigate();
  const { ticket, sprint } = useSearch({ strict: false }) as {
    ticket?: number;
    sprint?: string;
  };
  const pathname = useLocation({ select: l => l.pathname });
  const { workspaceId, _splat = '' } = useParams({ strict: false });
  const parts = _splat.split('/').filter(Boolean);
  const workspace = data?.find(w => String(w.id) === workspaceId);
  const project = workspace?.projects.find(p => String(p.id) === parts[0]);
  // ?ticket=<id> (links from the warehouse) opens that ticket, then drops the param.
  useEffect(() => {
    if (!ticket) {
      return;
    }
    openTicketDialog(ticket);
    void navigate({ to: '.', search: {}, replace: true });
  }, [ticket, navigate]);

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
  if (workspace && parts.length === 1 && parts[0] === 'new') {
    return <EntityForm key={pathname} workspace={workspace} projectMode />;
  }
  if (
    !workspace ||
    !project ||
    parts.length > 2 ||
    (parts.length === 2 && parts[1] !== 'edit' && parts[1] !== 'settings')
  ) {
    return (
      <TmnCard header={{ title: trans('workspace.not_found') }}>
        <WorkspaceLink path="">{trans('workspace.title')}</WorkspaceLink>
      </TmnCard>
    );
  }
  if (parts[1] === 'edit') {
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
  if (parts[1] === 'settings') {
    return (
      <TmnFlex direction="column" gap={4}>
        <TmnHeading as="h1" size="6" weight="bold">
          {project.name} - {trans('project.settings')}
        </TmnHeading>
        <ProjectSettings workspaceId={workspace.id} projectId={project.id} />
      </TmnFlex>
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
          <TmnHeading as="h1" size="6" weight="bold">
            {project.name}
          </TmnHeading>
          <TmnText as="p" className="mt-1 text-sm text-muted-foreground">
            {project.code}
          </TmnText>
        </TmnBox>
        <TmnFlex direction="row" gap={2} wrap="wrap">
          <WorkspaceLink
            path={`${workspace.id}/projects/${project.id}/settings`}
            button
          >
            <Settings size={14} />
            {trans('project.settings')}
          </WorkspaceLink>
          <EntityActions workspace={workspace} project={project} />
        </TmnFlex>
      </TmnFlex>
      <ProjectBoard
        workspaceId={workspace.id}
        projectId={project.id}
        specSource={project.specSource}
        sprintFilter={sprint}
        onSprintFilterChange={value =>
          void navigate({
            to: '.',
            search: prev => ({ ...prev, sprint: value }),
            replace: true
          })
        }
      />
    </TmnFlex>
  );
};
export default memo(ProjectPage);
