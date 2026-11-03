import { memo } from 'react';
import { Link } from '@tanstack/react-router';

import { TmnButton, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import type { IUsage } from '../types';

export interface IUsagePanelProps {
  usage: IUsage;
  onOpenAgent?: (agentId: number) => void;
}
const UsagePanel = ({ usage, onOpenAgent }: IUsagePanelProps) => {
  const empty =
    !usage.projects.length && !usage.tickets.length && !usage.agents.length;

  return (
    <TmnFlex direction="column" gap={2} className="min-w-0">
      <TmnText weight="bold">{trans('warehouse.usage')}</TmnText>
      {empty && (
        <TmnText className="text-sm text-muted-foreground">
          {trans('warehouse.usage_none')}
        </TmnText>
      )}
      {usage.projects.length > 0 && (
        <TmnFlex direction="column" gap={1}>
          <TmnText className="text-xs text-muted-foreground">
            {trans('warehouse.usage_projects')}
          </TmnText>
          {usage.projects.map(project => (
            <Link
              key={project.id}
              to="/workspaces/$workspaceId/projects/$"
              params={{
                workspaceId: String(project.workspaceId),
                _splat: String(project.id)
              }}
              className="truncate text-sm text-primary underline"
            >
              {project.code} - {project.name}
            </Link>
          ))}
        </TmnFlex>
      )}
      {usage.tickets.length > 0 && (
        <TmnFlex direction="column" gap={1}>
          <TmnText className="text-xs text-muted-foreground">
            {trans('warehouse.usage_tickets')}
          </TmnText>
          {usage.tickets.map(ticket =>
            ticket.projectId === null || ticket.workspaceId === null ? (
              <Link
                key={ticket.id}
                to="/warehouse/tickets"
                className="truncate text-sm text-primary underline"
              >
                {ticket.jiraKey}
              </Link>
            ) : (
              <Link
                key={ticket.id}
                to="/workspaces/$workspaceId/projects/$"
                params={{
                  workspaceId: String(ticket.workspaceId),
                  _splat: String(ticket.projectId)
                }}
                search={{ ticket: ticket.id }}
                className="truncate text-sm text-primary underline"
              >
                {ticket.jiraKey}
              </Link>
            )
          )}
        </TmnFlex>
      )}
      {usage.agents.length > 0 && (
        <TmnFlex direction="column" gap={1}>
          <TmnText className="text-xs text-muted-foreground">
            {trans('warehouse.usage_agents')}
          </TmnText>
          {usage.agents.map(agent => (
            <TmnButton
              key={agent.id}
              variant="transparent"
              kind="default"
              className="justify-start"
              onClick={() => onOpenAgent?.(agent.id)}
            >
              {agent.name}
            </TmnButton>
          ))}
        </TmnFlex>
      )}
    </TmnFlex>
  );
};
export default memo(UsagePanel);
