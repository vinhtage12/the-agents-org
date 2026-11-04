import { Activity, useMemo } from 'react';
import { Outlet } from '@tanstack/react-router';

import { TmnFlex, TmnScrollArea } from '@truyenmoinhu/uikit';

import Header from '#components/Header';
import Sidebar from '#components/Sidebar';
import { MENU_ITEMS } from '#constants/menu';
import { useSidebar } from '#hooks/sidebar';
import { trans } from '#i18n';
import { AttentionBadge } from '#modules/scheduled-tasks';
import { MachineStatus } from '#modules/system';
import { WorkspaceTree } from '#modules/workspaces';

const Layout = () => {
  const { isOpen, close } = useSidebar();
  // Memoized so Sidebar's memoized Menu keeps a stable items reference.
  const items = useMemo(
    () =>
      MENU_ITEMS.map(item =>
        item.key === 'scheduled-tasks'
          ? { ...item, badge: <AttentionBadge /> }
          : item
      ),
    []
  );
  return (
    <TmnFlex
      direction="row"
      width="100%"
      gap="none"
      className="h-dvh overflow-hidden bg-background text-foreground"
    >
      <button
        type="button"
        aria-label={trans('common.toggle_sidebar')}
        onClick={close}
        className={
          isOpen ? 'fixed inset-0 z-40 bg-black/30 md:hidden' : 'hidden'
        }
      />
      <Activity name="root-sidebar" mode={isOpen ? 'visible' : 'hidden'}>
        <Sidebar items={items}>
          <WorkspaceTree />
        </Sidebar>
      </Activity>

      <TmnFlex
        direction="column"
        className={`min-w-0 flex-1 max-w-screen ${isOpen ? 'md:max-w-[calc(100vw-var(--spacing)*60)]' : ''}`}
      >
        <Header>
          <MachineStatus />
        </Header>

        {/* Radix viewport content grows to fit wide children; cap it so nested scroll areas scroll instead */}
        <TmnScrollArea
          scrollbars="vertical"
          className="flex-1 [&>[data-radix-scroll-area-viewport]>div]:max-w-full"
        >
          <TmnFlex asChild direction="column" padding={3} className="flex-1">
            <main>
              <Outlet />
            </main>
          </TmnFlex>
        </TmnScrollArea>
      </TmnFlex>
    </TmnFlex>
  );
};
export default Layout;
