import { type ReactNode, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  GripVertical,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import { RequestMethods, useQueryEnhancer } from '@truyenmoinhu/query';
import {
  TmnBox,
  TmnButton,
  TmnCallout,
  TmnCard,
  TmnDnD,
  type TmnDnDRootProps,
  TmnFlex,
  TmnInput,
  TmnLink,
  TmnLoading,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { apiManagerInstance, queryClient } from '#constants/query';
import { useSidebar } from '#hooks/sidebar';

interface Project {
  id: number;
  name: string;
  code: string;
  workspaceId: number;
}
interface Workspace {
  id: number;
  name: string;
  code: string;
  projects: Project[];
}
class WorkspaceError extends Error {
  constructor(readonly status?: number) {
    super('Workspace request failed');
  }
}
async function write<T>(url: string, method: RequestMethods, data?: unknown) {
  const result = await apiManagerInstance.sendRequest<T>({
    url,
    method,
    data,
    suppressNotifyOnError: true
  });
  if (!result?.success) throw new WorkspaceError(result?.code);
  await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  return result.payload;
}
export const useWorkspaces = () =>
  useQueryEnhancer<Workspace[]>({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const result = await apiManagerInstance.sendRequest<Workspace[]>({
        url: 'workspaces',
        suppressNotifyOnError: true
      });
      if (!result?.success || !result.payload)
        throw new Error('workspace_load_failed');
      return result.payload;
    }
  });
function WorkspaceLink({
  path,
  children,
  className,
  label,
  button = false,
  icon = false
}: {
  path: string;
  children: ReactNode;
  className?: string;
  label?: string;
  button?: boolean;
  icon?: boolean;
}) {
  const { close } = useSidebar();
  const link = (
    <Link
      to="/workspaces/$"
      params={{ _splat: path }}
      aria-label={label}
      onClick={() => {
        if (window.matchMedia('(max-width: 767px)').matches) close();
      }}
    >
      {children}
    </Link>
  );
  return button || icon ? (
    <TmnButton
      asChild
      kind={icon ? 'default' : 'primary'}
      variant={icon ? 'transparent' : 'solid'}
      className={icon ? `size-7! shrink-0 p-1! ${className ?? ''}` : className}
    >
      {link}
    </TmnButton>
  ) : (
    <TmnLink asChild className={className}>
      {link}
    </TmnLink>
  );
}
function ProjectRow({
  project,
  disabled
}: {
  project: Project;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const pathname = useLocation({ select: l => l.pathname });
  const [handle, setHandle] = useState<HTMLButtonElement | null>(null);
  const path = `${project.workspaceId}/projects/${project.id}`;
  return (
    <TmnDnD.Draggable
      id={`project-${project.id}`}
      type="project"
      handle={handle}
      data={{ project }}
      disabled={disabled}
      className="my-1"
    >
      {({ isDragging }) => (
        <TmnFlex
          direction="row"
          align="center"
          gap={1}
          className={`rounded p-1 ${isDragging ? 'opacity-40' : ''} ${pathname === `/workspaces/${path}` ? 'bg-muted' : 'hover:bg-muted'}`}
        >
          <TmnButton
            ref={setHandle}
            variant="transparent"
            kind="default"
            startIcon={GripVertical}
            className="touch-none cursor-grab"
            aria-label={t('workspace.drag', { name: project.name })}
            disabled={disabled}
          />
          <WorkspaceLink
            path={path}
            className="flex min-w-0 flex-1 items-center gap-2 text-sm"
          >
            <Folder size={14} />
            <TmnText truncate>{project.name}</TmnText>
          </WorkspaceLink>
        </TmnFlex>
      )}
    </TmnDnD.Draggable>
  );
}
function TreeItem({
  workspace: w,
  pending
}: {
  workspace: Workspace;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <TmnDnD.Droppable
      id={`workspace-${w.id}`}
      accept="project"
      data={{ workspaceId: w.id }}
      disabled={pending}
    >
      {({ isDropTarget }) => (
        <TmnBox
          className={`rounded transition-colors ${isDropTarget ? 'bg-primary/10 ring-2 ring-primary' : ''}`}
        >
          <TmnFlex
            direction="row"
            align="center"
            gap={1}
            className="rounded px-1 py-1 hover:bg-muted"
          >
            <TmnButton
              variant="transparent"
              kind="default"
              startIcon={collapsed ? ChevronRight : ChevronDown}
              aria-label={t('workspace.toggle', { name: w.name })}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed(!collapsed)}
            />
            <WorkspaceLink
              path={String(w.id)}
              className="min-w-0 flex-1 truncate text-sm"
            >
              {w.name}
            </WorkspaceLink>
            <WorkspaceLink
              path={`${w.id}/projects/new`}
              label={t('workspace.create_project_in', { name: w.name })}
              icon
            >
              <Plus size={16} />
            </WorkspaceLink>
          </TmnFlex>
          {!collapsed && (
            <TmnBox className="ml-5 min-h-8 border-l border-border pl-2">
              {w.projects.length ? (
                w.projects.map(p => (
                  <ProjectRow key={p.id} project={p} disabled={pending} />
                ))
              ) : (
                <TmnText as="p" className="py-2 text-xs text-muted-foreground">
                  {t('workspace.no_projects')}
                </TmnText>
              )}
            </TmnBox>
          )}
        </TmnBox>
      )}
    </TmnDnD.Droppable>
  );
}
export function WorkspaceTree() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useLocation({ select: l => l.pathname });
  const { data, isLoading, error, refetch } = useWorkspaces();
  const [pending, setPending] = useState(false);
  const moving = useRef(false);
  const onDragEnd: TmnDnDRootProps['onDragEnd'] = async event => {
    if (event.canceled || moving.current) return;
    const sourceId = String(event.operation.source?.id ?? '');
    const targetId = String(event.operation.target?.id ?? '');
    if (!sourceId.startsWith('project-') || !targetId.startsWith('workspace-'))
      return;
    const project = data
      ?.flatMap(w => w.projects)
      .find(p => p.id === Number(sourceId.slice(8)));
    const destination = data?.find(w => w.id === Number(targetId.slice(10)));
    if (!project || !destination || project.workspaceId === destination.id)
      return;
    moving.current = true;
    setPending(true);
    try {
      await write(
        `workspaces/${project.workspaceId}/projects/${project.id}`,
        RequestMethods.PATCH,
        { workspaceId: destination.id }
      );
      UIUtils.notify.success(t('workspace.moved'));
      if (
        pathname.startsWith(
          `/workspaces/${project.workspaceId}/projects/${project.id}`
        )
      )
        await navigate({
          to: '/workspaces/$',
          params: { _splat: `${destination.id}/projects/${project.id}` }
        });
    } catch {
      UIUtils.notify.error(t('workspace.move_failed'));
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
          {t('workspace.title')}
        </TmnText>
        <WorkspaceLink path="new" label={t('workspace.create')} icon>
          <Plus size={16} />
        </WorkspaceLink>
      </TmnFlex>
      {isLoading && <TmnLoading />}
      {error && (
        <TmnButton onClick={() => refetch()}>{t('workspace.retry')}</TmnButton>
      )}
      {data?.length === 0 && (
        <TmnText as="p" className="p-2 text-sm text-muted-foreground">
          {t('workspace.empty')}
        </TmnText>
      )}
      <TmnDnD.Root onDragEnd={onDragEnd}>
        {data?.map(w => (
          <TreeItem key={w.id} workspace={w} pending={pending} />
        ))}
      </TmnDnD.Root>
      {pending && (
        <TmnText as="p" aria-live="polite" className="p-2 text-xs">
          {t('workspace.moving')}
        </TmnText>
      )}
    </TmnBox>
  );
}
function EntityForm({
  workspace,
  entity,
  projectMode = false,
  workspaces = []
}: {
  workspace?: Workspace;
  entity?: Workspace | Project;
  projectMode?: boolean;
  workspaces?: Workspace[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const form = useFormResolver<{
    name: string;
    code: string;
    workspaceId: string;
  }>({
    schema: validation.object({
      name: validation
        .string()
        .trim()
        .required(t('workspace.required'))
        .max(255, t('workspace.name_limit')),
      code: validation
        .string()
        .trim()
        .required(t('workspace.required'))
        .max(32, t('workspace.code_limit'))
        .matches(/^[A-Za-z0-9_-]+$/, t('workspace.code_format')),
      workspaceId: validation.string().defined()
    }),
    configs: {
      defaultValues: {
        name: entity?.name ?? '',
        code: entity?.code ?? '',
        workspaceId: String(workspace?.id ?? '')
      }
    }
  });
  const title = t(
    entity
      ? projectMode
        ? 'workspace.edit_project'
        : 'workspace.edit'
      : projectMode
        ? 'workspace.create_project'
        : 'workspace.create'
  );
  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      const url = projectMode
        ? `workspaces/${workspace?.id}/projects${entity ? `/${entity.id}` : ''}`
        : `workspaces${entity ? `/${entity.id}` : ''}`;
      const saved = await write<Project>(
        url,
        entity ? RequestMethods.PATCH : RequestMethods.POST,
        {
          name: values.name,
          code: values.code,
          ...(projectMode && entity
            ? { workspaceId: Number(values.workspaceId) }
            : {})
        }
      );
      if (!saved) throw new Error('Missing response');
      UIUtils.notify.success(t('workspace.saved'));
      await navigate({
        to: '/workspaces/$',
        params: {
          _splat: projectMode
            ? `${values.workspaceId}/projects/${saved.id}`
            : String(saved.id)
        }
      });
    } catch (error) {
      const text =
        error instanceof WorkspaceError && error.status === 409
          ? t('workspace.duplicate')
          : t('workspace.save_failed');
      setMessage(text);
    }
  });
  return (
    <TmnCard header={{ title }} className="w-full max-w-xl">
      <TmnForm onSubmit={submit} className="flex flex-col gap-5">
        <TmnInput.TextField
          label={t('workspace.name')}
          required
          maxLength={255}
          {...form.register('name')}
          message={form.formState.errors.name?.message}
        />
        <TmnInput.TextField
          label={t('workspace.code')}
          required
          maxLength={32}
          {...form.register('code')}
          message={form.formState.errors.code?.message}
          helperText={t('workspace.code_hint')}
        />
        {projectMode && entity && (
          <TmnController
            control={form.control}
            name="workspaceId"
            render={({ field }) => (
              <TmnInput.Select
                label={t('workspace.parent')}
                value={field.value}
                onChange={field.onChange}
                options={workspaces.map(w => ({
                  value: String(w.id),
                  label: w.name
                }))}
              />
            )}
          />
        )}
        {message && (
          <TmnCallout role="alert" color="red">
            {message}
          </TmnCallout>
        )}
        <TmnFlex direction="row" gap={3} align="center">
          <TmnButton
            kind="primary"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {t(
              form.formState.isSubmitting
                ? 'workspace.saving'
                : entity
                  ? 'workspace.save'
                  : 'workspace.submit'
            )}
          </TmnButton>
          <WorkspaceLink
            path={
              entity
                ? projectMode
                  ? `${workspace?.id}/projects/${entity.id}`
                  : String(entity.id)
                : projectMode
                  ? String(workspace?.id)
                  : ''
            }
          >
            {t('workspace.cancel')}
          </WorkspaceLink>
        </TmnFlex>
      </TmnForm>
    </TmnCard>
  );
}
function EntityActions({
  workspace,
  project
}: {
  workspace: Workspace;
  project?: Project;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const busy = useRef(false);
  const path = project
    ? `${workspace.id}/projects/${project.id}`
    : String(workspace.id);
  const remove = () => {
    const modal = `delete-${path}`;
    UIUtils.alert.open(modal, {
      title: t('workspace.delete_title'),
      message: t(
        project
          ? 'workspace.delete_project_message'
          : 'workspace.delete_workspace_message',
        { name: project?.name ?? workspace.name }
      ),
      cancelTitle: t('workspace.cancel'),
      actions: () => [
        {
          kind: 'error',
          children: t('workspace.delete'),
          onClick: async event => {
            event.preventDefault();
            if (busy.current) return;
            busy.current = true;
            try {
              await write(`workspaces/${path}`, RequestMethods.DELETE);
              UIUtils.alert.dismissByName(modal);
              UIUtils.notify.success(t('workspace.deleted'));
              await navigate({
                to: '/workspaces/$',
                params: { _splat: project ? String(workspace.id) : '' }
              });
            } catch (error) {
              UIUtils.notify.error(
                t(
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
        {t('workspace.edit_action')}
      </WorkspaceLink>
      <TmnButton
        kind="error"
        variant="outline"
        startIcon={Trash2}
        onClick={remove}
      >
        {t('workspace.delete')}
      </TmnButton>
    </TmnFlex>
  );
}
export function WorkspacePage() {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } = useWorkspaces();
  const pathname = useLocation({ select: l => l.pathname });
  const parts = pathname.split('/').filter(Boolean);
  const overview =
    pathname === '/' ||
    pathname === '/workspaces' ||
    pathname === '/workspaces/';
  const workspace = data?.find(w => String(w.id) === parts[1]);
  const project = workspace?.projects.find(p => String(p.id) === parts[3]);
  if (isLoading) return <TmnLoading />;
  if (error)
    return (
      <TmnCard header={{ title: t('workspace.load_failed') }}>
        <TmnButton onClick={() => refetch()}>{t('workspace.retry')}</TmnButton>
      </TmnCard>
    );
  if (pathname === '/workspaces/new') return <EntityForm key={pathname} />;
  if (
    workspace &&
    parts.length === 4 &&
    parts[2] === 'projects' &&
    parts[3] === 'new'
  )
    return <EntityForm key={pathname} workspace={workspace} projectMode />;
  if (workspace && parts.length === 3 && parts[2] === 'edit')
    return <EntityForm key={pathname} entity={workspace} />;
  if (workspace && project && parts.length === 5 && parts[4] === 'edit')
    return (
      <EntityForm
        key={pathname}
        workspace={workspace}
        entity={project}
        projectMode
        workspaces={data}
      />
    );
  if (
    !overview &&
    (!workspace ||
      (parts.length > 2 &&
        (!project || parts[2] !== 'projects' || parts.length !== 4)))
  )
    return (
      <TmnCard header={{ title: t('workspace.not_found') }}>
        <WorkspaceLink path="">{t('workspace.title')}</WorkspaceLink>
      </TmnCard>
    );
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
          <h1>
            <TmnText size="6" weight="bold">
              {project?.name ?? workspace?.name ?? t('workspace.title')}
            </TmnText>
          </h1>
          <TmnText as="p" className="mt-1 text-sm text-muted-foreground">
            {project?.code ??
              workspace?.code ??
              t('workspace.summary', {
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
              {t(workspace ? 'workspace.create_project' : 'workspace.create')}
            </WorkspaceLink>
          )}
          {workspace && (
            <EntityActions workspace={workspace} project={project} />
          )}
        </TmnFlex>
      </TmnFlex>
      {project && workspace ? (
        <TmnCard header={{ title: t('workspace.details') }}>
          <TmnFlex direction="column" gap={3}>
            <TmnText>
              {t('workspace.name')}: {project.name}
            </TmnText>
            <TmnText>
              {t('workspace.code')}: {project.code}
            </TmnText>
            <TmnText>
              {t('workspace.parent')}:{' '}
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
                    {t('workspace.open')}
                  </WorkspaceLink>
                </TmnCard>
              ))
            : data?.map(w => (
                <TmnCard key={w.id} header={{ title: w.name }}>
                  <TmnText as="p" className="text-sm text-muted-foreground">
                    {w.code} ·{' '}
                    {t('workspace.project_count', { count: w.projects.length })}
                  </TmnText>
                  <WorkspaceLink
                    path={String(w.id)}
                    className="mt-3 inline-block text-sm"
                  >
                    {t('workspace.open')}
                  </WorkspaceLink>
                </TmnCard>
              ))}
          {(workspace
            ? workspace.projects.length === 0
            : data?.length === 0) && (
            <TmnText as="p" className="text-sm text-muted-foreground">
              {t(workspace ? 'workspace.no_projects' : 'workspace.empty')}
            </TmnText>
          )}
        </TmnBox>
      )}
    </TmnFlex>
  );
}
