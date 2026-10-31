import { memo, useEffect, useState } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import { TmnButton, TmnCallout, TmnInput, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useSaveSpec } from './hooks';

export interface ISpecEditFormProps {
  ticketId: number;
  content: string;
  disabled: boolean;
  onDirtyChange: (dirty: boolean) => void;
}
interface ISpecEditValues {
  content: string;
}
const SpecEditForm = ({
  ticketId,
  content,
  disabled,
  onDirtyChange
}: ISpecEditFormProps) => {
  const [message, setMessage] = useState('');
  const mutation = useSaveSpec();
  const form = useFormResolver<ISpecEditValues>({
    schema: createSchema(),
    configs: { defaultValues: { content } }
  });

  const { isDirty } = form.formState;

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        ticketId,
        data: { content: values.content }
      });
      form.reset(values);
      UIUtils.notify.success(trans('ticket.spec_saved'));
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : trans('ticket.request_failed')
      );
    }
  });

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-2">
      <TmnController
        control={form.control}
        name="content"
        render={({ field, fieldState }) => (
          <TmnInput.TextArea
            label={trans('ticket.spec_markdown')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
            disabled={disabled}
            rows={20}
            className="font-mono text-xs"
          />
        )}
      />
      {disabled && (
        <TmnCallout color="gray">{trans('ticket.edit_locked')}</TmnCallout>
      )}
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
      <TmnButton
        kind="primary"
        type="submit"
        className="self-start"
        disabled={disabled || form.formState.isSubmitting}
      >
        {trans('ticket.save_spec')}
      </TmnButton>
    </TmnForm>
  );
};
export default memo(SpecEditForm);
const createSchema = () =>
  validation.object({ content: validation.string().trim().required() });
