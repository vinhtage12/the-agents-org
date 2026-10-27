import { createFileRoute } from '@tanstack/react-router';

import { TmnCard, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { useHealth } from '#hooks/health';
import { trans } from '#i18n';

export const Route = createFileRoute('/_app/')({ component: Dashboard });

const StatusRow = ({
  label,
  value,
  ok
}: {
  label: string;
  value: string;
  ok?: boolean;
}) => (
  <TmnFlex direction="row" justify="between" align="center">
    <TmnText muted>{label}</TmnText>
    <TmnText
      weight="medium"
      color={ok === undefined ? undefined : ok ? 'green' : 'red'}
    >
      {value}
    </TmnText>
  </TmnFlex>
);

function Dashboard() {
  const { data, isLoading } = useHealth();

  const daemon = isLoading
    ? trans('dashboard.checking')
    : trans(data ? 'dashboard.ok' : 'dashboard.unreachable');
  const db = isLoading || !data ? '—' : trans(`dashboard.${data.db}`);

  return (
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
  );
}
