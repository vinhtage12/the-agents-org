import { memo, useState } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import { TmnButton, TmnCallout, TmnInput, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useDevFeedback, useSpecFeedback } from './hooks';

export interface IFeedbackFormProps {
  ticketId: number;
  target: 'spec' | 'dev';
  disabled: boolean;
}
interface IFeedbackValues {
  feedback: string;
}
const FeedbackForm = ({ ticketId, target, disabled }: IFeedbackFormProps) => {
  const [message, setMessage] = useState('');
  const spec = useSpecFeedback();
  const dev = useDevFeedback();
  const mutation = target === 'spec' ? spec : dev;
  const form = useFormResolver<IFeedbackValues>({
    schema: createSchema(),
    configs: { defaultValues: { feedback: '' } }
  });
  const empty = !form.watch('feedback').trim();

  const submit = form.handleSubmit(async values => {
    setMessage('');
    try {
      await mutation.mutateAsync({
        ticketId,
        data: { feedback: values.feedback.trim() }
      });
      form.reset({ feedback: '' });
      UIUtils.notify.success(trans(`ticket.feedback_sent.${target}`));
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
        name="feedback"
        render={({ field, fieldState }) => (
          <TmnInput.TextArea
            label={trans('ticket.feedback')}
            placeholder={trans(`ticket.feedback_placeholder.${target}`)}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
            rows={4}
          />
        )}
      />
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
      <TmnButton
        type="submit"
        className="self-start"
        disabled={disabled || empty || form.formState.isSubmitting}
      >
        {trans('ticket.send_feedback')}
      </TmnButton>
    </TmnForm>
  );
};
export default memo(FeedbackForm);
const createSchema = () =>
  validation.object({ feedback: validation.string().trim().required() });
