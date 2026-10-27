import { memo } from 'react';

import { TmnFlex, TmnScrollArea, TmnText } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import Menu from './Menu';

import type { IMenuItem } from 'ui/types';

interface ISidebarProps {
  items: IMenuItem[];
}

const Sidebar = ({ items }: ISidebarProps) => (
  <TmnFlex
    asChild
    direction="column"
    gap="none"
    flexGrow={0}
    className="h-full w-60 shrink-0 border-r border-border bg-card"
  >
    <aside>
      <TmnFlex
        direction="row"
        align="center"
        flexGrow={0}
        paddingX={4}
        className="h-12 shrink-0 border-b border-border"
      >
        <TmnText weight="bold">{trans('app_name')}</TmnText>
      </TmnFlex>

      <TmnScrollArea scrollbars="vertical" className="flex-1">
        <nav aria-label={trans('menu.navigation')} className="p-2">
          <Menu items={items} />
        </nav>
      </TmnScrollArea>
    </aside>
  </TmnFlex>
);

export default memo(Sidebar);
