import { memo } from 'react';

import { TmnAvatar, getInitials } from '@truyenmoinhu/uikit';

import { AVATAR_SIZE } from './constants';
import { agentAvatarUrl } from './utils';

export interface IAgentAvatarProps {
  agent: { id: number; name: string } | null;
  size?: keyof typeof AVATAR_SIZE;
}
const AgentAvatar = ({ agent, size = 'md' }: IAgentAvatarProps) => {
  if (!agent) {
    return null;
  }

  return (
    <TmnAvatar
      src={agentAvatarUrl(agent.id)}
      fallback={getInitials(agent.name)}
      size={AVATAR_SIZE[size]}
      title={agent.name}
    />
  );
};
export default memo(AgentAvatar);
