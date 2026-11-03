import { memo } from 'react';
import { Link, Outlet, useLocation } from '@tanstack/react-router';

import { TmnFlex, TmnHeading, TmnTabNav } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { WAREHOUSE_TABS } from '../../constants';

const WarehouseLayout = () => {
  const pathname = useLocation({ select: l => l.pathname });

  return (
    <TmnFlex direction="column" gap={4}>
      <TmnHeading as="h1" size="6" weight="bold">
        {trans('warehouse.title')}
      </TmnHeading>
      <TmnTabNav
        tabs={WAREHOUSE_TABS.map(tab => ({
          label: trans(`warehouse.tab.${tab.key}`),
          active: pathname.startsWith(tab.to),
          link: <Link to={tab.to} />
        }))}
      />
      <Outlet />
    </TmnFlex>
  );
};
export default memo(WarehouseLayout);
