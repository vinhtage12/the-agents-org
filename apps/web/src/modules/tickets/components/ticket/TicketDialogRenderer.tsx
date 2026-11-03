import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import { TICKET_DIALOG } from '../../constants';
import TicketDialog, { type ITicketDialogProps } from './TicketDialog';
import TicketDialogTitle from './TicketDialogTitle';

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
    title: ({ params }) =>
      params?.ticketId ? (
        <TicketDialogTitle ticketId={params.ticketId} />
      ) : null,
    renderer: TicketDialogRenderer,
    params: { ticketId }
  });
};
