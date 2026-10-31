import { type ReactNode, memo } from 'react';
import { Link } from '@tanstack/react-router';

import { TmnButton, TmnLink } from '@truyenmoinhu/uikit';

import { useSidebar } from '#hooks/sidebar';

import { getWorkspaceRoute } from './utils';
export interface IWorkspaceLinkProps {
  path: string;
  children: ReactNode;
  className?: string;
  label?: string;
  button?: boolean;
  icon?: boolean;
}
const WorkspaceLink = ({
  path,
  children,
  className,
  label,
  button = false,
  icon = false
}: IWorkspaceLinkProps) => {
  const { close } = useSidebar();
  const link = (
    <Link
      {...getWorkspaceRoute(path)}
      aria-label={label}
      onClick={() => {
        if (window.matchMedia('(max-width: 767px)').matches) {
          close();
        }
      }}
    >
      {children}
    </Link>
  );
  if (button || icon) {
    return (
      <TmnButton
        asChild
        kind={icon ? 'default' : 'primary'}
        variant={icon ? 'transparent' : 'solid'}
        className={
          icon ? `size-7! shrink-0 p-1! ${className ?? ''}` : className
        }
      >
        {link}
      </TmnButton>
    );
  }

  return (
    <TmnLink asChild className={className}>
      {link}
    </TmnLink>
  );
};
export default memo(WorkspaceLink);
