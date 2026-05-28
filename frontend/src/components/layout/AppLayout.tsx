import { ReactNode } from 'react';
import Navbar from './Navbar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-paper-shade dark:bg-gray-900 dark:text-gray-100 flex flex-col transition-colors duration-200" data-testid="app-layout">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:top-2 focus:left-2 focus:rounded"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">{children}</main>
      <footer className="bg-paper dark:bg-gray-800 border-t border-rule dark:border-gray-700 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-ink-faint dark:text-ink-faint">
            GrayFSM -- Finite State Machine Optimizer with Gray Code Encoding
          </p>
        </div>
      </footer>
    </div>
  );
}
