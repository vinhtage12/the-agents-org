import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { SCHEDULED_HISTORY_DIALOG } from '../constants';
import RunHistory from './RunHistory';

import type { IScheduledHistoryDialogParams, IScheduledTask } from '../types';

const RunHistoryDialogRenderer = ({
  params
}: TmnPopupItemRendererParams<IScheduledHistoryDialogParams>) => {
  if (!params?.task) {
    return null;
  }
  return <RunHistory taskId={params.task.id} />;
};
export default RunHistoryDialogRenderer;

export const openRunHistoryDialog = (task: IScheduledTask) => {
  UIUtils.popup.open({
    name: SCHEDULED_HISTORY_DIALOG,
    size: 'xl',
    title: trans('scheduled.history_title', { name: task.name }),
    renderer: RunHistoryDialogRenderer,
    params: { task }
  });
};
