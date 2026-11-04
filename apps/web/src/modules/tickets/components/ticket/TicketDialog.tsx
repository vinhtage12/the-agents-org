import { memo, useState } from 'react';
import Markdown from 'react-markdown';

import {
  TmnBox,
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnLoading,
  TmnTab,
  TmnText,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';
import { useWorkspaces } from '#modules/workspaces';

import { LOCAL_TICKET_DIALOG, MARKDOWN_CLASS } from '../../constants';
import { useTicketDetail } from '../../hooks';
import AgentTerminal from '../AgentTerminal';
import LocalTicketDialogRenderer from '../LocalTicketDialogRenderer';
import RunList from '../RunList';
import SpecEditForm from '../SpecEditForm';
import SpecPanel from '../SpecPanel';
import StopAgentsButton from '../StopAgentsButton';
import TestPanel from '../TestPanel';
import TicketLink from './TicketLink';
import TicketSettingsForm from './TicketSettingsForm';

export interface ITicketDialogProps {
  ticketId: number;
}
const TicketDialog = ({ ticketId }: ITicketDialogProps) => {
  const { data, isLoading, error, refetch } = useTicketDetail(ticketId);
  const [editDirty, setEditDirty] = useState(false);
  const [tab, setTab] = useState('spec');
  const workspaces = useWorkspaces();

  if (isLoading) {
    return <TmnLoading />;
  }
  if (error || !data) {
    return (
      <TmnCallout color="red">
        <TmnText>{trans('ticket.load_failed')}</TmnText>
        <TmnButton onClick={() => refetch()}>{trans('ticket.retry')}</TmnButton>
      </TmnCallout>
    );
  }

  const workspaceId = workspaces.data?.find(w =>
    w.projects.some(p => p.id === data.projectId)
  )?.id;

  const openEdit = () => {
    if (workspaceId === undefined || data.projectId === null) {
      return;
    }
    UIUtils.popup.open({
      name: LOCAL_TICKET_DIALOG,
      size: 'lg',
      title: trans('ticket.local.edit_title'),
      renderer: LocalTicketDialogRenderer,
      params: {
        workspaceId,
        projectId: data.projectId,
        hybrid: data.projectSpecSource === 'HYBRID',
        ticket: data
      }
    });
  };

  return (
    <TmnFlex direction="column" gap={3} className="min-w-0">
      <TmnFlex direction="row" gap={2} align="center" justify="between">
        <TmnText className="text-sm">{data.summary}</TmnText>
        {data.source === 'LOCAL' &&
          data.status === 'TODO' &&
          workspaceId !== undefined && (
            <TmnButton onClick={openEdit}>
              {trans('ticket.local.edit')}
            </TmnButton>
          )}
      </TmnFlex>
      {data.source === 'LOCAL' && (
        <TmnFlex direction="column" gap={1}>
          <TmnText className="text-xs text-muted-foreground">
            {data.specFile
              ? trans('ticket.local.spec_file_value', { file: data.specFile })
              : trans('ticket.local.description')}
          </TmnText>
          {!data.specFile && (
            <TmnBox className={MARKDOWN_CLASS}>
              <Markdown>{data.description}</Markdown>
            </TmnBox>
          )}
        </TmnFlex>
      )}
      {data.parent && (
        <TmnFlex direction="column" gap={1} className="min-w-0">
          <TmnText className="text-xs text-muted-foreground">
            {trans('ticket.parent')}
          </TmnText>
          <TmnFlex direction="row" gap={2} align="center" className="min-w-0">
            <TicketLink
              href={data.parent.jiraUrl}
              jiraKey={data.parent.key}
              className="shrink-0 text-sm"
            />
            {data.parent.summary && (
              <TmnText className="truncate text-sm">
                {data.parent.summary}
              </TmnText>
            )}
          </TmnFlex>
          {data.parent.description && (
            <TmnBox className={MARKDOWN_CLASS}>
              <Markdown>{data.parent.description}</Markdown>
            </TmnBox>
          )}
        </TmnFlex>
      )}
      {(data.status === 'IN_SPEC' ||
        data.runs.some(run => run.status === 'RUNNING')) && (
        <StopAgentsButton ticketId={data.id} />
      )}
      <TmnTab.Container
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: 'spec', label: trans('ticket.tab.spec') },
          { value: 'edit', label: trans('ticket.tab.edit') },
          { value: 'settings', label: trans('ticket.tab.settings') },
          { value: 'test', label: trans('ticket.tab.test') },
          { value: 'agents', label: trans('ticket.tab.agents') },
          { value: 'terminal', label: trans('ticket.tab.terminal') }
        ]}
      >
        <TmnTab.Content value="spec">
          <SpecPanel ticket={data} editDirty={editDirty} />
        </TmnTab.Content>
        {/* Stay mounted so unsaved edits survive a tab switch. */}
        <TmnTab.Content
          value="edit"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          {data.spec ? (
            <SpecEditForm
              key={data.spec.version}
              ticketId={data.id}
              content={data.spec.content}
              disabled={data.status !== 'IN_REVIEW_SPEC'}
              onDirtyChange={setEditDirty}
            />
          ) : (
            <TmnText className="text-sm text-muted-foreground">
              {trans('ticket.spec_empty')}
            </TmnText>
          )}
        </TmnTab.Content>
        <TmnTab.Content value="settings">
          <TicketSettingsForm
            key={`${data.projectId}-${data.status}`}
            ticket={data}
          />
        </TmnTab.Content>
        <TmnTab.Content value="test">
          <TestPanel ticket={data} />
        </TmnTab.Content>
        <TmnTab.Content value="agents">
          <RunList runs={data.runs} />
        </TmnTab.Content>
        {/* Mounted only while selected so closed tabs do not poll output. */}
        <TmnTab.Content value="terminal">
          {tab === 'terminal' && <AgentTerminal runs={data.runs} />}
        </TmnTab.Content>
      </TmnTab.Container>
    </TmnFlex>
  );
};
export default memo(TicketDialog);
