import { memo } from 'react';

import {
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { formatDate } from '#utils/date';

import { ScheduledRunStatus } from '../enum';
import { useDismissRun, useRerunRun } from '../hooks';
import { errorMessage } from '../utils';

import type { IAttentionItem } from '../types';

export interface IAttentionPanelProps {
  items: IAttentionItem[];
}
const AttentionPanel = ({ items }: IAttentionPanelProps) => {
  const rerun = useRerunRun();
  const dismiss = useDismissRun();

  if (!items.length) {
    return null;
  }

  const run = (action: typeof rerun, id: number) =>
    action.mutate(id, {
      onError: e => UIUtils.notify.error(errorMessage(e))
    });

  return (
    <TmnCallout role="alert" color="orange">
      <TmnFlex direction="column" gap={2}>
        <TmnText weight="bold">
          {trans('scheduled.attention_title', { count: items.length })}
        </TmnText>
        {items.map(item => (
          <TmnFlex key={item.id} justify="between" align="center" gap={3}>
            <TmnText>
              {`${item.taskName} - ${formatDate(item.scheduledFor)} - ${
                item.status === ScheduledRunStatus.MISSED
                  ? trans('scheduled.missed')
                  : trans('scheduled.failed_with', { error: item.error ?? '' })
              }`}
            </TmnText>
            <TmnFlex gap={2}>
              <TmnButton
                kind="primary"
                disabled={rerun.isPending && rerun.variables === item.id}
                onClick={() => run(rerun, item.id)}
              >
                {trans('scheduled.rerun')}
              </TmnButton>
              <TmnButton
                disabled={dismiss.isPending && dismiss.variables === item.id}
                onClick={() => run(dismiss, item.id)}
              >
                {trans('scheduled.dismiss')}
              </TmnButton>
            </TmnFlex>
          </TmnFlex>
        ))}
      </TmnFlex>
    </TmnCallout>
  );
};
export default memo(AttentionPanel);
