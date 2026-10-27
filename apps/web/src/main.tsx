import { RouterProvider } from '@tanstack/react-router';
import ReactDOM from 'react-dom/client';

import { i18nReady } from '#i18n';

import { getRouter } from './router';

const router = getRouter();

const rootElement = document.getElementById('app');

if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  // Wait for the persisted locale to load so the first paint is not in the fallback language.
  i18nReady.then(() => root.render(<RouterProvider router={router} />));
}
