import { memo, useState } from 'react';

import {
  TmnController,
  TmnForm,
  useFormResolver,
  validation
} from '@truyenmoinhu/form';
import {
  TmnAutocomplete,
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnInput,
  TmnLoading,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { BRANCH_TYPES, TICKET_ENDPOINTS } from '../constants';
import { TicketStatus } from '../enum';
import { useGitBranches, useMoveTicket } from '../hooks';

import type { IBranchValues } from '../types';

export interface IBranchDialogProps {
  ticketId: number;
  jiraKey: string;
  repoId: number | null;
  onDone: () => void;
}
// First move to In Progress: cut the ticket branch, then the daemon starts the agents.
const BranchDialog = ({
  ticketId,
  jiraKey,
  repoId,
  onDone
}: IBranchDialogProps) => {
  const [message, setMessage] = useState('');
  const branches = useGitBranches(repoId);
  const move = useMoveTicket();
  const form = useFormResolver<IBranchValues>({
    schema: createSchema(),
    configs: {
      defaultValues: { base: null, type: BRANCH_TYPES[0], name: jiraKey }
    }
  });

  if (repoId === null) {
    return (
      <TmnCallout color="orange">{trans('ticket.branch_no_repo')}</TmnCallout>
    );
  }
  if (branches.isLoading) {
    return <TmnLoading />;
  }
  if (branches.error || !branches.data) {
    return (
      <TmnCallout role="alert" color="red">
        {branches.error?.message || trans('ticket.load_failed')}
      </TmnCallout>
    );
  }

  const base = branches.data.base;
  const create = (push: boolean) =>
    form.handleSubmit(async values => {
      setMessage('');
      const baseName = values.base?.label ?? base;
      if (!baseName) {
        setMessage(trans('ticket.branch_base_required'));
        return;
      }
      try {
        await move.mutateAsync({
          ticketId,
          to: TicketStatus.IN_PROGRESS,
          branch: {
            base: baseName,
            name: `${values.type}/${values.name}`,
            push
          }
        });
        onDone();
      } catch (e) {
        setMessage(
          e instanceof Error && e.message
            ? e.message
            : trans('ticket.move_failed')
        );
      }
    });

  return (
    <TmnForm onSubmit={create(false)} className="flex flex-col gap-4">
      <TmnText weight="bold">{jiraKey}</TmnText>
      <TmnController
        control={form.control}
        name="base"
        render={({ field }) => (
          <TmnAutocomplete
            label={trans('ticket.branch_base')}
            helperText={base ? undefined : trans('ticket.branch_base_hint')}
            apiUrl={TICKET_ENDPOINTS.repositories(`${repoId}/git-branches`)}
            initFetch
            value={field.value ?? (base ? { label: base } : null)}
            onChange={value => field.onChange(value ?? null)}
            getOptionLabel={option => option.label}
          />
        )}
      />
      <TmnFlex direction="row" gap={2} align="end">
        <TmnController
          control={form.control}
          name="type"
          render={({ field }) => (
            <TmnInput.Select
              label={trans('ticket.branch_target')}
              value={field.value}
              onChange={field.onChange}
              options={BRANCH_TYPES.map(type => ({ value: type, label: type }))}
            />
          )}
        />
        <TmnText className="pb-2">/</TmnText>
        <TmnController
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <TmnInput.TextField
              aria-label={trans('ticket.branch_name')}
              value={field.value}
              onChange={field.onChange}
              message={fieldState.error?.message}
              className="min-w-0 flex-1"
            />
          )}
        />
      </TmnFlex>
      {message && (
        <TmnCallout role="alert" color="red">
          {message}
        </TmnCallout>
      )}
      <TmnFlex direction="row" gap={2} wrap="wrap">
        <TmnButton
          kind="primary"
          type="submit"
          disabled={move.isPending || form.formState.isSubmitting}
        >
          {trans('ticket.branch_create')}
        </TmnButton>
        <TmnButton
          kind="primary"
          variant="outline"
          disabled={move.isPending || form.formState.isSubmitting}
          onClick={create(true)}
        >
          {trans('ticket.branch_create_push')}
        </TmnButton>
        <TmnButton onClick={onDone}>{trans('ticket.cancel')}</TmnButton>
      </TmnFlex>
    </TmnForm>
  );
};
export default memo(BranchDialog);
const createSchema = () =>
  validation.object({
    base: validation.mixed<{ label: string }>().nullable().defined(),
    type: validation.string().defined(),
    name: validation
      .string()
      .defined()
      .required(() => trans('ticket.branch_name_required'))
      .max(200)
  });
