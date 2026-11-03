import { type TmnPopupItemRendererParams, UIUtils } from '@truyenmoinhu/uikit';

import { AGENT_DIALOG } from '../../constants';
import AgentDialogRenderer from '../agent/AgentDialogRenderer';
import SkillDialog from './SkillDialog';

import type { ISkill } from '../../types';
import type { IWarehouseDialogParams } from '../warehouse/WarehouseListPage';

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
