import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import AgentDialogRenderer from './AgentDialogRenderer';
import { AGENT_DIALOG } from './constants';
import SkillDialog from './SkillDialog';

import type { ISkill } from './types';
import type { IWarehouseDialogParams } from './WarehouseListPage';

const openAgent = (agentId: number) => {
  UIUtils.popup.open({
    name: AGENT_DIALOG,
    size: 'xl',
    renderer: AgentDialogRenderer,
    params: { item: { id: agentId } }
  });
};

const SkillDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<IWarehouseDialogParams<ISkill>>) => (
  <SkillDialog
    skill={params?.item}
    onDone={api.dismiss}
    onOpenAgent={openAgent}
  />
);
export default SkillDialogRenderer;
