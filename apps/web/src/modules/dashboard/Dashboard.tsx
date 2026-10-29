import { memo } from 'react';

import { TmnCard, TmnFlex } from '@truyenmoinhu/uikit';

import { useHealth } from '#hooks/health';
import { trans } from '#i18n';
import { SystemOverview } from '#modules/system';
import { WorkspacePage } from '#modules/workspaces';

import StatusRow from './StatusRow';

const Dashboard = () => {
  const { data, isLoading } = useHealth();
  const daemon = isLoading
    ? trans('dashboard.checking')
    : trans(data ? 'dashboard.ok' : 'dashboard.unreachable');
  const db = isLoading || !data ? '—' : trans(`dashboard.${data.db}`);
  return (
    <>
      <WorkspacePage />
      <TmnCard header={{ title: trans('menu.dashboard') }} className="max-w-md">
        <TmnFlex direction="column" gap={2}>
          <StatusRow
            label={trans('dashboard.daemon')}
            value={daemon}
            ok={isLoading ? undefined : !!data}
          />
          <StatusRow
            label={trans('dashboard.database')}
            value={db}
            ok={isLoading || !data ? undefined : data.db === 'up'}
          />
        </TmnFlex>
      </TmnCard>
      <SystemOverview />
    </>
  );
};
export default memo(Dashboard);
