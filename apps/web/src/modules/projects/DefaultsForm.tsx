import { memo, useState } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import { RequestMethods } from '@truyenmoinhu/query';
import {
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnInput,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { AGENT_ROLES } from './constants';
import { useProjectSettingsMutation } from './hooks';
import { settingsPath, toNullable } from './utils';

import type {
  IAgentProfile,
  IProjectDefaultsValues,
  IProjectSettings,
  IProjectSettingsProps
} from './types';
export interface IDefaultsFormProps extends IProjectSettingsProps {
  settings: IProjectSettings;
  profiles: IAgentProfile[];
}
const DefaultsForm = ({
  workspaceId,
  projectId,
  settings,
  profiles
}: IDefaultsFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useProjectSettingsMutation();
  const form = useFormResolver<IProjectDefaultsValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        defaultRepoId: settings.defaultRepoId
          ? String(settings.defaultRepoId)
          : '',
        specAgent: settings.specAgent ?? '',
        devAgent: settings.devAgent ?? '',
        testAgent: settings.testAgent ?? ''
      }
    }
  });
  const none = { value: '', label: trans('project.none') };
  const agentOptions = [
    none,
    ...profiles.map(p => ({
      value: p.slug,
      label: `${p.name} · ${p.provider}${p.model ? ` · ${p.model}` : ''}`
    }))
  ];
  const repoOptions = [
    none,
    ...settings.repos.map(r => ({ value: String(r.id), label: r.name }))
  ];

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        url: settingsPath(workspaceId, projectId),
        method: RequestMethods.PATCH,
        data: {
          defaultRepoId: values.defaultRepoId
            ? Number(values.defaultRepoId)
            : null,
          specAgent: toNullable(values.specAgent),
          devAgent: toNullable(values.devAgent),
          testAgent: toNullable(values.testAgent)
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
      {AGENT_ROLES.map(role => (
        <TmnController
          key={role}
          control={form.control}
          name={role}
          render={({ field }) => (
            <TmnInput.Select
              label={trans(`project.${role}`)}
              value={field.value}
              onChange={field.onChange}
              options={agentOptions}
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
    defaultRepoId: validation.string().defined(),
    specAgent: validation.string().defined(),
    devAgent: validation.string().defined(),
    testAgent: validation.string().defined()
  });
