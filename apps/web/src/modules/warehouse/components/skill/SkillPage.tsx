import { memo } from 'react';

import { trans } from '#i18n';

import WarehouseListPage from '../warehouse/WarehouseListPage';
import SkillDialogRenderer from './SkillDialogRenderer';

import type { ISkill } from '../../types';
import type { IWarehouseColumn } from '../warehouse/WarehouseTable';

const SkillPage = () => {
  const columns: IWarehouseColumn<ISkill>[] = [
    { key: 'name', title: trans('warehouse.skill.name'), render: r => r.name },
    {
      key: 'provider',
      title: trans('warehouse.provider'),
      render: r => r.provider
    },
    {
      key: 'command',
      title: trans('warehouse.skill.command'),
      render: r => r.command
    },
    {
      key: 'path',
      title: trans('warehouse.skill.path'),
      render: r => r.path || trans('warehouse.skill.no_path')
    }
  ];

  return (
    <WarehouseListPage<ISkill>
      kind="skills"
      columns={columns}
      addLabel={trans('warehouse.skill.add')}
      nameOf={r => r.name}
      renderer={SkillDialogRenderer}
    />
  );
};
export default memo(SkillPage);
