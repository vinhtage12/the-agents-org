import { memo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import {
  TmnController,
  TmnForm,
  useFieldArray,
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

import { BRANCH_KINDS } from '../constants';
import { BranchKind } from '../enum';
import { useWarehouseMutation } from '../hooks';

import type { IRepoEnvironment, IRepoEnvironmentValues } from '../types';

export interface IEnvironmentFormProps {
  repoId: number;
  environment?: IRepoEnvironment;
  onDone: () => void;
}
const EnvironmentForm = ({
  repoId,
  environment,
  onDone
}: IEnvironmentFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useWarehouseMutation<unknown, IRepoEnvironmentValues>();
  const form = useFormResolver<IRepoEnvironmentValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        name: environment?.name ?? '',
        envFile: environment?.envFile ?? '',
        branches:
          environment?.branches.map(b => ({ name: b.name, kind: b.kind })) ?? []
      }
    }
  });
  const branches = useFieldArray({ control: form.control, name: 'branches' });

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        kind: 'repositories',
        path: environment
          ? `${repoId}/environments/${environment.id}`
          : `${repoId}/environments`,
        method: environment ? RequestMethods.PATCH : RequestMethods.POST,
        data: values
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
    <TmnForm
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-md border border-border p-3"
    >
      <TmnController
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TmnInput.TextField
            label={trans('warehouse.repo.env_name')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="envFile"
        render={({ field }) => (
          <TmnInput.TextField
            label={trans('warehouse.repo.env_file')}
            helperText={trans('warehouse.repo.env_file_hint')}
            value={field.value}
            onChange={field.onChange}
          />
        )}
      />
      {branches.fields.map((item, index) => (
        <TmnFlex key={item.id} direction="row" gap={2} align="end">
          <TmnController
            control={form.control}
            name={`branches.${index}.name`}
            render={({ field, fieldState }) => (
              <TmnInput.TextField
                label={trans('warehouse.repo.branch_name')}
                value={field.value}
                onChange={field.onChange}
                message={fieldState.error?.message}
                className="min-w-0 flex-1"
              />
            )}
          />
          <TmnController
            control={form.control}
            name={`branches.${index}.kind`}
            render={({ field }) => (
              <TmnInput.Select
                label={trans('warehouse.repo.branch_kind')}
                value={field.value}
                onChange={field.onChange}
                options={BRANCH_KINDS.map(kind => ({
                  value: kind,
                  label: trans(`warehouse.repo.kind.${kind}`)
                }))}
              />
            )}
          />
          <TmnButton
            variant="transparent"
            kind="default"
            startIcon={Trash2}
            aria-label={trans('warehouse.repo.remove_branch')}
            onClick={() => branches.remove(index)}
          />
        </TmnFlex>
      ))}
      <TmnFlex direction="row" gap={2}>
        <TmnButton
          variant="outline"
          startIcon={Plus}
          onClick={() => branches.append({ name: '', kind: BranchKind.NONE })}
        >
          {trans('warehouse.repo.add_branch')}
        </TmnButton>
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
          {trans('warehouse.save')}
        </TmnButton>
        <TmnButton onClick={onDone}>{trans('warehouse.cancel')}</TmnButton>
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(EnvironmentForm);
const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required'))
      .max(64),
    envFile: validation.string().defined().max(255),
    branches: validation
      .array()
      .of(
        validation.object({
          name: validation
            .string()
            .defined()
            .required(() => trans('warehouse.required'))
            .max(255),
          kind: validation
            .mixed<'CHECKOUT_BASE' | 'PR_TARGET' | 'NONE'>()
            .defined()
        })
      )
      .defined()
  });
