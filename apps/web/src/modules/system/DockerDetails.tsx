import { memo } from 'react';
import { Container, Cpu, HardDrive } from 'lucide-react';

import {
  TmnBox,
  TmnCallout,
  TmnChip,
  TmnFlex,
  TmnText
} from '@truyenmoinhu/uikit';

import MetricChart from '#components/MetricChart';
import { trans } from '#i18n';
import { formatDate } from '#utils/date';

import type { IDocker } from './types';
export interface IDockerDetailsProps {
  data?: IDocker;
  error?: boolean;
}
const DockerDetails = ({ data, error = false }: IDockerDetailsProps) => {
  const containers = data?.containers ?? [];
  return (
    <TmnFlex direction="column" gap={3} className="min-w-0">
      {error && (
        <TmnCallout color="red">{trans('machine.refresh_failed')}</TmnCallout>
      )}
      {data?.sampledAt && (
        <TmnText as="p" className="text-xs text-muted-foreground">
          {trans('machine.updated')}: {formatDate(data.sampledAt)}
        </TmnText>
      )}
      {data?.status !== 'available' ? (
        <TmnText>{trans('machine.unavailable')}</TmnText>
      ) : containers.length === 0 ? (
        <TmnText>{trans('machine.no_containers')}</TmnText>
      ) : (
        <>
          <TmnBox className="grid gap-4 sm:grid-cols-2">
            {containers.some(c => c.cpuPercent !== null) && (
              <MetricChart
                type="bar"
                title={trans('machine.cpu_chart')}
                labels={containers.map(c => c.name)}
                values={containers.map(c => c.cpuPercent)}
              />
            )}
            {containers.some(c => c.memoryPercent !== null) && (
              <MetricChart
                type="bar"
                title={trans('machine.memory_chart')}
                labels={containers.map(c => c.name)}
                values={containers.map(c => c.memoryPercent)}
              />
            )}
          </TmnBox>
          <TmnText as="p" className="text-xs text-muted-foreground">
            {trans('machine.cpu_hint')}
          </TmnText>
          {containers.map(c => (
            <TmnBox key={c.id} className="border-t border-border pt-3">
              <TmnFlex direction="row" align="center" gap={2} wrap="wrap">
                <Container size={16} />
                <TmnText weight="medium" size="2">
                  {c.name}
                </TmnText>
                <TmnChip color={c.state === 'running' ? 'green' : 'gray'}>
                  {c.state}
                </TmnChip>
              </TmnFlex>
              <TmnText as="p" className="mt-1 text-xs text-muted-foreground">
                {c.health}
              </TmnText>
              <TmnFlex
                direction="row"
                gap={3}
                className="mt-2 text-xs"
                wrap="wrap"
              >
                <TmnFlex direction="row" gap={1} align="center">
                  <Cpu size={14} />
                  <TmnText>CPU {c.cpu ?? '—'}</TmnText>
                </TmnFlex>
                <TmnFlex direction="row" gap={1} align="center">
                  <HardDrive size={14} />
                  <TmnText>RAM {c.memory ?? '—'}</TmnText>
                </TmnFlex>
              </TmnFlex>
            </TmnBox>
          ))}
        </>
      )}
    </TmnFlex>
  );
};
export default memo(DockerDetails);
