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
);
export default memo(MenuLink);
