import { CalendarClock, LayoutDashboard, Warehouse } from 'lucide-react';

import { ROUTE_PATHS } from './routes';

import type { IMenuItem } from 'ui/types';
export const MENU_ITEMS: IMenuItem[] = [
  {
    key: 'dashboard',
    titleKey: 'menu.dashboard',
    icon: LayoutDashboard,
    to: ROUTE_PATHS.dashboard
  },
  {
    key: 'warehouse',
    titleKey: 'menu.warehouse',
    icon: Warehouse,
    to: ROUTE_PATHS.warehouse
  },
  {
    key: 'scheduled-tasks',
    titleKey: 'menu.scheduled_tasks',
    icon: CalendarClock,
    to: ROUTE_PATHS.scheduledTasks
  }
];
