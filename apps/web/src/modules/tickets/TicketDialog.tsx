import { memo, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import {
  TmnButton,
  TmnCallout,
  TmnChip,
  TmnFlex,
  TmnLink,
  TmnLoading,
  TmnTab,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import AgentTerminal from './AgentTerminal';
import { LABEL_COLORS } from './constants';
import { useTicketDetail } from './hooks';
import RunList from './RunList';
import SpecEditForm from './SpecEditForm';
import SpecPanel from './SpecPanel';
import StopAgentsButton from './StopAgentsButton';
import TestPanel from './TestPanel';
import TicketSettingsForm from './TicketSettingsForm';

import type { IAgentOption } from './types';
export interface ITicketDialogProps {
  ticketId: number;
  profiles: IAgentOption[];
}
const TicketDialog = ({ ticketId, profiles }: ITicketDialogProps) => {
  const { data, isLoading, error, refetch } = useTicketDetail(ticketId);
  const [editDirty, setEditDirty] = useState(false);
  const [tab, setTab] = useState('spec');

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

  return (
    <TmnFlex direction="column" gap={3} className="min-w-0">
      <TmnFlex direction="row" gap={2} align="center" wrap="wrap">
        <TmnText weight="bold">{data.jiraKey}</TmnText>
        <TmnChip color="gray">{trans(`ticket.status.${data.status}`)}</TmnChip>
        {data.label && (
          <TmnChip color={LABEL_COLORS[data.label]}>
            {trans(`ticket.label.${data.label}`)}
          </TmnChip>
        )}
        <TmnLink
          href={data.jiraUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm"
        >
          {trans('ticket.open_jira')}
          <ExternalLink size={14} aria-hidden />
        </TmnLink>
      </TmnFlex>
      <TmnText className="text-sm">{data.summary}</TmnText>
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
            profiles={profiles}
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
