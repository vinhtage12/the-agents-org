import { memo } from 'react';

import { trans } from '#i18n';

import AgentAvatar from './AgentAvatar';
import AgentDialogRenderer from './AgentDialogRenderer';
import WarehouseListPage from './WarehouseListPage';

import type { IAgentListItem } from './types';
import type { IWarehouseColumn } from './WarehouseTable';

const AgentPage = () => {
  const columns: IWarehouseColumn<IAgentListItem>[] = [
    {
      key: 'avatar',
      title: trans('warehouse.agent.avatar'),
      render: r => <AgentAvatar agent={r} />
    },
    { key: 'name', title: trans('warehouse.agent.name'), render: r => r.name },
    {
      key: 'role',
      title: trans('warehouse.agent.role'),
      render: r => trans(`warehouse.agent.roles.${r.role}`)
    },
    {
      key: 'provider',
      title: trans('warehouse.provider'),
      render: r => (r.model ? `${r.provider} (${r.model})` : r.provider)
    },
    {
      key: 'description',
      title: trans('warehouse.description'),
      render: r => r.description
    }
  ];

  return (
    <WarehouseListPage<IAgentListItem>
      kind="agents"
      columns={columns}
      addLabel={trans('warehouse.agent.add')}
      nameOf={r => r.name}
      renderer={AgentDialogRenderer}
    />
  );
};
export default memo(AgentPage);
