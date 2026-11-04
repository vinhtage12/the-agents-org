import { memo } from 'react';
import Markdown from 'react-markdown';

import {
  TmnBox,
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnLoading,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { MARKDOWN_CLASS } from '#modules/tickets';

import { useRunOutput } from '../hooks';
import { copyText, errorMessage } from '../utils';

import type { MouseEvent } from 'react';

export interface IRunOutputProps {
  runId: number;
}

const RunOutput = ({ runId }: IRunOutputProps) => {
  const { data, isLoading, error } = useRunOutput(runId, true);

  if (isLoading) {
    return <TmnLoading />;
  }
  if (error || !data) {
    return (
      <TmnCallout role="alert" color="red">
        {error ? errorMessage(error) : trans('scheduled.action_failed')}
      </TmnCallout>
    );
  }

  // Synchronous in the click handler: no await before copyText keeps the user activation alive.
  const copy = (e: MouseEvent<HTMLButtonElement>) => {
    const container =
      e.currentTarget.closest<HTMLElement>('[role="dialog"]') ?? document.body;
    copyText(data.content, container).then(ok =>
      ok
        ? UIUtils.notify.success(trans('scheduled.copied'))
        : UIUtils.notify.error(trans('scheduled.copy_failed'))
    );
  };

  return (
    <TmnFlex direction="column" gap={3}>
      <TmnFlex justify="end">
        <TmnButton onClick={copy}>{trans('scheduled.copy')}</TmnButton>
      </TmnFlex>
      <TmnBox className={MARKDOWN_CLASS}>
        <Markdown>{data.content}</Markdown>
      </TmnBox>
    </TmnFlex>
  );
};
export default memo(RunOutput);
