import { memo } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import { RequestMethods } from '@truyenmoinhu/query';
import { TmnButton, TmnFlex, TmnInput, UIUtils } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { TICKET_ENDPOINTS } from '../../constants';
import { useSprintMutation } from '../../hooks';

import type { ISprint, ISprintValues } from '../../types';

export interface ISprintDialogProps {
  projectId: number;
  sprint?: ISprint;
  onDone: () => void;
}
// Creates a LOCAL sprint, or edits the name and dates of one.
const SprintDialog = ({ projectId, sprint, onDone }: ISprintDialogProps) => {
  const save = useSprintMutation();
  const form = useFormResolver<ISprintValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        name: sprint?.name ?? '',
        startDate: sprint?.startDate?.slice(0, 10) ?? '',
        endDate: sprint?.endDate?.slice(0, 10) ?? ''
      }
    }
  });

  const submit = form.handleSubmit(async values => {
    const dates = {
      startDate: values.startDate || null,
      endDate: values.endDate || null
    };
    try {
      await save.mutateAsync(
        sprint
          ? {
              url: TICKET_ENDPOINTS.sprints(String(sprint.id)),
              method: RequestMethods.PATCH,
              data: { name: values.name || undefined, ...dates }
            }
          : {
              url: TICKET_ENDPOINTS.projects(`${projectId}/sprints`),
              method: RequestMethods.POST,
              data: { name: values.name || undefined, ...dates }
            }
      );
      onDone();
    } catch (e) {
      UIUtils.notify.error(
        e instanceof Error && e.message ? e.message : trans('sprint.failed')
      );
    }
  });

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-4">
      <TmnController
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <TmnInput.TextField
            label={trans('sprint.name')}
            helperText={sprint ? undefined : trans('sprint.name_hint')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
          />
        )}
      />
      <TmnFlex direction="row" gap={2} wrap="wrap">
        <TmnController
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <TmnInput.TextField
              type="date"
              label={trans('sprint.start_date')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <TmnController
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <TmnInput.TextField
              type="date"
              label={trans('sprint.end_date')}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </TmnFlex>
      <TmnFlex direction="row" gap={2}>
        <TmnButton
          kind="primary"
          type="submit"
          disabled={save.isPending || form.formState.isSubmitting}
        >
          {trans('sprint.save')}
        </TmnButton>
        <TmnButton onClick={onDone}>{trans('ticket.cancel')}</TmnButton>
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(SprintDialog);
const createSchema = () =>
  validation.object({
    name: validation.string().defined().max(255),
    startDate: validation.string().defined(),
    endDate: validation.string().defined()
  });
