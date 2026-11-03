import { memo } from 'react';
import { ExternalLink } from 'lucide-react';

import { TmnImage, TmnLink, type TmnLinkProps, cn } from '@truyenmoinhu/uikit';

export interface ITicketLinkProps extends Omit<TmnLinkProps, 'target' | 'rel'> {
  jiraKey: string;
  iconSize?: number;
}
const TicketLink = ({
  jiraKey,
  iconSize = 16,
  className,
  ...props
}: ITicketLinkProps) => {
  return (
    <TmnLink
      target="_blank"
      rel="noreferrer"
      className={cn('flex flex-row items-center gap-1', className)}
      {...props}
    >
      {jiraKey} <TmnImage.Icon icon={ExternalLink} size={iconSize} />
    </TmnLink>
  );
};

export default memo(TicketLink);
