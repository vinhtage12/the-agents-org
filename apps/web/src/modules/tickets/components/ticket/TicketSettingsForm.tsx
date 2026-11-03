import { memo, useState } from 'react';
import { SaveIcon } from 'lucide-react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import {
  TmnAutocomplete,
  TmnButton,
  TmnCallout,
  TmnGrid,
  TmnInput,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import {
  AgentAvatar,
  type IOption,
  WAREHOUSE_ENDPOINTS,
  agentLabel,
  optionLabel,
  skillLabel
} from '#modules/warehouse';

import { AGENT_STEPS, SPRINT_BACKLOG } from '../../constants';
import { useProjectSprints, useUpdateTicket } from '../../hooks';
import { selectableSprints, toTicketUpdate } from '../../utils';

import type { ITicketDetail, ITicketSettingsValues } from '../../types';
export interface ITicketSettingsFormProps {
  ticket: ITicketDetail;
}
const TicketSettingsForm = ({ ticket }: ITicketSettingsFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useUpdateTicket();
  const sprints = useProjectSprints(ticket.projectId ?? 0);
  const form = useFormResolver<ITicketSettingsValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        projectId: ticket.projectId ? String(ticket.projectId) : '',
        repoId: ticket.repoId ? String(ticket.repoId) : '',
        specAgent: ticket.specAgent,
        devAgent: ticket.devAgent,
        testAgent: ticket.testAgent,
        skills: ticket.skills,
        rules: ticket.rules,
        extraInstructions: ticket.extraInstructions,
        sprint:
          ticket.sprintId === null ? SPRINT_BACKLOG : String(ticket.sprintId)
      }
    }
  });
  const running = ticket.runs.some(run => run.status === 'RUNNING');
  const followsJira =
    ticket.source === 'JIRA' && ticket.sprintSource === 'JIRA';

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
      <TmnGrid.Container>
        {ticket.status === 'TODO' && ticket.projects.length > 0 && (
          <TmnGrid.Item colSpan={6}>
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
          </TmnGrid.Item>
        )}

        {sprints.data && (
          <TmnGrid.Item colSpan={6}>
            <TmnController
              control={form.control}
              name="sprint"
              render={({ field }) => (
                <TmnInput.Select
                  label={trans('sprint.filter')}
                  helperText={
                    followsJira
                      ? trans('ticket.sprint_follows_jira')
                      : undefined
                  }
                  value={field.value}
                  onChange={field.onChange}
                  disabled={followsJira}
                  options={[
                    { value: SPRINT_BACKLOG, label: trans('sprint.backlog') },
                    ...selectableSprints(
                      sprints.data ?? [],
                      ticket.source,
                      ticket.projectSpecSource === 'HYBRID',
                      ticket.sprintId
                    ).map(s => ({ value: String(s.id), label: s.name }))
                  ]}
                />
              )}
            />
          </TmnGrid.Item>
        )}

        <TmnGrid.Item colSpan={ticket.branch ? 6 : 12}>
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
                  { value: '', label: trans('ticket.none') },
                  ...ticket.repos.map(r => ({
                    value: String(r.id),
                    label: `${r.name} (${r.path})`
                  }))
                ]}
              />
            )}
          />
        </TmnGrid.Item>

        {ticket.branch && (
          <TmnGrid.Item colSpan={6}>
            <TmnText className="text-sm">
              {trans('ticket.branch')}: {ticket.branch}
            </TmnText>
          </TmnGrid.Item>
        )}

        {AGENT_STEPS.map(({ step, role }) => (
          <TmnGrid.Item key={step} colSpan={4}>
            <span>
              <AgentAvatar agent={ticket[step]} />
              <TmnController
                control={form.control}
                name={step}
                render={({ field }) => (
                  <TmnAutocomplete
                    label={trans(`ticket.${step}`)}
                    apiUrl={WAREHOUSE_ENDPOINTS.agents()}
                    apiParams={{ role }}
                    initFetch
                    disabled={running}
                    value={field.value}
                    onChange={value =>
                      field.onChange((value as IOption | null) ?? null)
                    }
                    getOptionLabel={agentLabel}
                    className="min-w-0 flex-1"
                  />
                )}
              />
            </span>
          </TmnGrid.Item>
        ))}
        {running && (
          <TmnGrid.Item colSpan={12}>
            <TmnCallout color="gray">
              {trans('ticket.locked_running')}
            </TmnCallout>
          </TmnGrid.Item>
        )}
        <TmnGrid.Item colSpan={12}>
          <TmnController
            control={form.control}
            name="skills"
            render={({ field }) => (
              <TmnAutocomplete
                multiple
                label={trans('ticket.skills')}
                helperText={trans('ticket.skills_hint')}
                apiUrl={WAREHOUSE_ENDPOINTS.skills()}
                initFetch
                value={field.value}
                onChange={value => field.onChange((value as IOption[]) ?? [])}
                getOptionLabel={skillLabel}
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12}>
          <TmnController
            control={form.control}
            name="rules"
            render={({ field }) => (
              <TmnAutocomplete
                multiple
                label={trans('ticket.rules')}
                apiUrl={WAREHOUSE_ENDPOINTS.rules()}
                initFetch
                value={field.value}
                onChange={value => field.onChange((value as IOption[]) ?? [])}
                getOptionLabel={optionLabel}
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12}>
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
        </TmnGrid.Item>

        {message && (
          <TmnGrid.Item colSpan={12}>
            <TmnCallout role="alert" color="red">
              {message}
            </TmnCallout>
          </TmnGrid.Item>
        )}
        <TmnGrid.Item colSpan={12}>
          <TmnButton
            kind="primary"
            type="submit"
            disabled={form.formState.isSubmitting}
            startIcon={SaveIcon}
          >
            {trans('ticket.save_settings')}
          </TmnButton>
        </TmnGrid.Item>
      </TmnGrid.Container>
    </TmnForm>
  );
};
export default memo(TicketSettingsForm);
const createSchema = () =>
  validation.object({
    projectId: validation.string().defined(),
    repoId: validation.string().defined(),
    specAgent: validation.mixed<IOption>().nullable().defined(),
    devAgent: validation.mixed<IOption>().nullable().defined(),
    testAgent: validation.mixed<IOption>().nullable().defined(),
    skills: validation.array().defined(),
    rules: validation.array().defined(),
    extraInstructions: validation.string().defined(),
    sprint: validation.string().defined()
  });
