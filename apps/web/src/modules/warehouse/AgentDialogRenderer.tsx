import AgentDialog from './AgentDialog';

import type { TmnPopupItemRendererParams } from '@truyenmoinhu/uikit';
import type { IWarehouseDialogParams } from './WarehouseListPage';

// Popup renderer shared by the agent list and the "in use by" links.
const AgentDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<IWarehouseDialogParams<{ id: number }>>) => (
  <AgentDialog agentId={params?.item?.id} onDone={api.dismiss} />
);
export default AgentDialogRenderer;
