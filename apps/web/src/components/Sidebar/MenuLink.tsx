import { memo } from 'react';
import { Link } from '@tanstack/react-router';

import { TmnButton, cn } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import type { IMenuItem } from 'ui/types';

interface MenuLinkProps {
  item: IMenuItem;
  isActive: boolean;
}
const MenuLink = ({ item, isActive }: MenuLinkProps) => (
  <div className="relative w-full">
    <TmnButton
      asChild
      variant={isActive ? 'soft' : 'transparent'}
      kind="default"
      startIcon={item.icon}
      title={trans(item.titleKey)}
      className={cn(
        'w-full! h-8! justify-start! gap-2! px-2! font-normal [&>svg]:size-4',
        isActive && 'font-medium! text-foreground!'
      )}
    >
      <Link to={item.to} aria-current={isActive ? 'page' : undefined} />
    </TmnButton>
    {item.badge && (
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
        {item.badge}
      </span>
    )}
  </div>
);
export default memo(MenuLink);
