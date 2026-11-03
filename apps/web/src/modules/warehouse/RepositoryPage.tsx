import { memo } from 'react';

import { trans } from '#i18n';
import { formatDate } from '#utils/date';

import RepositoryDialogRenderer from './RepositoryDialogRenderer';
import WarehouseListPage from './WarehouseListPage';

import type { IRepoListItem } from './types';
import type { IWarehouseColumn } from './WarehouseTable';

const RepositoryPage = () => {
  const columns: IWarehouseColumn<IRepoListItem>[] = [
    { key: 'name', title: trans('warehouse.repo.name'), render: r => r.name },
    { key: 'path', title: trans('warehouse.repo.path'), render: r => r.path },
    {
      key: 'environments',
      title: trans('warehouse.repo.environments'),
      render: r => r.environments.join(', ')
    },
    {
      key: 'description',
      title: trans('warehouse.description'),
      render: r => r.description
    },
    {
      key: 'updatedAt',
      title: trans('warehouse.updated_at'),
      render: r => formatDate(r.updatedAt)
    }
  ];

  return (
    <WarehouseListPage<IRepoListItem>
      kind="repositories"
      columns={columns}
      addLabel={trans('warehouse.repo.add')}
      nameOf={r => r.name}
      renderer={RepositoryDialogRenderer}
    />
  );
};
export default memo(RepositoryPage);
