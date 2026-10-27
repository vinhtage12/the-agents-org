import { memo } from 'react';
import { useLocation } from '@tanstack/react-router';

import MenuLink from './MenuLink';

import type { IMenuItem } from 'ui/types';

interface MenuProps {
  items: IMenuItem[];
}

// Longest menu path that is the current path or one of its ancestors, so
// detail pages (/workspaces/1) keep their list item highlighted.
const findActivePath = (items: IMenuItem[], pathname: string) =>
  items
    .map(item => String(item.to))
    .filter(to => pathname === to || pathname.startsWith(`${to}/`))
    .reduce<string | undefined>(
      (best, to) => (!best || to.length > best.length ? to : best),
      undefined
    );

const Menu = ({ items }: MenuProps) => {
  const pathname = useLocation({ select: location => location.pathname });
  const activeTo = findActivePath(items, pathname);

  return (
    <div className="flex w-full flex-col gap-0.5">
      {items.map(item => (
        <MenuLink key={item.key} item={item} isActive={item.to === activeTo} />
      ))}
    </div>
  );
};

export default memo(Menu);
