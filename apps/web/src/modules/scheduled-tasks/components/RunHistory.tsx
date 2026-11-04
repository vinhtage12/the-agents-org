import { memo, useState } from 'react';

import {
  TmnButton,
  TmnCallout,
  TmnChip,
  TmnFlex,
  TmnLoading,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { formatDate } from '#utils/date';

import {
  RUNS_PAGE_SIZE,
  RUN_STATUS_COLORS,
  SCHEDULED_OUTPUT_DIALOG
} from '../constants';
import { ScheduledRunStatus } from '../enum';
import { useRerunRun, useScheduledRuns, useStopRun } from '../hooks';
import { errorMessage } from '../utils';
import RunOutput from './RunOutput';

import type { IScheduledRun } from '../types';

export interface IRunHistoryProps {
  taskId: number;
}

const RunHistory = ({ taskId }: IRunHistoryProps) => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useScheduledRuns(taskId, page);
  const rerun = useRerunRun();
  const stop = useStopRun();

  if (isLoading) {
    return <TmnLoading />;
  }
  if (isError || !data) {
    return (
      <TmnCallout role="alert" color="red">
        {trans('scheduled.runs_error')}
        <TmnButton onClick={() => refetch()}>
          {trans('scheduled.retry')}
        </TmnButton>
      </TmnCallout>
    );
  }

  const fail = (e: Error) => UIUtils.notify.error(errorMessage(e));
  const pages = Math.max(1, Math.ceil(data.total / RUNS_PAGE_SIZE));
  const acting = (mutation: typeof rerun, run: IScheduledRun) =>
    mutation.isPending && mutation.variables === run.id;

  const view = (run: IScheduledRun) =>
    UIUtils.popup.open({
      name: SCHEDULED_OUTPUT_DIALOG,
      size: 'xl',
      title: trans('scheduled.output_title', {
        date: formatDate(run.scheduledFor)
      }),
      renderer: () => <RunOutput runId={run.id} />
    });

  // A failed or missed run is open until it is dismissed or someone reran it.
  // shortcut: reruns are looked up on the loaded page only; upgrade to a server-provided flag if reruns land on another page.
  const needsAction = (run: IScheduledRun) =>
    (run.status === ScheduledRunStatus.MISSED ||
      run.status === ScheduledRunStatus.FAILED) &&
    !run.dismissedAt &&
    !data.data.some(other => other.rerunOfId === run.id);

  return (
    <TmnFlex direction="column" gap={3} className="min-w-0">
      {data.data.length === 0 ? (
        <TmnText className="text-sm text-muted-foreground">
          {trans('scheduled.runs_empty')}
        </TmnText>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-1">{trans('scheduled.col.scheduled_for')}</th>
              <th>{trans('scheduled.col.source')}</th>
              <th>{trans('scheduled.col.status')}</th>
              <th>{trans('scheduled.col.error')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.data.map(run => (
              <tr key={run.id} className="border-b border-border align-top">
                <td className="py-1">{formatDate(run.scheduledFor)}</td>
                <td>{trans(`scheduled.trigger.${run.trigger}`)}</td>
                <td>
                  <TmnChip color={RUN_STATUS_COLORS[run.status]}>
                    {trans(`scheduled.status.${run.status}`)}
                  </TmnChip>
                </td>
                <td className="max-w-64 break-words">{run.error ?? ''}</td>
                <td>
                  <TmnFlex gap={1} justify="end">
                    {run.status === ScheduledRunStatus.COMPLETED && (
                      <TmnButton onClick={() => view(run)}>
                        {trans('scheduled.view')}
                      </TmnButton>
                    )}
                    {needsAction(run) && (
                      <TmnButton
                        kind="primary"
                        disabled={acting(rerun, run)}
                        onClick={() => rerun.mutate(run.id, { onError: fail })}
                      >
                        {trans('scheduled.rerun')}
                      </TmnButton>
                    )}
                    {run.status === ScheduledRunStatus.RUNNING && (
                      <TmnButton
                        disabled={acting(stop, run)}
                        onClick={() => stop.mutate(run.id, { onError: fail })}
                      >
                        {trans('scheduled.stop')}
                      </TmnButton>
                    )}
                  </TmnFlex>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <TmnFlex direction="row" gap={2} align="center" justify="end">
          <TmnButton disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {trans('scheduled.prev')}
          </TmnButton>
          <TmnText className="text-sm">{`${page} / ${pages}`}</TmnText>
          <TmnButton disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {trans('scheduled.next')}
          </TmnButton>
        </TmnFlex>
      )}
    </TmnFlex>
  );
};
export default memo(RunHistory);
