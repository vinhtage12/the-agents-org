import { memo } from 'react';
import { Clock } from 'lucide-react';

import { TmnBox, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import MetricChart from '#components/MetricChart';
import { trans } from '#i18n';
import { formatDate } from '#utils/date';

import type { IProviderUsage } from './types';
export interface IUsageDetailsProps {
  item?: IProviderUsage;
  error?: boolean;
}
const UsageDetails = ({ item, error = false }: IUsageDetailsProps) => {
  return (
    <TmnFlex direction="column" gap={3} className="w-full min-w-0">
      <TmnText className="text-xs text-muted-foreground">
        {trans(
          `machine.${error ? 'refresh_failed' : (item?.status ?? 'loading')}`
        )}
      </TmnText>
      {item?.sampledAt && (
        <TmnFlex
          direction="row"
          gap={1}
          align="center"
          className="text-xs text-muted-foreground"
        >
          <Clock size={12} />
          <TmnText>
            {trans('machine.updated')}: {formatDate(item.sampledAt)}
          </TmnText>
        </TmnFlex>
      )}
      {item?.windows.length ? (
        item.windows.map(w => (
          <TmnBox key={w.label}>
            <MetricChart
              title={`${w.label} · ${w.usedPercent}%`}
              labels={[trans('machine.used'), trans('machine.remaining')]}
              values={[w.usedPercent, 100 - w.usedPercent]}
            />
            {w.resetsAt && (
              <TmnText as="p" className="mt-2 text-xs text-muted-foreground">
                {trans('machine.resets')}: {formatDate(w.resetsAt)}
              </TmnText>
            )}
          </TmnBox>
        ))
      ) : (
        <TmnText as="p" className="text-sm text-muted-foreground">
          {trans('machine.no_data')}
        </TmnText>
      )}
    </TmnFlex>
  );
};
export default memo(UsageDetails);
