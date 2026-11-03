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
import {
  type IOption,
  WAREHOUSE_ENDPOINTS,
  agentLabel,
  optionLabel
} from '#modules/warehouse';

import { AGENT_FIELDS } from './constants';
import { useProjectSettingsMutation } from './hooks';
import { settingsPath } from './utils';

import type {
  IProjectDefaultsValues,
  IProjectSettings,
  IProjectSettingsProps
} from './types';
export interface IDefaultsFormProps extends IProjectSettingsProps {
  settings: IProjectSettings;
}
const DefaultsForm = ({
  workspaceId,
  projectId,
  settings
}: IDefaultsFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useProjectSettingsMutation();
  const form = useFormResolver<IProjectDefaultsValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        repos: settings.repos,
        defaultRepoId: settings.defaultRepoId
          ? String(settings.defaultRepoId)
          : '',
        specAgent: settings.specAgent,
        devAgent: settings.devAgent,
        testAgent: settings.testAgent
      }
    }
  });
  const repos = useWatch({ control: form.control, name: 'repos' });
  const repoOptions = [
    { value: '', label: trans('project.none') },
    ...repos.map(r => ({ value: String(r.id), label: optionLabel(r) }))
  ];

  const submit = form.handleSubmit(async values => {
    setMessage('');
    const defaultRepoId = Number(values.defaultRepoId);
    try {
      await mutation.mutateAsync({
        url: settingsPath(workspaceId, projectId),
        method: RequestMethods.PATCH,
        data: {
          repoIds: values.repos.map(r => r.id),
          defaultRepoId: values.repos.some(r => r.id === defaultRepoId)
            ? defaultRepoId
            : null,
          specAgentId: values.specAgent?.id ?? null,
          devAgentId: values.devAgent?.id ?? null,
          testAgentId: values.testAgent?.id ?? null
        }
      });
      UIUtils.notify.success(trans('project.defaults_saved'));
    } catch {
      setMessage(trans('project.save_failed'));
    }
  });

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-4">
      <TmnController
        control={form.control}
        name="repos"
        render={({ field }) => (
          <TmnAutocomplete
            multiple
            label={trans('project.repos')}
            apiUrl={WAREHOUSE_ENDPOINTS.repositories()}
            initFetch
            value={field.value}
            onChange={value => field.onChange((value as IOption[]) ?? [])}
            getOptionLabel={optionLabel}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="defaultRepoId"
        render={({ field }) => (
          <TmnInput.Select
            label={trans('project.default_repo')}
            value={field.value}
            onChange={field.onChange}
            options={repoOptions}
          />
        )}
      />
      {AGENT_FIELDS.map(({ field: name, role }) => (
        <TmnController
          key={name}
          control={form.control}
          name={name}
          render={({ field }) => (
            <TmnAutocomplete
              label={trans(`project.${name}`)}
              apiUrl={WAREHOUSE_ENDPOINTS.agents()}
              apiParams={{ role }}
              initFetch
              value={field.value}
              onChange={value =>
                field.onChange((value as IOption | null) ?? null)
              }
              getOptionLabel={agentLabel}
            />
          )}
        />
      ))}
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
          {trans(
            form.formState.isSubmitting ? 'project.saving' : 'project.save'
          )}
        </TmnButton>
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(DefaultsForm);
const createSchema = () =>
  validation.object({
    repos: validation.array().defined(),
    defaultRepoId: validation.string().defined(),
    specAgent: validation.mixed<IOption>().nullable().defined(),
    devAgent: validation.mixed<IOption>().nullable().defined(),
    testAgent: validation.mixed<IOption>().nullable().defined()
  });
