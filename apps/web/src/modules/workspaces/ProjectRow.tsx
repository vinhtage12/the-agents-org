import { memo, useState } from 'react';
import { useLocation } from '@tanstack/react-router';
import { Folder, GripVertical } from 'lucide-react';

import { TmnButton, TmnDnD, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import WorkspaceLink from './WorkspaceLink';

import type { IProject } from './types';
export interface IProjectRowProps {
  project: IProject;
  disabled: boolean;
}
const ProjectRow = ({ project, disabled }: IProjectRowProps) => {
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
            aria-label={trans('workspace.drag', { name: project.name })}
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
};
export default memo(ProjectRow);
