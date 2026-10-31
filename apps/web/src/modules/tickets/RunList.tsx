import { memo } from 'react';

import { TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { formatDate } from '#utils/date';

import type { IAgentRun } from './types';
export interface IRunListProps {
  runs: IAgentRun[];
}
const RunList = ({ runs }: IRunListProps) => {
  if (!runs.length) {
    return (
      <TmnText className="text-sm text-muted-foreground">
        {trans('ticket.runs_empty')}
      </TmnText>
    );
  }

  return (
    <TmnFlex direction="column" gap={2}>
      {runs.map(run => (
        <TmnFlex
          key={run.id}
          direction="column"
          gap={1}
          className="rounded-md border border-border p-2"
        >
          <TmnFlex direction="row" gap={2} align="center" className="min-w-0">
            <TmnText weight="bold" className="text-sm">
              {trans(`ticket.step.${run.step}`)}
            </TmnText>
            <TmnText className="truncate text-sm">{run.agentSlug}</TmnText>
            <TmnText className="shrink-0 text-xs text-muted-foreground">
              {trans(`ticket.run_status.${run.status}`)}
            </TmnText>
          </TmnFlex>
          <TmnText className="text-xs text-muted-foreground">
            {formatDate(run.startedAt)}
            {run.finishedAt ? ` → ${formatDate(run.finishedAt)}` : ''}
            {run.paneId
              ? ` - ${trans('ticket.pane', { paneId: run.paneId })}`
              : ''}
          </TmnText>
          {run.error && (
            <TmnText className="text-xs text-red-600 dark:text-red-400">
              {run.error}
            </TmnText>
          )}
        </TmnFlex>
      ))}
    </TmnFlex>
  );
};
export default memo(RunList);
