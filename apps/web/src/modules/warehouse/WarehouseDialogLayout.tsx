import { type ReactNode, memo } from 'react';

import { TmnFlex } from '@truyenmoinhu/uikit';

import { useWarehouseUsage } from './hooks';
import UsagePanel from './UsagePanel';

import type { WarehouseKind } from './types';

export interface IWarehouseDialogLayoutProps {
  kind: WarehouseKind;
  id?: number;
  onOpenAgent?: (agentId: number) => void;
  children: ReactNode;
}
// Form on the left, "in use by" on the right once the item exists.
const WarehouseDialogLayout = ({
  kind,
  id,
  onOpenAgent,
  children
}: IWarehouseDialogLayoutProps) => {
  const usage = useWarehouseUsage(kind, id);

  return (
    <TmnFlex direction="row" gap={4} wrap="wrap" className="min-w-0">
      <TmnFlex direction="column" gap={3} className="min-w-0 flex-[2] basis-80">
        {children}
      </TmnFlex>
      {id !== undefined && usage.data && (
        <TmnFlex className="min-w-0 flex-1 basis-56">
          <UsagePanel usage={usage.data} onOpenAgent={onOpenAgent} />
        </TmnFlex>
      )}
    </TmnFlex>
  );
};
export default memo(WarehouseDialogLayout);
