import { memo } from 'react';
import { Save } from 'lucide-react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import { RequestMethods } from '@truyenmoinhu/query';
import {
  TmnButton,
  TmnGrid,
  TmnInput,
  TmnPicker,
  UIUtils
} from '@truyenmoinhu/uikit';
import { DateFormat, DateUtils } from '@truyenmoinhu/utils';

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
      <TmnGrid.Container>
        <TmnGrid.Item colSpan={12}>
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
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={6}>
          <TmnController
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <TmnPicker.Date
                label={trans('sprint.start_date')}
                format={DateFormat.DDMMYYYY}
                value={
                  field.value
                    ? DateUtils.toPickerDate(field.value, DateFormat.YYYYMMDD)
                    : null
                }
                onChange={value =>
                  field.onChange(
                    value
                      ? DateUtils.fromPickerDate(value, DateFormat.YYYYMMDD)
                      : ''
                  )
                }
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={6}>
          <TmnController
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <TmnPicker.Date
                label={trans('sprint.end_date')}
                format={DateFormat.DDMMYYYY}
                value={
                  field.value
                    ? DateUtils.toPickerDate(field.value, DateFormat.YYYYMMDD)
                    : null
                }
                onChange={value =>
                  field.onChange(
                    value
                      ? DateUtils.fromPickerDate(value, DateFormat.YYYYMMDD)
                      : ''
                  )
                }
              />
            )}
          />
        </TmnGrid.Item>

        <TmnGrid.Item colSpan={12} className="flex flex-row justify-end gap-2">
          <TmnButton onClick={onDone}>{trans('ticket.cancel')}</TmnButton>
          <TmnButton
            startIcon={Save}
            kind="primary"
            type="submit"
            disabled={save.isPending || form.formState.isSubmitting}
          >
            {trans('sprint.save')}
          </TmnButton>
        </TmnGrid.Item>
      </TmnGrid.Container>
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
