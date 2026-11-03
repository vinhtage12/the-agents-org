import { memo } from 'react';

import { TmnButton, TmnCallout, TmnLoading } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useWarehouseDetail } from '../../hooks';
import WarehouseDialogLayout from '../warehouse/WarehouseDialogLayout';
import AgentForm from './AgentForm';

import type { IAgentDetail } from '../../types';

export interface IAgentDialogProps {
  agentId?: number;
  onDone: () => void;
}
// Loads the agent first: the form needs its values at mount.
const AgentDialog = ({ agentId, onDone }: IAgentDialogProps) => {
  const { data, isLoading, isError, refetch } =
    useWarehouseDetail<IAgentDetail>('agents', agentId);

  if (agentId !== undefined && isLoading) {
    return <TmnLoading />;
  }
  if (agentId !== undefined && (isError || !data)) {
    return (
      <TmnCallout role="alert" color="red">
        {trans('warehouse.error')}
        <TmnButton onClick={() => refetch()}>
          {trans('warehouse.retry')}
        </TmnButton>
      </TmnCallout>
    );
  }

  return (
    <WarehouseDialogLayout kind="agents" id={agentId}>
      <AgentForm agent={data} onDone={onDone} />
    </WarehouseDialogLayout>
  );
};
export default memo(AgentDialog);
