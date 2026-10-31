import { memo, useState } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import {
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnInput,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { TicketError } from './error';
import { useAgentOutput, useReplyAgent } from './hooks';

import type { IAgentRun } from './types';
export interface IAgentTerminalProps {
  runs: IAgentRun[];
}
interface IReplyValues {
  prompt: string;
}
const AgentTerminal = ({ runs }: IAgentTerminalProps) => {
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const reply = useReplyAgent();
  const form = useFormResolver<IReplyValues>({
    schema: createSchema(),
    configs: { defaultValues: { prompt: '' } }
  });
  // Newest run first, so the default pane is the latest one.
  const live = runs
    .filter(run => run.status === 'RUNNING' && run.paneId)
    .sort((a, b) => b.id - a.id);
  const paneId =
    live.find(run => run.paneId === selected)?.paneId ??
    live[0]?.paneId ??
    null;
  const { data } = useAgentOutput(paneId);
  const empty = !form.watch('prompt').trim();

  if (!paneId) {
    return (
      <TmnText className="text-sm text-muted-foreground">
        {trans('ticket.terminal_empty')}
      </TmnText>
    );
  }

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await reply.mutateAsync({ paneId, prompt: values.prompt.trim() });
      form.reset({ prompt: '' });
    } catch (e) {
      if (e instanceof TicketError && e.status === 409) {
        setMessage(trans('ticket.terminal_needs_dialog'));
      } else {
        setMessage(
          e instanceof Error ? e.message : trans('ticket.request_failed')
        );
      }
    }
  });

  return (
    <TmnFlex direction="column" gap={3} className="min-w-0">
      <TmnInput.Select
        label={trans('ticket.terminal_pane')}
        value={paneId}
        onChange={value => setSelected(String(value))}
        options={live.map(run => ({
          value: run.paneId as string,
          label: `${trans(`ticket.step.${run.step}`)} - ${run.agentSlug} (${run.paneId})`
        }))}
      />
      <pre
        ref={el => {
          // Stick to the newest output on every render.
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        }}
        className="max-h-96 min-h-40 overflow-auto rounded-md bg-muted p-2 font-mono text-xs whitespace-pre-wrap"
      >
        {data?.text ?? ''}
      </pre>
      <TmnForm onSubmit={submit} className="flex flex-col gap-2">
        <TmnController
          control={form.control}
          name="prompt"
          render={({ field }) => (
            <TmnInput.TextField
              label={trans('ticket.terminal_reply')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        {message && (
          <TmnCallout role="alert" color="red">
            {message}
          </TmnCallout>
        )}
        <TmnButton
          type="submit"
          className="self-start"
          disabled={empty || form.formState.isSubmitting}
        >
          {trans('ticket.terminal_send')}
        </TmnButton>
      </TmnForm>
    </TmnFlex>
  );
};
export default memo(AgentTerminal);
const createSchema = () =>
  validation.object({ prompt: validation.string().trim().required() });
