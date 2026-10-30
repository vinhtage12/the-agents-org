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

import { ProjectError } from './error';
import { useProjectSettingsMutation } from './hooks';
import { settingsPath } from './utils';

import type {
  IProjectRepo,
  IProjectRepoValues,
  IProjectSettingsProps
} from './types';
export interface IRepoFormProps extends IProjectSettingsProps {
  repo?: IProjectRepo;
  onDone?: () => void;
}
const RepoForm = ({ workspaceId, projectId, repo, onDone }: IRepoFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useProjectSettingsMutation<
    IProjectRepo,
    IProjectRepoValues
  >();
  const form = useFormResolver<IProjectRepoValues>({
    schema: createSchema(),
    configs: {
      defaultValues: { name: repo?.name ?? '', path: repo?.path ?? '' }
    }
  });

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        url: settingsPath(
          workspaceId,
          projectId,
          repo ? `repos/${repo.id}` : 'repos'
        ),
        method: repo ? RequestMethods.PATCH : RequestMethods.POST,
        data: values
      });
      UIUtils.notify.success(trans('project.repo_saved'));
      if (!repo) {
        form.reset({ name: '', path: '' });
      }
      onDone?.();
    } catch (error) {
      if (error instanceof ProjectError && error.status === 400) {
        form.setError('path', { message: trans('project.repo_path_invalid') });
        return;
      }
      setMessage(
        trans(
          error instanceof ProjectError && error.status === 409
            ? 'project.repo_duplicate'
            : 'project.save_failed'
        )
      );
    }
  });

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-3">
      <TmnFlex direction="row" gap={3} wrap="wrap" align="start">
        <TmnController
          control={form.control}
          name="name"
          render={({ field, fieldState: { error } }) => (
            <TmnInput.TextField
              {...field}
              label={trans('project.repo_name')}
              required
              maxLength={64}
              message={error?.message}
            />
          )}
        />
        <TmnController
          control={form.control}
          name="path"
          render={({ field, fieldState: { error } }) => (
            <TmnInput.TextField
              {...field}
              className="min-w-0 flex-1"
              label={trans('project.repo_path')}
              required
              maxLength={1024}
              message={error?.message}
              helperText={trans('project.repo_path_hint')}
            />
          )}
        />
      </TmnFlex>
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
      <TmnFlex direction="row" gap={2}>
        <TmnButton
          kind="primary"
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {trans(repo ? 'project.save' : 'project.add_repo')}
        </TmnButton>
        {onDone && (
          <TmnButton type="button" variant="transparent" onClick={onDone}>
            {trans('project.cancel')}
          </TmnButton>
        )}
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(RepoForm);
const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .trim()
      .required(trans('project.required'))
      .max(64, trans('project.repo_name_limit'))
      .matches(/^[A-Za-z0-9._-]+$/, trans('project.repo_name_format')),
    path: validation
      .string()
      .trim()
      .required(trans('project.required'))
      .matches(/^\//, trans('project.repo_path_invalid'))
  });
