import { memo } from 'react';

import {
  TmnButton,
  TmnCallout,
  TmnCard,
  TmnFlex,
  TmnLoading,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useAttentionRuns, useScheduledTasks } from '../hooks';
import AttentionPanel from './AttentionPanel';
import { openRunHistoryDialog } from './RunHistoryDialogRenderer';
import { openScheduledTaskDialog } from './ScheduledTaskDialogRenderer';
import ScheduledTaskTable from './ScheduledTaskTable';

const ScheduledTasksPage = () => {
  const { data, isLoading, isError, refetch } = useScheduledTasks();
  const { data: attention } = useAttentionRuns();

  if (isLoading) {
    return <TmnLoading />;
  }
  if (isError || !data) {
    return (
      <TmnCallout role="alert" color="red">
        {trans('scheduled.error')}
        <TmnButton onClick={() => refetch()}>
          {trans('scheduled.retry')}
        </TmnButton>
      </TmnCallout>
    );
  }

  return (
    <TmnFlex direction="column" gap={3}>
      <TmnText weight="bold" className="text-lg">
        {trans('scheduled.title')}
      </TmnText>
      <AttentionPanel items={attention ?? []} />
      <TmnCard>
        <ScheduledTaskTable
          tasks={data}
          onCreate={() => openScheduledTaskDialog()}
          onEdit={openScheduledTaskDialog}
          onHistory={openRunHistoryDialog}
        />
      </TmnCard>
    </TmnFlex>
  );
};
export default memo(ScheduledTasksPage);
