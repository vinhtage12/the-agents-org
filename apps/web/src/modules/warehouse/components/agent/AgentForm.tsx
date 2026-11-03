import { memo, useState } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  useWatch,
  validation
} from '@truyenmoinhu/form';
import { RequestMethods } from '@truyenmoinhu/query';
import {
  TmnAutocomplete,
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnInput,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { AGENT_ROLES, PROVIDERS, WAREHOUSE_ENDPOINTS } from '../../constants';
import { useWarehouseMutation } from '../../hooks';
import { optionLabel, splitList } from '../../utils';

import type { IAgentDetail, IAgentValues, IOption } from '../../types';

export interface IAgentFormProps {
  agent?: IAgentDetail;
  onDone: () => void;
}
const AgentForm = ({ agent, onDone }: IAgentFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useWarehouseMutation();
  const form = useFormResolver<IAgentValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        name: agent?.name ?? '',
        role: agent?.role ?? 'DEV',
        provider: agent?.provider ?? PROVIDERS[0],
        model: agent?.model ?? '',
        effort: agent?.effort ?? '',
        path: agent?.path ?? '',
        description: agent?.description ?? '',
        allowedTools: agent?.allowedTools.join(', ') ?? '',
        skills: agent?.skills ?? [],
        rules: agent?.rules ?? []
      }
    }
  });
  const provider = useWatch({ control: form.control, name: 'provider' });

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        kind: 'agents',
        path: agent ? String(agent.id) : undefined,
        method: agent ? RequestMethods.PATCH : RequestMethods.POST,
        data: {
          name: values.name,
          role: values.role,
          provider: values.provider,
          model: values.model || null,
          effort: values.effort || null,
          path: values.path,
          description: values.description,
          allowedTools: splitList(values.allowedTools),
          skillIds: values.skills.map(s => s.id),
          ruleIds: values.rules.map(r => r.id)
        }
      });
      UIUtils.notify.success(trans('warehouse.saved'));
      onDone();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : trans('warehouse.save_failed')
      );
    }
  });

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-4">
      <TmnController
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TmnInput.TextField
            label={trans('warehouse.agent.name')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="role"
        render={({ field }) => (
          <TmnInput.Select
            label={trans('warehouse.agent.role')}
            value={field.value}
            onChange={field.onChange}
            options={AGENT_ROLES.map(role => ({
              value: role,
              label: trans(`warehouse.agent.roles.${role}`)
            }))}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="provider"
        render={({ field }) => (
          <TmnInput.Select
            label={trans('warehouse.provider')}
            value={field.value}
            onChange={value => {
              field.onChange(value);
              // Skills only work with their own provider.
              form.setValue('skills', []);
            }}
            options={PROVIDERS.map(p => ({ value: p, label: p }))}
          />
        )}
      />
      <TmnFlex direction="row" gap={2}>
        <TmnController
          control={form.control}
          name="model"
          render={({ field }) => (
            <TmnInput.TextField
              label={trans('warehouse.agent.model')}
              value={field.value}
              onChange={field.onChange}
              className="min-w-0 flex-1"
            />
          )}
        />
        <TmnController
          control={form.control}
          name="effort"
          render={({ field }) => (
            <TmnInput.TextField
              label={trans('warehouse.agent.effort')}
              value={field.value}
              onChange={field.onChange}
              className="min-w-0 flex-1"
            />
          )}
        />
      </TmnFlex>
      <TmnController
        control={form.control}
        name="path"
        render={({ field, fieldState }) => (
          <TmnInput.TextField
            label={trans('warehouse.agent.path')}
            helperText={trans('warehouse.agent.path_hint')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="description"
        render={({ field }) => (
          <TmnInput.TextArea
            label={trans('warehouse.description')}
            value={field.value}
            onChange={field.onChange}
            rows={2}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="allowedTools"
        render={({ field, fieldState }) => (
          <TmnInput.TextField
            label={trans('warehouse.agent.allowed_tools')}
            helperText={trans('warehouse.agent.allowed_tools_hint')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="skills"
        render={({ field }) => (
          <TmnAutocomplete
            multiple
            label={trans('warehouse.agent.skills')}
            apiUrl={WAREHOUSE_ENDPOINTS.skills()}
            apiParams={{ provider }}
            initFetch
            value={field.value}
            onChange={value => field.onChange((value as IOption[]) ?? [])}
            getOptionLabel={optionLabel}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="rules"
        render={({ field }) => (
          <TmnAutocomplete
            multiple
            label={trans('warehouse.agent.rules')}
            apiUrl={WAREHOUSE_ENDPOINTS.rules()}
            initFetch
            value={field.value}
            onChange={value => field.onChange((value as IOption[]) ?? [])}
            getOptionLabel={optionLabel}
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
          {trans('warehouse.save')}
        </TmnButton>
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(AgentForm);
const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required'))
      .max(128),
    role: validation.mixed<IAgentValues['role']>().defined(),
    provider: validation.string().defined(),
    model: validation.string().defined(),
    effort: validation.string().defined(),
    path: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required')),
    description: validation.string().defined().max(512),
    allowedTools: validation
      .string()
      .defined()
      .matches(/^[A-Za-z0-9_*:().,\s-]*$/, () =>
        trans('warehouse.agent.allowed_tools_invalid')
      ),
    skills: validation.array().defined(),
    rules: validation.array().defined()
  });
