import { LayoutDashboard } from 'lucide-react';

import { ROUTE_PATHS } from './routes';

import type { IMenuItem } from 'ui/types';

export const MENU_ITEMS: IMenuItem[] = [
  {
    key: 'dashboard',
    titleKey: 'menu.dashboard',
    icon: LayoutDashboard,
    to: ROUTE_PATHS.dashboard
  }
];
