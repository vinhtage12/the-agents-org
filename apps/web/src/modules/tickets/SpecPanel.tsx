import { memo, useState } from 'react';
import Markdown from 'react-markdown';

import {
  TmnBox,
  TmnButton,
  TmnCallout,
  TmnChip,
  TmnFlex,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { MARKDOWN_CLASS } from './constants';
import { useApproveSpec } from './hooks';
import SpecFeedbackForm from './SpecFeedbackForm';

import type { ITicketDetail } from './types';
export interface ISpecPanelProps {
  ticket: ITicketDetail;
}
const SpecPanel = ({ ticket }: ISpecPanelProps) => {
  const [message, setMessage] = useState('');
  const approve = useApproveSpec();

  if (!ticket.spec) {
    return (
      <TmnText className="text-sm text-muted-foreground">
        {trans('ticket.spec_empty')}
      </TmnText>
    );
  }
  const reviewing = ticket.status === 'IN_REVIEW_SPEC';

  const onApprove = async () => {
    setMessage('');
    try {
      await approve.mutateAsync({ ticketId: ticket.id });
      UIUtils.notify.success(trans('ticket.spec_approved'));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : trans('ticket.request_failed')
      );
    }
  };

  return (
    <TmnFlex direction="column" gap={3}>
      <TmnFlex direction="row" gap={2} align="center">
        <TmnText weight="bold">v{ticket.spec.version}</TmnText>
        {ticket.spec.editedAt && (
          <TmnChip color="gray">{trans('ticket.spec_edited')}</TmnChip>
        )}
        {ticket.specApprovedAt && (
          <TmnChip color="green">{trans('ticket.label.approved')}</TmnChip>
        )}
      </TmnFlex>
      {ticket.spec.feedback && (
        <TmnText className="text-xs text-muted-foreground">
          {trans('ticket.spec_from_feedback', {
            feedback: ticket.spec.feedback
          })}
        </TmnText>
      )}
      <TmnBox className={MARKDOWN_CLASS}>
        <Markdown>{ticket.spec.content}</Markdown>
      </TmnBox>
      {reviewing && (
        <TmnFlex
          direction="column"
          gap={3}
          className="border-t border-border pt-3"
        >
          <SpecFeedbackForm ticketId={ticket.id} />
          {!ticket.specApprovedAt && (
            <TmnButton
              kind="primary"
              className="self-start"
              disabled={approve.isPending}
              onClick={onApprove}
            >
              {trans('ticket.approve')}
            </TmnButton>
          )}
        </TmnFlex>
      )}
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
    </TmnFlex>
  );
};
export default memo(SpecPanel);
