import BranchDialog, { type IBranchDialogProps } from './BranchDialog';

import type { TmnPopupItemRendererParams } from '@truyenmoinhu/uikit';

const BranchDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<Omit<IBranchDialogProps, 'onDone'>>) => {
  if (!params) {
    return null;
  }
  return <BranchDialog {...params} onDone={api.dismiss} />;
};
export default BranchDialogRenderer;
