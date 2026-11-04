import { memo, useMemo, useRef } from 'react';
import { History, Pencil, Play, Plus, Trash2 } from 'lucide-react';

import { type IColDef, type ITableApi, Table } from '@truyenmoinhu/table';
import {
  TmnButton,
  TmnChip,
  TmnFlex,
  TmnSwitch,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { formatDate } from '#utils/date';

import { RUN_STATUS_COLORS } from '../constants';
import {
  useConfirmDeleteScheduledTask,
  useRunScheduledTask,
  useSaveScheduledTask
} from '../hooks';
import { errorMessage, formatSchedule } from '../utils';

import type { IScheduledTask } from '../types';

export interface IScheduledTaskTableProps {
  tasks: IScheduledTask[];
  onCreate?: () => void;
  onEdit?: (task: IScheduledTask) => void;
  onHistory?: (task: IScheduledTask) => void;
}
const ScheduledTaskTable = ({
  tasks,
  onCreate,
  onEdit,
  onHistory
}: IScheduledTaskTableProps) => {
  const tableRef = useRef<ITableApi<IScheduledTask> | null>(null);
  const { mutate: save } = useSaveScheduledTask();
  const { mutate: runNow } = useRunScheduledTask();
  const remove = useConfirmDeleteScheduledTask();

  const colDefs = useMemo<IColDef<IScheduledTask>[]>(() => {
    const fail = (e: Error) => UIUtils.notify.error(errorMessage(e));
    return [
      {
        colId: 'name',
        headerName: trans('scheduled.name'),
        flex: 1,
        field: 'name'
      },
      {
        colId: 'schedule',
        headerName: trans('scheduled.schedule'),
        flex: 1,
        valueGetter: ({ data }) =>
          data ? formatSchedule(data.time, data.days) : ''
      },
      {
        colId: 'agent',
        headerName: trans('scheduled.agent'),
        flex: 1,
        valueGetter: ({ data }) => data?.agent.name
      },
      {
        colId: 'lastRun',
        headerName: trans('scheduled.last_run'),
        flex: 1,
        cellRenderer: ({ data }: { data: IScheduledTask }) =>
          data.lastRun ? (
            <TmnFlex gap={2} align="center">
              <TmnChip color={RUN_STATUS_COLORS[data.lastRun.status]}>
                {trans(`scheduled.status.${data.lastRun.status}`)}
              </TmnChip>
              {formatDate(data.lastRun.finishedAt ?? data.lastRun.scheduledFor)}
            </TmnFlex>
          ) : (
            '—'
          )
      },
      {
        colId: 'next',
        headerName: trans('scheduled.next_run'),
        width: 150,
        valueGetter: ({ data }) => formatDate(data?.nextRunAt)
      },
      {
        colId: 'enabled',
        headerName: trans('scheduled.enabled'),
        width: 90,
        cellRenderer: ({ data }: { data: IScheduledTask }) => (
          <TmnSwitch
            checked={data.enabled}
            aria-label={trans('scheduled.enabled')}
            onCheckedChange={enabled =>
              save({ id: data.id, enabled }, { onError: fail })
            }
          />
        )
      },
      {
        colId: 'actions',
        headerName: trans('scheduled.actions'),
        width: 200,
        pinned: 'end',
        cellRenderer: ({ data }: { data: IScheduledTask }) => (
          <TmnFlex gap={1} justify="end">
            <TmnButton
              variant="transparent"
              kind="default"
              startIcon={Play}
              aria-label={trans('scheduled.run_now')}
              title={trans('scheduled.run_now')}
              onClick={() => runNow(data.id, { onError: fail })}
            />
            {onHistory && (
              <TmnButton
                variant="transparent"
                kind="default"
                startIcon={History}
                aria-label={trans('scheduled.history')}
                title={trans('scheduled.history')}
                onClick={() => onHistory(data)}
              />
            )}
            {onEdit && (
              <TmnButton
                variant="transparent"
                kind="default"
                startIcon={Pencil}
                aria-label={trans('scheduled.edit')}
                title={trans('scheduled.edit')}
                onClick={() => onEdit(data)}
              />
            )}
            <TmnButton
              variant="transparent"
              kind="default"
              startIcon={Trash2}
              aria-label={trans('scheduled.delete')}
              title={trans('scheduled.delete')}
              onClick={() => remove(data.id, data.name)}
            />
          </TmnFlex>
        )
      }
    ];
  }, [save, runNow, remove, onEdit, onHistory]);

  return (
    <Table<IScheduledTask>
      tableRef={tableRef}
      colDefs={colDefs}
      data={tasks}
      getRowId={row => String(row.id)}
      emptyMessage={trans('scheduled.empty')}
      rightNode={
        onCreate && (
          <TmnButton kind="primary" startIcon={Plus} onClick={onCreate}>
            {trans('scheduled.create')}
          </TmnButton>
        )
      }
    />
  );
};
export default memo(ScheduledTaskTable);
