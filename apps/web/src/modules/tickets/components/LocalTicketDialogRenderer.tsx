import LocalTicketDialog, {
  type ILocalTicketDialogProps
} from './LocalTicketDialog';

import type { TmnPopupItemRendererParams } from '@truyenmoinhu/uikit';

const LocalTicketDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<Omit<ILocalTicketDialogProps, 'onDone'>>) => {
  if (!params) {
    return null;
  }
  return <LocalTicketDialog {...params} onDone={api.dismiss} />;
};
export default LocalTicketDialogRenderer;
