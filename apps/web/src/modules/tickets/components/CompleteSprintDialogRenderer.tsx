import CompleteSprintDialog, {
  type ICompleteSprintDialogProps
} from './CompleteSprintDialog';

import type { TmnPopupItemRendererParams } from '@truyenmoinhu/uikit';

const CompleteSprintDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<Omit<ICompleteSprintDialogProps, 'onDone'>>) => {
  if (!params) {
    return null;
  }
  return <CompleteSprintDialog {...params} onDone={api.dismiss} />;
};
export default CompleteSprintDialogRenderer;
