import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { SCHEDULED_TASK_DIALOG } from '../constants';
import ScheduledTaskForm from './ScheduledTaskForm';

import type { IScheduledTask, IScheduledTaskDialogParams } from '../types';

const ScheduledTaskDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<IScheduledTaskDialogParams>) => (
  <ScheduledTaskForm task={params?.task} onDone={api.dismiss} />
);
export default ScheduledTaskDialogRenderer;

export const openScheduledTaskDialog = (task?: IScheduledTask) => {
  UIUtils.popup.open({
    name: SCHEDULED_TASK_DIALOG,
    size: 'lg',
    title: trans(task ? 'scheduled.edit_title' : 'scheduled.create_title'),
    renderer: ScheduledTaskDialogRenderer,
    params: { task }
  });
};
