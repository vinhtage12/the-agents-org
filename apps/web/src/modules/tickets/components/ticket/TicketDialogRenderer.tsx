import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import { TICKET_DIALOG } from '../../constants';
import TicketDialog, { type ITicketDialogProps } from './TicketDialog';

const TicketDialogRenderer = ({
  params
}: TmnPopupItemRendererParams<ITicketDialogProps>) => {
  if (!params?.ticketId) {
    return null;
  }
  return <TicketDialog ticketId={params.ticketId} />;
};
export default TicketDialogRenderer;

export const openTicketDialog = (ticketId: number) => {
  UIUtils.popup.open({
    name: TICKET_DIALOG,
    size: 'xl',
    renderer: TicketDialogRenderer,
    params: { ticketId }
  });
};
