import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './ui/App';
import './styles.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // A waiting service worker takes over on the next launch, so play is never interrupted.
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
  void navigator.storage?.persist?.();
}
