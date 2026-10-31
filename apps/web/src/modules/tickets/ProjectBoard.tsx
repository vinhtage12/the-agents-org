import { memo } from 'react';

import {
  TmnButton,
  TmnCallout,
  TmnFlex,
  TmnLoading,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import BoardColumn from './BoardColumn';
import { TICKET_STATUSES } from './constants';
import { useProjectTickets } from './hooks';

export interface IProjectBoardProps {
  projectId: number;
}
const ProjectBoard = ({ projectId }: IProjectBoardProps) => {
  const { data, isLoading, error, refetch } = useProjectTickets(projectId);

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
    <TmnFlex direction="row" gap={3} className="min-w-0 overflow-x-auto pb-2">
      {TICKET_STATUSES.map(status => (
        <BoardColumn
          key={status}
          status={status}
          tickets={data.filter(t => t.status === status)}
        />
      ))}
    </TmnFlex>
  );
};
export default memo(ProjectBoard);
