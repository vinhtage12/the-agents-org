import { memo } from 'react';

import { TmnFlex, TmnSeparator } from '@truyenmoinhu/uikit';

import LanguageSwitch from './LanguageSwitch';
import ThemeToggle from './ThemeToggle';
import ToggleSidebar from './ToggleSidebar';

import type { PropsWithChildren } from 'react';
export interface IHeaderProps extends PropsWithChildren {}
const Header = ({ children }: IHeaderProps) => (
  <TmnFlex
    asChild
    direction="row"
    align="center"
    gap={2}
    flexGrow={0}
    paddingX={3}
    className="h-12 shrink-0 border-b border-border bg-card"
  >
    <header>
      <ToggleSidebar />
      <TmnSeparator orientation="vertical" className="h-4 shrink-0" />
      {children}
      <LanguageSwitch />
      <ThemeToggle />
    </header>
  </TmnFlex>
);
export default memo(Header);
