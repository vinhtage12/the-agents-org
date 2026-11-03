import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import AgentDialogRenderer from './AgentDialogRenderer';
import { AGENT_DIALOG } from './constants';
import RuleDialog from './RuleDialog';

import type { IRule } from './types';
import type { IWarehouseDialogParams } from './WarehouseListPage';

const openAgent = (agentId: number) => {
  UIUtils.popup.open({
    name: AGENT_DIALOG,
    size: 'xl',
    renderer: AgentDialogRenderer,
    params: { item: { id: agentId } }
  });
};

const RuleDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<IWarehouseDialogParams<IRule>>) => (
  <RuleDialog
    rule={params?.item}
    onDone={api.dismiss}
    onOpenAgent={openAgent}
  />
);
export default RuleDialogRenderer;
