import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { NavigationProvider } from '@/state/NavigationProvider';
import { PreferencesProvider } from '@/state/PreferencesProvider';
import { ToastProvider } from '@/state/ToastProvider';
import '@/styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    {/* The outermost boundary is the last line of defence against a blank screen. */}
    <ErrorBoundary label="The archive failed to start">
      <PreferencesProvider>
        <ToastProvider>
          <NavigationProvider>
            <App />
          </NavigationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  </StrictMode>,
);
