import SprintDialog, { type ISprintDialogProps } from './SprintDialog';

import type { TmnPopupItemRendererParams } from '@truyenmoinhu/uikit';

const SprintDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<Omit<ISprintDialogProps, 'onDone'>>) => {
  if (!params) {
    return null;
  }
  return <SprintDialog {...params} onDone={api.dismiss} />;
};
export default SprintDialogRenderer;
