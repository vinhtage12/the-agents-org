import { memo } from 'react';
import { Boxes } from 'lucide-react';

import {
  TmnBox,
  TmnCard,
  TmnFlex,
  TmnLoading,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { SYSTEM_PROVIDERS } from './constants';
import DockerDetails from './DockerDetails';
import { useDocker, useUsage } from './hooks';
import UsageDetails from './UsageDetails';

const SystemOverview = () => {
  const usage = useUsage();
  const docker = useDocker();
  return (
    <TmnFlex direction="column" gap={4}>
      <h2>
        <TmnText size="5" weight="bold">
          {trans('machine.overview')}
        </TmnText>
      </h2>
      <TmnBox className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SYSTEM_PROVIDERS.map(p => (
          <TmnCard
            key={p.id}
            header={{
              title: (
                <TmnFlex direction="row" align="center" gap={2}>
                  <p.icon size={18} />
                  <TmnText className="capitalize">{p.id}</TmnText>
                </TmnFlex>
              )
            }}
          >
            {usage.isLoading ? (
              <TmnLoading />
            ) : (
              <UsageDetails
                item={usage.data?.providers.find(i => i.provider === p.id)}
                error={Boolean(usage.error)}
              />
            )}
          </TmnCard>
        ))}
      </TmnBox>
      <TmnCard
        header={{
          title: (
            <TmnFlex direction="row" gap={2} align="center">
              <Boxes size={18} />
              <TmnText>Docker</TmnText>
            </TmnFlex>
          )
        }}
      >
        {docker.isLoading ? (
          <TmnLoading />
        ) : (
          <DockerDetails data={docker.data} error={Boolean(docker.error)} />
        )}
      </TmnCard>
    </TmnFlex>
  );
};
export default memo(SystemOverview);
