declare module 'ui/types' {
  import type { ReactNode } from 'react';
  import type { LinkProps } from '@tanstack/react-router';
  import type { TmnIcon } from '@truyenmoinhu/uikit';
  export interface IMenuItem {
    key: string;
    titleKey: string;
    icon?: TmnIcon;
    to: LinkProps['to'];
    badge?: ReactNode;
  }
}
