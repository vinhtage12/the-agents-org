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
  TmnFlex,
  TmnGrid,
  TmnInput,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import {
  type IAgentRef,
  type IRepo,
  type WarehouseKind,
  useWarehouseList
} from '#modules/warehouse';

import { WEEKDAYS } from '../constants';
import { useSaveScheduledTask } from '../hooks';
import { errorMessage, toFormValues, toSaveTask } from '../utils';

import type { IScheduledTask, IScheduledTaskFormValues } from '../types';

export interface IScheduledTaskFormProps {
  task?: IScheduledTask;
  onDone: () => void;
}

const AGENTS: WarehouseKind = 'agents';
const REPOSITORIES: WarehouseKind = 'repositories';

const ScheduledTaskForm = ({ task, onDone }: IScheduledTaskFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useSaveScheduledTask();
  const agents = useWarehouseList<IAgentRef>(AGENTS);
  const repos = useWarehouseList<IRepo>(REPOSITORIES);
  const form = useFormResolver<IScheduledTaskFormValues>({
    schema: createSchema(),
    configs: { defaultValues: toFormValues(task) }
  });

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync(toSaveTask(values, task?.id));
      onDone();
    } catch (e) {
      setMessage(
        e instanceof Error ? errorMessage(e) : trans('scheduled.action_failed')
      );
    }
  });

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-4">
      <TmnGrid.Container>
        <TmnGrid.Item colSpan={8}>
          <TmnController
            control={form.control}
            name="name"
            render={({ field, fieldState }) => (
              <TmnInput.TextField
                label={trans('scheduled.name')}
                value={field.value}
                onChange={field.onChange}
                message={fieldState.error?.message}
              />
            )}
          />
        </TmnGrid.Item>
        <TmnGrid.Item colSpan={4}>
          <TmnController
            control={form.control}
            name="time"
            render={({ field, fieldState }) => (
              <TmnInput.TextField
                type="time"
                label={trans('scheduled.time')}
                value={field.value}
                onChange={field.onChange}
                message={fieldState.error?.message}
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12}>
          <TmnController
            control={form.control}
            name="days"
            render={({ field, fieldState }) => (
              <TmnFlex direction="column" gap={1}>
                <TmnText className="text-sm">
                  {trans('scheduled.repeat')}
                </TmnText>
                <TmnFlex direction="row" gap={2} className="flex-wrap">
                  {WEEKDAYS.map(day => {
                    const selected = field.value.includes(day);
                    return (
                      <TmnButton
                        key={day}
                        type="button"
                        kind={selected ? 'primary' : 'default'}
                        aria-pressed={selected}
                        onClick={() =>
                          field.onChange(
                            selected
                              ? field.value.filter(d => d !== day)
                              : [...field.value, day]
                          )
                        }
                      >
                        {trans(`scheduled.day.${day}`)}
                      </TmnButton>
                    );
                  })}
                </TmnFlex>
                {fieldState.error?.message && (
                  <TmnText className="text-xs text-destructive">
                    {fieldState.error.message}
                  </TmnText>
                )}
              </TmnFlex>
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12}>
          <TmnController
            control={form.control}
            name="agentId"
            render={({ field, fieldState }) => (
              <TmnInput.Select
                label={trans('scheduled.agent')}
                value={field.value}
                onChange={field.onChange}
                message={fieldState.error?.message}
                options={(agents.data ?? []).map(agent => ({
                  value: String(agent.id),
                  label: `${agent.name} (${agent.provider})`
                }))}
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12}>
          <TmnController
            control={form.control}
            name="repos"
            render={({ field, fieldState }) => (
              <TmnAutocomplete
                multiple
                label={trans('scheduled.repos')}
                helperText={trans('scheduled.repos_hint')}
                message={fieldState.error?.message}
                options={repos.data ?? []}
                value={field.value}
                onChange={value => field.onChange((value as IRepo[]) ?? [])}
                getOptionLabel={(repo: IRepo) => `${repo.name} (${repo.path})`}
                isOptionEqualToValue={(option: IRepo, value: IRepo) =>
                  option.id === value.id
                }
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12}>
          <TmnController
            control={form.control}
            name="outputDir"
            render={({ field, fieldState }) => (
              <TmnInput.TextField
                label={trans('scheduled.output_dir')}
                value={field.value}
                onChange={field.onChange}
                message={fieldState.error?.message}
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12}>
          <TmnController
            control={form.control}
            name="prompt"
            render={({ field, fieldState }) => (
              <TmnInput.TextArea
                label={trans('scheduled.prompt')}
                value={field.value}
                onChange={field.onChange}
                message={fieldState.error?.message}
                rows={6}
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
            {trans('scheduled.save')}
          </TmnButton>
        </TmnGrid.Item>
      </TmnGrid.Container>
    </TmnForm>
  );
};
export default memo(ScheduledTaskForm);

const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .defined()
      .trim()
      .required(() => trans('scheduled.required')),
    time: validation
      .string()
      .defined()
      .required(() => trans('scheduled.required')),
    days: validation
      .array()
      .of(validation.number().defined())
      .defined()
      .min(1, () => trans('scheduled.days_required')),
    agentId: validation
      .string()
      .defined()
      .required(() => trans('scheduled.required')),
    repos: validation
      .array()
      .defined()
      .min(1, () => trans('scheduled.repos_required')),
    outputDir: validation
      .string()
      .defined()
      .trim()
      .required(() => trans('scheduled.required')),
    prompt: validation
      .string()
      .defined()
      .trim()
      .required(() => trans('scheduled.required'))
  });
