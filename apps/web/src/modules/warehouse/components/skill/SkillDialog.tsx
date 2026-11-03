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

import { PROVIDERS } from '../../constants';
import { useWarehouseMutation } from '../../hooks';
import WarehouseDialogLayout from '../warehouse/WarehouseDialogLayout';

import type { ISkill, ISkillValues } from '../../types';

export interface ISkillDialogProps {
  skill?: ISkill;
  onDone: () => void;
  onOpenAgent?: (agentId: number) => void;
}
const SkillDialog = ({ skill, onDone, onOpenAgent }: ISkillDialogProps) => {
  const [message, setMessage] = useState('');
  const mutation = useWarehouseMutation<unknown, ISkillValues>();
  const form = useFormResolver<ISkillValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        name: skill?.name ?? '',
        provider: skill?.provider ?? PROVIDERS[0],
        command: skill?.command ?? '',
        path: skill?.path ?? '',
        description: skill?.description ?? ''
      }
    }
  });

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        kind: 'skills',
        path: skill ? String(skill.id) : undefined,
        method: skill ? RequestMethods.PATCH : RequestMethods.POST,
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
    <WarehouseDialogLayout
      kind="skills"
      id={skill?.id}
      onOpenAgent={onOpenAgent}
    >
      <TmnForm onSubmit={submit} className="flex flex-col gap-4">
        <TmnController
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <TmnInput.TextField
              label={trans('warehouse.skill.name')}
              value={field.value}
              onChange={field.onChange}
              message={fieldState.error?.message}
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
              onChange={field.onChange}
              options={PROVIDERS.map(p => ({ value: p, label: p }))}
            />
          )}
        />
        <TmnController
          control={form.control}
          name="command"
          render={({ field, fieldState }) => (
            <TmnInput.TextField
              label={trans('warehouse.skill.command')}
              helperText={trans('warehouse.skill.command_hint')}
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
              label={trans('warehouse.skill.path')}
              helperText={trans('warehouse.skill.path_hint')}
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
export default memo(SkillDialog);
const createSchema = () =>
  validation.object({
    name: validation
      .string()
      .defined()
      .required(() => trans('warehouse.required'))
      .max(128),
    provider: validation.string().defined(),
    command: validation
      .string()
      .defined()
      .matches(/^[/$][A-Za-z0-9:._-]+$/, () =>
        trans('warehouse.skill.command_invalid')
      ),
    path: validation.string().defined(),
    description: validation.string().defined()
  });
