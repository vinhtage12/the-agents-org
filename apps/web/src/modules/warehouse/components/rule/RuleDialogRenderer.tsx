import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import { AGENT_DIALOG } from '../../constants';
import AgentDialogRenderer from '../agent/AgentDialogRenderer';
import RuleDialog from './RuleDialog';

import type { IRule } from '../../types';
import type { IWarehouseDialogParams } from '../warehouse/WarehouseListPage';

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
