import { memo } from 'react';

import { TmnChip, TmnFlex } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { LABEL_COLORS } from '../../constants';
import { useTicketDetail } from '../../hooks';
import TicketLink from './TicketLink';

export interface ITicketDialogTitleProps {
  ticketId: number;
}
// Shares the TicketDialog query, so it costs no extra request.
const TicketDialogTitle = ({ ticketId }: ITicketDialogTitleProps) => {
  const { data } = useTicketDetail(ticketId);
  if (!data) {
    return null;
  }
  return (
    <TmnFlex direction="row" gap={2} align="center" wrap="wrap">
      {data.jiraUrl ? (
        <TicketLink href={data.jiraUrl} jiraKey={data.jiraKey} />
      ) : (
        data.jiraKey
      )}
      <TmnChip color="gray">{trans(`ticket.status.${data.status}`)}</TmnChip>
      {data.label && (
        <TmnChip color={LABEL_COLORS[data.label]}>
          {trans(`ticket.label.${data.label}`)}
        </TmnChip>
      )}
    </TmnFlex>
  );
};
export default memo(TicketDialogTitle);
