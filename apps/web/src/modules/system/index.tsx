import { useState } from 'react';
import {
  AlertCircle,
  Bot,
  Boxes,
  Clock,
  Code,
  Container,
  Cpu,
  HardDrive,
  Sparkles,
  Terminal
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useQueryEnhancer } from '@truyenmoinhu/query';
import {
  TmnBox,
  TmnButton,
  TmnCallout,
  TmnCard,
  TmnChip,
  TmnFlex,
  TmnHoverCard,
  TmnLoading,
  TmnScrollArea,
  TmnText
} from '@truyenmoinhu/uikit';

import MetricChart from '#components/MetricChart';
import { apiManagerInstance } from '#constants/query';
import { formatDate } from '#utils/date';

interface DockerContainer {
  id: string;
  name: string;
  state: string;
  health: string;
  cpu: string | null;
  memory: string | null;
  cpuPercent: number | null;
  memoryUsageBytes: number | null;
  memoryLimitBytes: number | null;
  memoryPercent: number | null;
}
interface Docker {
  status: string;
  sampledAt: string;
  containers: DockerContainer[];
}
interface ProviderUsage {
  provider: string;
  status: string;
  sampledAt: string | null;
  windows: { label: string; usedPercent: number; resetsAt: string | null }[];
}
const providers = [
  { id: 'codex', icon: Terminal },
  { id: 'claude', icon: Sparkles },
  { id: 'copilot', icon: Code },
  { id: 'antigravity', icon: Bot }
];
const useDocker = () =>
  useQueryEnhancer<Docker>({
    queryKey: ['docker'],
    refetchInterval: 10000,
    queryFn: async () => {
      const res = await apiManagerInstance.sendRequest<Docker>({
        url: 'system/docker',
        suppressNotifyOnError: true
      });
      if (!res?.success || !res.payload) throw new Error('Docker unavailable');
      return res.payload;
    }
  });
const useUsage = () =>
  useQueryEnhancer<{ providers: ProviderUsage[] }>({
    queryKey: ['agent-usage'],
    refetchInterval: 60000,
    queryFn: async () => {
      const res = await apiManagerInstance.sendRequest<{
        providers: ProviderUsage[];
      }>({ url: 'system/agent-usage', suppressNotifyOnError: true });
      if (!res?.success || !res.payload) throw new Error('Usage unavailable');
      return res.payload;
    }
  });
function UsageDetails({
  item,
  error = false
}: {
  item?: ProviderUsage;
  error?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TmnFlex direction="column" gap={3} className="w-full min-w-0">
      <TmnText className="text-xs text-muted-foreground">
        {t(`machine.${error ? 'refresh_failed' : (item?.status ?? 'loading')}`)}
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
            {t('machine.updated')}: {formatDate(item.sampledAt)}
          </TmnText>
        </TmnFlex>
      )}
      {item?.windows.length ? (
        item.windows.map(w => (
          <TmnBox key={w.label}>
            <MetricChart
              title={`${w.label} · ${w.usedPercent}%`}
              labels={[t('machine.used'), t('machine.remaining')]}
              values={[w.usedPercent, 100 - w.usedPercent]}
            />
            {w.resetsAt && (
              <TmnText as="p" className="mt-2 text-xs text-muted-foreground">
                {t('machine.resets')}: {formatDate(w.resetsAt)}
              </TmnText>
            )}
          </TmnBox>
        ))
      ) : (
        <TmnText as="p" className="text-sm text-muted-foreground">
          {t('machine.no_data')}
        </TmnText>
      )}
    </TmnFlex>
  );
}
function DockerDetails({
  data,
  error = false
}: {
  data?: Docker;
  error?: boolean;
}) {
  const { t } = useTranslation();
  const containers = data?.containers ?? [];
  return (
    <TmnFlex direction="column" gap={3} className="min-w-0">
      {error && (
        <TmnCallout color="red">{t('machine.refresh_failed')}</TmnCallout>
      )}
      {data?.sampledAt && (
        <TmnText as="p" className="text-xs text-muted-foreground">
          {t('machine.updated')}: {formatDate(data.sampledAt)}
        </TmnText>
      )}
      {data?.status !== 'available' ? (
        <TmnText>{t('machine.unavailable')}</TmnText>
      ) : containers.length === 0 ? (
        <TmnText>{t('machine.no_containers')}</TmnText>
      ) : (
        <>
          <TmnBox className="grid gap-4 sm:grid-cols-2">
            {containers.some(c => c.cpuPercent !== null) && (
              <MetricChart
                type="bar"
                title={t('machine.cpu_chart')}
                labels={containers.map(c => c.name)}
                values={containers.map(c => c.cpuPercent)}
              />
            )}
            {containers.some(c => c.memoryPercent !== null) && (
              <MetricChart
                type="bar"
                title={t('machine.memory_chart')}
                labels={containers.map(c => c.name)}
                values={containers.map(c => c.memoryPercent)}
              />
            )}
          </TmnBox>
          <TmnText as="p" className="text-xs text-muted-foreground">
            {t('machine.cpu_hint')}
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
}
export function MachineStatus() {
  const { t } = useTranslation();
  const docker = useDocker();
  const usage = useUsage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TmnFlex
        direction="row"
        gap={2}
        className="min-w-0 flex-1 overflow-x-auto py-1"
      >
        {providers.map(p => {
          const item = usage.data?.providers.find(i => i.provider === p.id);
          return (
            <TmnHoverCard
              key={p.id}
              content={() => (
                <TmnBox className="max-h-[70vh] w-72 max-w-[80vw] overflow-y-auto">
                  <UsageDetails item={item} error={Boolean(usage.error)} />
                </TmnBox>
              )}
            >
              <TmnButton
                startIcon={p.icon}
                kind="default"
                variant="outline"
                className="shrink-0 rounded-full text-xs capitalize"
              >
                <TmnText>{p.id}</TmnText>
                <TmnText>
                  {item?.windows.length
                    ? item.windows.map(w => `${w.usedPercent}%`).join(' / ')
                    : t(
                        usage.isLoading ? 'machine.loading' : 'machine.no_data'
                      )}
                </TmnText>
                {usage.error && <AlertCircle size={12} />}
              </TmnButton>
            </TmnHoverCard>
          );
        })}
      </TmnFlex>
      <TmnHoverCard
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        content={() => (
          <TmnScrollArea className="max-h-[70vh]" scrollbars="both">
            <span>
              <DockerDetails data={docker.data} error={Boolean(docker.error)} />
            </span>
          </TmnScrollArea>
        )}
      >
        <TmnButton
          startIcon={Boxes}
          variant="outline"
          kind="default"
          className="shrink-0 rounded-full"
          onClick={() => setOpen(!open)}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') setOpen(false);
          }}
          aria-expanded={open}
        >
          Docker (
          {docker.isLoading
            ? '…'
            : docker.data?.status === 'available'
              ? docker.data.containers.filter(c => c.state === 'running').length
              : t('machine.unavailable')}
          ){docker.error && <AlertCircle size={12} />}
        </TmnButton>
      </TmnHoverCard>
    </>
  );
}
export function SystemOverview() {
  const { t } = useTranslation();
  const usage = useUsage();
  const docker = useDocker();
  return (
    <TmnFlex direction="column" gap={4}>
      <h2>
        <TmnText size="5" weight="bold">
          {t('machine.overview')}
        </TmnText>
      </h2>
      <TmnBox className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {providers.map(p => (
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
}
