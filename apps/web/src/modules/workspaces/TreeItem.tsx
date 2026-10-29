import { memo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';

import {
  TmnBox,
  TmnButton,
  TmnDnD,
  TmnFlex,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import ProjectRow from './ProjectRow';
import WorkspaceLink from './WorkspaceLink';

import type { IWorkspace } from './types';
export interface ITreeItemProps {
  workspace: IWorkspace;
  pending: boolean;
}
const TreeItem = ({ workspace: w, pending }: ITreeItemProps) => {
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
              aria-label={trans('workspace.toggle', { name: w.name })}
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
              label={trans('workspace.create_project_in', { name: w.name })}
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
                  {trans('workspace.no_projects')}
                </TmnText>
              )}
            </TmnBox>
          )}
        </TmnBox>
      )}
    </TmnDnD.Droppable>
  );
};
export default memo(TreeItem);
