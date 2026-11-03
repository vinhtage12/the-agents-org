import { memo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

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
  TmnCard,
  TmnFlex,
  TmnInput,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { SpecSource } from '../enum';
import { WorkspaceError } from '../error';
import { useWorkspaceMutation } from '../hooks';
import {
  getEntityEndpoint,
  getEntityFormTitle,
  getEntityPath,
  getWorkspaceRoute
} from '../utils';
import WorkspaceLink from './workspace/WorkspaceLink';

import type {
  IEntityFormContext,
  IEntityFormValues,
  IEntityWriteValues,
  IProject,
  IWorkspace,
  TSpecSource
} from '../types';
export interface IEntityFormProps extends IEntityFormContext {
  workspaces?: IWorkspace[];
}
const SPEC_SOURCES = Object.values(SpecSource);
const EntityForm = ({
  workspace,
  entity,
  projectMode = false,
  workspaces = []
}: IEntityFormProps) => {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const mutation = useWorkspaceMutation<IProject, IEntityWriteValues>();
  const form = useFormResolver<IEntityFormValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        name: entity?.name ?? '',
        code: entity?.code ?? '',
        workspaceId: String(workspace?.id ?? ''),
        specSource:
          (entity as IProject | undefined)?.specSource ?? SpecSource.JIRA,
        specDir: (entity as IProject | undefined)?.specDir ?? ''
      }
    }
  });
  const specSource = form.watch('specSource');
  const context = { entity, projectMode, workspace };
  const title = trans(getEntityFormTitle(context));

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      const url = getEntityEndpoint(context);
      const saved = await mutation.mutateAsync({
        url,
        method: entity ? RequestMethods.PATCH : RequestMethods.POST,
        data: {
          name: values.name,
          code: values.code,
          ...(projectMode && entity
            ? { workspaceId: Number(values.workspaceId) }
            : {}),
          ...(projectMode
            ? {
                specSource: values.specSource,
                specDir:
                  values.specSource === SpecSource.JIRA
                    ? null
                    : values.specDir.trim()
              }
            : {})
        }
      });
      if (!saved) {
        throw new Error('Missing response');
      }
      UIUtils.notify.success(trans('workspace.saved'));
      await navigate(
        getWorkspaceRoute(
          projectMode
            ? `${values.workspaceId}/projects/${saved.id}`
            : String(saved.id)
        )
      );
    } catch (error) {
      const text =
        error instanceof WorkspaceError && error.status === 409
          ? trans('workspace.duplicate')
          : error instanceof WorkspaceError && error.status === 400
            ? error.message
            : trans('workspace.save_failed');
      setMessage(text);
    }
  });
  return (
    <TmnCard header={{ title }} className="w-full max-w-xl">
      <TmnForm onSubmit={submit} className="flex flex-col gap-5">
        <TmnController
          control={form.control}
          name="name"
          render={({ field, fieldState: { error } }) => {
            return (
              <TmnInput.TextField
                {...field}
                label={trans('workspace.name')}
                required
                maxLength={255}
                message={error?.message}
              />
            );
          }}
        />

        <TmnController
          control={form.control}
          name="code"
          render={({ field, fieldState: { error } }) => {
            return (
              <TmnInput.TextField
                {...field}
                label={trans('workspace.code')}
                required
                maxLength={32}
                message={error?.message}
                helperText={trans('workspace.code_hint')}
              />
            );
          }}
        />

        {projectMode && entity && (
          <TmnController
            control={form.control}
            name="workspaceId"
            render={({ field }) => (
              <TmnInput.Select
                label={trans('workspace.parent')}
                value={field.value}
                onChange={field.onChange}
                options={workspaces.map(w => ({
                  value: String(w.id),
                  label: w.name
                }))}
              />
            )}
          />
        )}
        {projectMode && (
          <TmnController
            control={form.control}
            name="specSource"
            render={({ field }) => (
              <TmnInput.Select
                label={trans('workspace.spec_source')}
                value={field.value}
                onChange={field.onChange}
                options={SPEC_SOURCES.map(value => ({
                  value,
                  label: trans(`workspace.spec_source_${value.toLowerCase()}`)
                }))}
              />
            )}
          />
        )}
        {projectMode && specSource !== SpecSource.JIRA && (
          <TmnController
            control={form.control}
            name="specDir"
            render={({ field, fieldState: { error } }) => (
              <TmnInput.TextField
                {...field}
                label={trans('workspace.spec_dir')}
                required
                message={error?.message}
                helperText={trans('workspace.spec_dir_hint')}
              />
            )}
          />
        )}
        {message && (
          <TmnCallout role="alert" color="red">
            {message}
          </TmnCallout>
        )}
        <TmnFlex direction="row" gap={3} align="center">
          <TmnButton
            kind="primary"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {trans(
              form.formState.isSubmitting
                ? 'workspace.saving'
                : entity
                  ? 'workspace.save'
                  : 'workspace.submit'
            )}
          </TmnButton>
          <WorkspaceLink path={getEntityPath(context)}>
            {trans('workspace.cancel')}
          </WorkspaceLink>
        </TmnFlex>
      </TmnForm>
    </TmnCard>
  );
};
export default memo(EntityForm);
const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .trim()
      .required(trans('workspace.required'))
      .max(255, trans('workspace.name_limit')),
    code: validation
      .string()
      .trim()
      .required(trans('workspace.required'))
      .max(32, trans('workspace.code_limit'))
      .matches(/^[A-Za-z0-9_-]+$/, trans('workspace.code_format')),
    workspaceId: validation.string().defined(),
    specSource: validation.string<TSpecSource>().defined(),
    specDir: validation
      .string()
      .trim()
      .test(
        'required',
        trans('workspace.required'),
        (value, ctx) => ctx.parent.specSource === SpecSource.JIRA || !!value
      )
  });
