import { memo, useState } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import {
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnInput,
  TmnLoading
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { ISSUE_TYPES, SPRINT_BACKLOG } from '../constants';
import {
  useCreateLocalTicket,
  useSpecFiles,
  useUpdateLocalTicket
} from '../hooks';
import { selectableSprints } from '../utils';
import { openTicketDialog } from './ticket/TicketDialogRenderer';

import type {
  ILocalTicketContent,
  ILocalTicketValues,
  ISprint,
  ITicketDetail
} from '../types';

export interface ILocalTicketDialogProps {
  workspaceId: number;
  projectId: number;
  hybrid: boolean;
  // Create mode takes sprints; edit mode takes the ticket and has no sprint field.
  sprints?: ISprint[];
  ticket?: ITicketDetail;
  onDone: () => void;
}
// Creates a LOCAL ticket, or edits the content of one still in To Do.
const LocalTicketDialog = ({
  workspaceId,
  projectId,
  hybrid,
  sprints = [],
  ticket,
  onDone
}: ILocalTicketDialogProps) => {
  const [message, setMessage] = useState('');
  const files = useSpecFiles(workspaceId, projectId);
  const create = useCreateLocalTicket();
  const update = useUpdateLocalTicket();
  const form = useFormResolver<ILocalTicketValues>({
    schema: createSchema(),
    configs: {
      defaultValues: {
        summary: ticket?.summary ?? '',
        issueType: ticket?.issueType ?? 'Task',
        mode: ticket && !ticket.specFile ? 'text' : 'file',
        specFile: ticket?.specFile ?? '',
        description: ticket?.description ?? '',
        sprint: SPRINT_BACKLOG
      }
    }
  });
  const mode = form.watch('mode');

  const submit = form.handleSubmit(async values => {
    setMessage('');
    const text = values.description.trim();
    if (values.mode === 'file' ? !values.specFile : !text) {
      setMessage(
        trans(
          values.mode === 'file'
            ? 'ticket.local.spec_file_required'
            : 'ticket.local.description_required'
        )
      );
      return;
    }
    const content: ILocalTicketContent = {
      summary: values.summary.trim(),
      issueType: values.issueType,
      ...(values.mode === 'file'
        ? { specFile: values.specFile }
        : { description: values.description })
    };
    try {
      if (ticket) {
        await update.mutateAsync({ ticketId: ticket.id, data: content });
        onDone();
        return;
      }
      const created = await create.mutateAsync({
        projectId,
        data: {
          ...content,
          sprintId:
            values.sprint === SPRINT_BACKLOG ? null : Number(values.sprint)
        }
      });
      onDone();
      if (created) {
        openTicketDialog(created.id);
      }
    } catch (e) {
      setMessage(
        e instanceof Error && e.message
          ? e.message
          : trans('ticket.request_failed')
      );
    }
  });

  if (files.isLoading) {
    return <TmnLoading />;
  }

  return (
    <TmnForm onSubmit={submit} className="flex flex-col gap-4">
      <TmnController
        control={form.control}
        name="summary"
        render={({ field, fieldState }) => (
          <TmnInput.TextField
            label={trans('ticket.local.summary')}
            value={field.value}
            onChange={field.onChange}
            message={fieldState.error?.message}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="issueType"
        render={({ field }) => (
          <TmnInput.Select
            label={trans('ticket.local.issue_type')}
            value={field.value}
            onChange={field.onChange}
            options={ISSUE_TYPES.map(type => ({ value: type, label: type }))}
          />
        )}
      />
      <TmnController
        control={form.control}
        name="mode"
        render={({ field }) => (
          <TmnInput.Select
            label={trans('ticket.local.spec_source')}
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'file', label: trans('ticket.local.mode_file') },
              { value: 'text', label: trans('ticket.local.mode_text') }
            ]}
          />
        )}
      />
      {mode === 'file' ? (
        <TmnController
          control={form.control}
          name="specFile"
          render={({ field }) => (
            <TmnInput.Select
              label={trans('ticket.local.spec_file')}
              helperText={
                files.data?.data.length
                  ? undefined
                  : trans(
                      files.error
                        ? 'ticket.local.spec_files_failed'
                        : 'ticket.local.spec_files_empty'
                    )
              }
              value={field.value}
              onChange={field.onChange}
              options={(files.data?.data ?? []).map(f => ({
                value: f.label,
                label: f.label
              }))}
            />
          )}
        />
      ) : (
        <TmnController
          control={form.control}
          name="description"
          render={({ field }) => (
            <TmnInput.TextArea
              label={trans('ticket.local.description')}
              value={field.value}
              onChange={field.onChange}
              rows={10}
            />
          )}
        />
      )}
      {!ticket && (
        <TmnController
          control={form.control}
          name="sprint"
          render={({ field }) => (
            <TmnInput.Select
              label={trans('sprint.filter')}
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: SPRINT_BACKLOG, label: trans('sprint.backlog') },
                ...selectableSprints(sprints, 'LOCAL', hybrid).map(s => ({
                  value: String(s.id),
                  label: s.name
                }))
              ]}
            />
          )}
        />
      )}
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
      <TmnFlex direction="row" gap={2}>
        <TmnButton
          kind="primary"
          type="submit"
          disabled={
            create.isPending || update.isPending || form.formState.isSubmitting
          }
        >
          {trans(ticket ? 'ticket.local.save' : 'ticket.local.create')}
        </TmnButton>
        <TmnButton onClick={onDone}>{trans('ticket.cancel')}</TmnButton>
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(LocalTicketDialog);
const createSchema = () =>
  validation.object({
    summary: validation
      .string()
      .defined()
      .trim()
      .required(() => trans('ticket.local.summary_required'))
      .max(1024),
    issueType: validation.string<ILocalTicketValues['issueType']>().defined(),
    mode: validation.string<ILocalTicketValues['mode']>().defined(),
    specFile: validation.string().defined(),
    description: validation.string().defined(),
    sprint: validation.string().defined()
  });
