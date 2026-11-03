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

import { useWarehouseMutation } from './hooks';
import WarehouseDialogLayout from './WarehouseDialogLayout';

import type { IRule, IRuleValues } from './types';

export interface IRuleDialogProps {
  rule?: IRule;
  onDone: () => void;
  onOpenAgent?: (agentId: number) => void;
}
const RuleDialog = ({ rule, onDone, onOpenAgent }: IRuleDialogProps) => {
  const [message, setMessage] = useState('');
  const mutation = useWarehouseMutation<unknown, IRuleValues>();
  const form = useFormResolver<IRuleValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        name: rule?.name ?? '',
        path: rule?.path ?? '',
        description: rule?.description ?? ''
      }
    }
  });

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        kind: 'rules',
        path: rule ? String(rule.id) : undefined,
        method: rule ? RequestMethods.PATCH : RequestMethods.POST,
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
    <WarehouseDialogLayout kind="rules" id={rule?.id} onOpenAgent={onOpenAgent}>
      <TmnForm onSubmit={submit} className="flex flex-col gap-4">
        <TmnController
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <TmnInput.TextField
              label={trans('warehouse.rule.name')}
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
              label={trans('warehouse.rule.path')}
              helperText={trans('warehouse.rule.path_hint')}
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
    </WarehouseDialogLayout>
  );
};
export default memo(RuleDialog);
const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required'))
      .max(128),
    path: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required')),
    description: validation.string().defined()
  });
