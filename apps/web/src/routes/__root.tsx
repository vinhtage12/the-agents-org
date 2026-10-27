import { TanStackDevtools } from '@tanstack/react-devtools';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { useTranslation } from 'react-i18next';

import '../styles.css';

import { QueryProvider } from '@truyenmoinhu/query';
import { Appearance, UIThemeProvider } from '@truyenmoinhu/uikit';

import NotFound from '#components/NotFound';
import { apiManagerInstance, queryClient } from '#constants/query';

const RootComponent = () => {
  // `trans` is not reactive: remount the pages on language change so every label re-reads.
  const { i18n } = useTranslation();

  return (
    <QueryProvider apiManagerInstance={apiManagerInstance} client={queryClient}>
      <UIThemeProvider
        defaultAppearance={Appearance.LIGHT}
        panelBackground="solid"
        hasBackground
      >
        <Outlet key={i18n.resolvedLanguage} />
      </UIThemeProvider>

      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
          { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> }
        ]}
      />
    </QueryProvider>
  );
};

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound
});
