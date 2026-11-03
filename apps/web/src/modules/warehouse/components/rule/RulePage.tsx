import { memo } from 'react';

import { trans } from '#i18n';

import WarehouseListPage from '../warehouse/WarehouseListPage';
import RuleDialogRenderer from './RuleDialogRenderer';

import type { IRule } from '../../types';
import type { IWarehouseColumn } from '../warehouse/WarehouseTable';

const RulePage = () => {
  const columns: IWarehouseColumn<IRule>[] = [
    { key: 'name', title: trans('warehouse.rule.name'), render: r => r.name },
    { key: 'path', title: trans('warehouse.rule.path'), render: r => r.path },
    {
      key: 'description',
      title: trans('warehouse.description'),
      render: r => r.description
    }
  ];

  return (
    <WarehouseListPage<IRule>
      kind="rules"
      columns={columns}
      addLabel={trans('warehouse.rule.add')}
      nameOf={r => r.name}
      renderer={RuleDialogRenderer}
    />
  );
};
export default memo(RulePage);
