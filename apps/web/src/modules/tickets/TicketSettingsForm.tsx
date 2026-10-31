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
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { AGENT_STEPS } from './constants';
import { useUpdateTicket } from './hooks';
import { toTicketUpdate } from './utils';

import type {
  IAgentOption,
  ITicketDetail,
  ITicketSettingsValues
} from './types';
export interface ITicketSettingsFormProps {
  ticket: ITicketDetail;
  profiles: IAgentOption[];
}
const TicketSettingsForm = ({ ticket, profiles }: ITicketSettingsFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useUpdateTicket();
  const form = useFormResolver<ITicketSettingsValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        projectId: ticket.projectId ? String(ticket.projectId) : '',
        repoId: ticket.repoId ? String(ticket.repoId) : '',
        specAgent: ticket.specAgent ?? '',
        devAgent: ticket.devAgent ?? '',
        testAgent: ticket.testAgent ?? '',
        extraSkills: ticket.extraSkills.join(', '),
        extraInstructions: ticket.extraInstructions
      }
    }
  });
  const running = ticket.runs.some(run => run.status === 'RUNNING');
  const none = { value: '', label: trans('ticket.none') };
  const agentOptions = [
    none,
    ...profiles.map(p => ({
      value: p.slug,
      label: `${p.name} - ${p.provider}${p.model ? ` - ${p.model}` : ''}`
    }))
  ];
  const missing = AGENT_STEPS.map(step => ticket[step]).filter(
    (slug): slug is string =>
      slug !== null && !profiles.some(p => p.slug === slug)
  );

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        ticketId: ticket.id,
        data: toTicketUpdate(values, ticket)
      });
      UIUtils.notify.success(trans('ticket.settings_saved'));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : trans('ticket.request_failed')
      );
    }
  });

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-4">
      {missing.map(slug => (
        <TmnCallout key={slug} color="orange">
          {trans('ticket.agent_missing', { slug })}
        </TmnCallout>
      ))}
      {ticket.status === 'TODO' && ticket.projects.length > 0 && (
        <TmnController
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <TmnInput.Select
              label={trans('ticket.project')}
              value={field.value}
              onChange={field.onChange}
              options={ticket.projects.map(p => ({
                value: String(p.id),
                label: `${p.code} - ${p.name}`
              }))}
            />
          )}
        />
      )}
      <TmnController
        control={form.control}
        name="repoId"
        render={({ field }) => (
          <TmnInput.Select
            label={trans('ticket.repo')}
            value={field.value}
            onChange={field.onChange}
            disabled={running}
            options={[
              none,
              ...ticket.repos.map(r => ({
                value: String(r.id),
                label: `${r.name} - ${r.path}`
              }))
            ]}
          />
        )}
      />
      {AGENT_STEPS.map(step => (
        <TmnController
          key={step}
          control={form.control}
          name={step}
          render={({ field }) => (
            <TmnInput.Select
              label={trans(`ticket.${step}`)}
              value={field.value}
              onChange={field.onChange}
              disabled={step === 'specAgent' && running}
              options={agentOptions}
            />
          )}
        />
      ))}
      {running && (
        <TmnCallout color="gray">{trans('ticket.locked_running')}</TmnCallout>
      )}
      <TmnController
        control={form.control}
        name="extraSkills"
        render={({ field, fieldState }) => (
          <TmnInput.TextField
            label={trans('ticket.extra_skills')}
            helperText={trans('ticket.extra_skills_hint')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="extraInstructions"
        render={({ field }) => (
          <TmnInput.TextArea
            label={trans('ticket.extra_instructions')}
            value={field.value}
            onChange={field.onChange}
            rows={5}
          />
        )}
      />
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
      <TmnFlex direction="row">
        <TmnButton
          kind="primary"
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {trans('ticket.save_settings')}
        </TmnButton>
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(TicketSettingsForm);
const createSchema = () =>
  validation.object({
    projectId: validation.string().defined(),
    repoId: validation.string().defined(),
    specAgent: validation.string().defined(),
    devAgent: validation.string().defined(),
    testAgent: validation.string().defined(),
    extraSkills: validation
      .string()
      .defined()
      .matches(/^[A-Za-z0-9:._,\s-]*$/, () =>
        trans('ticket.extra_skills_invalid')
      ),
    extraInstructions: validation.string().defined()
  });
