import { memo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

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
  TmnLoading,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useWarehouseDetail, useWarehouseMutation } from '../../hooks';
import EnvironmentForm from '../EnvironmentForm';
import WarehouseDialogLayout from '../warehouse/WarehouseDialogLayout';

import type {
  IRepo,
  IRepoDetail,
  IRepoEnvironment,
  IRepoValues
} from '../../types';

export interface IRepositoryDialogProps {
  repo?: IRepo;
  onDone: () => void;
}
const RepositoryDialog = ({ repo, onDone }: IRepositoryDialogProps) => {
  // A new repo stays open after saving so environments can be added.
  const [repoId, setRepoId] = useState(repo?.id);
  const [message, setMessage] = useState('');
  // undefined: closed, null: new environment, otherwise editing that one.
  const [editing, setEditing] = useState<IRepoEnvironment | null | undefined>();
  const detail = useWarehouseDetail<IRepoDetail>('repositories', repoId);
  const mutation = useWarehouseMutation<IRepo, IRepoValues>();
  const remove = useWarehouseMutation();
  const form = useFormResolver<IRepoValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        name: repo?.name ?? '',
        path: repo?.path ?? '',
        description: repo?.description ?? ''
      }
    }
  });

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      const saved = await mutation.mutateAsync({
        kind: 'repositories',
        path: repoId === undefined ? undefined : String(repoId),
        method:
          repoId === undefined ? RequestMethods.POST : RequestMethods.PATCH,
        data: values
      });
      UIUtils.notify.success(trans('warehouse.saved'));
      if (repoId === undefined && saved) {
        setRepoId(saved.id);
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : trans('warehouse.save_failed')
      );
    }
  });

  const removeEnvironment = async (environment: IRepoEnvironment) => {
    try {
      await remove.mutateAsync({
        kind: 'repositories',
        path: `${repoId}/environments/${environment.id}`,
        method: RequestMethods.DELETE
      });
    } catch (e) {
      UIUtils.notify.error(
        e instanceof Error ? e.message : trans('warehouse.save_failed')
      );
    }
  };

  return (
    <WarehouseDialogLayout kind="repositories" id={repoId}>
      <TmnForm onSubmit={submit} className="flex flex-col gap-4">
        <TmnController
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <TmnInput.TextField
              label={trans('warehouse.repo.name')}
              value={field.value}
              onChange={field.onChange}
              message={fieldState.error?.message}
            />
          )}
        />
        <TmnController
          control={form.control}
          name="path"
          render={({ field, fieldState }) => (
            <TmnInput.TextField
              label={trans('warehouse.repo.path')}
              helperText={trans('warehouse.repo.path_hint')}
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
              rows={3}
            />
          )}
        />
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
            {trans('warehouse.save')}
          </TmnButton>
          <TmnButton onClick={onDone}>{trans('warehouse.close')}</TmnButton>
        </TmnFlex>
      </TmnForm>

      {repoId !== undefined && (
        <TmnFlex direction="column" gap={2}>
          <TmnFlex direction="row" align="center" justify="between">
            <TmnText weight="bold">
              {trans('warehouse.repo.environments')}
            </TmnText>
            <TmnButton
              variant="outline"
              startIcon={Plus}
              onClick={() => setEditing(null)}
            >
              {trans('warehouse.repo.add_env')}
            </TmnButton>
          </TmnFlex>
          {detail.isLoading && <TmnLoading />}
          {detail.data?.environments.map(environment => (
            <TmnFlex
              key={environment.id}
              direction="row"
              align="center"
              gap={2}
              className="rounded-md border border-border p-2"
            >
              <TmnFlex direction="column" className="min-w-0 flex-1">
                <TmnText weight="bold" className="truncate text-sm">
                  {environment.name}
                </TmnText>
                <TmnText className="truncate text-xs text-muted-foreground">
                  {environment.branches.map(b => b.name).join(', ')}
                </TmnText>
              </TmnFlex>
              <TmnButton
                variant="transparent"
                kind="default"
                startIcon={Pencil}
                aria-label={trans('warehouse.edit')}
                onClick={() => setEditing(environment)}
              />
              <TmnButton
                variant="transparent"
                kind="default"
                startIcon={Trash2}
                aria-label={trans('warehouse.delete')}
                onClick={() => removeEnvironment(environment)}
              />
            </TmnFlex>
          ))}
          {editing !== undefined && (
            <EnvironmentForm
              key={editing?.id ?? 'new'}
              repoId={repoId}
              environment={editing ?? undefined}
              onDone={() => setEditing(undefined)}
            />
          )}
        </TmnFlex>
      )}
    </WarehouseDialogLayout>
  );
};
export default memo(RepositoryDialog);
const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required'))
      .max(64)
      .matches(/^[A-Za-z0-9._-]+$/, () => trans('warehouse.repo.name_format')),
    path: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required')),
    description: validation.string().defined().max(2000)
  });
