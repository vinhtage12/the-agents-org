import { memo, useState } from 'react';
import { AlertCircle, Boxes } from 'lucide-react';

import {
  TmnBox,
  TmnButton,
  TmnFlex,
  TmnHoverCard,
  type TmnHoverCardRendererParams,
  TmnScrollArea,
  TmnText
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { SYSTEM_PROVIDERS } from './constants';
import DockerDetails from './DockerDetails';
import { useDocker, useUsage } from './hooks';
import UsageDetails, { type IUsageDetailsProps } from './UsageDetails';

const MachineStatus = () => {
  const docker = useDocker();
  const usage = useUsage();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TmnScrollArea scrollbars="horizontal">
        <TmnFlex row gap={2} className="min-w-0 flex-1" paddingY={2}>
          {SYSTEM_PROVIDERS.map(p => {
            const item = usage.data?.providers.find(i => i.provider === p.id);
            return (
              <TmnHoverCard
                key={p.id}
                renderer={UsageDetailsRenderer}
                params={{
                  item,
                  error: Boolean(usage.error)
                }}
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
                      : trans(
                          usage.isLoading
                            ? 'machine.loading'
                            : 'machine.no_data'
                        )}
                  </TmnText>
                  {usage.error && <AlertCircle size={12} />}
                </TmnButton>
              </TmnHoverCard>
            );
          })}
        </TmnFlex>
      </TmnScrollArea>
      <TmnHoverCard
        open={open}
        onOpenChange={setOpen}
        placement="bottom-end"
        renderer={() => (
          <TmnScrollArea className="max-h-[70vh]" scrollbars="both">
            <span>
              <DockerDetails data={docker.data} error={Boolean(docker.error)} />
            </span>
          </TmnScrollArea>
        )}
        params={undefined}
      >
        <TmnButton
          startIcon={Boxes}
          variant="outline"
          kind="default"
          className="shrink-0 rounded-full"
          onClick={() => setOpen(!open)}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          aria-expanded={open}
        >
          Docker (
          {docker.isLoading
            ? '…'
            : docker.data?.status === 'available'
              ? docker.data.containers.filter(c => c.state === 'running').length
              : trans('machine.unavailable')}
          ){docker.error && <AlertCircle size={12} />}
        </TmnButton>
      </TmnHoverCard>
    </>
  );
};
export default memo(MachineStatus);

const UsageDetailsRenderer = memo(
  ({ params }: TmnHoverCardRendererParams<IUsageDetailsProps>) => {
    const { error, item } = params || {};
    return (
      <TmnBox className="max-h-[70vh] w-72 max-w-[80vw] overflow-y-auto">
        <UsageDetails item={item} error={error} />
      </TmnBox>
    );
  }
);
