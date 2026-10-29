import { type ReactNode, memo } from 'react';
import { X } from 'lucide-react';

import {
  TmnButton,
  TmnFlex,
  TmnScrollArea,
  TmnText
} from '@truyenmoinhu/uikit';

import { useSidebar } from '#hooks/sidebar';
import { trans } from '#i18n';

import Menu from './Menu';

import type { IMenuItem } from 'ui/types';

interface ISidebarProps {
  items: IMenuItem[];
  children?: ReactNode;
}

const Sidebar = ({ items, children }: ISidebarProps) => {
  const { close } = useSidebar();
  return (
    <TmnFlex
      asChild
      direction="column"
      gap="none"
      flexGrow={0}
      className="fixed inset-y-0 left-0 z-50 h-full w-60 md:static shrink-0 border-r border-border bg-card"
    >
      <aside>
        <TmnFlex
          direction="row"
          align="center"
          flexGrow={0}
          paddingX={4}
          className="h-12 shrink-0 border-b border-border"
        >
          <TmnText weight="bold" className="flex-1">
            {trans('app_name')}
          </TmnText>
          <TmnButton
            className="md:hidden"
            variant="transparent"
            kind="default"
            startIcon={X}
            aria-label={trans('common.toggle_sidebar')}
            onClick={close}
          />
        </TmnFlex>

        <TmnScrollArea scrollbars="vertical" className="flex-1">
          <nav aria-label={trans('menu.navigation')} className="w-60 p-2">
            <Menu items={items} />
            {children}
          </nav>
        </TmnScrollArea>
      </aside>
    </TmnFlex>
  );
};

export default memo(Sidebar);
