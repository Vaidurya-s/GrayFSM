import { Suspense, useEffect } from 'react'
import { lazyWithRetry } from './utils/lazyWithRetry'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from './config/routes'
import AppLayout from './components/layout/AppLayout'
import HomePage from './pages/HomePage'
import EditorPage from './pages/EditorPage'
import ExportPage from './pages/ExportPage'
import GalleryPage from './pages/GalleryPage'
import ExamplesPage from './pages/ExamplesPage'
import AboutPage from './pages/AboutPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import NotFoundPage from './pages/NotFoundPage'
import { useAuthStore } from './store/authStore'
import { ToastProvider, Spinner } from './components/ui'
import { ThemeProvider } from './components/providers/ThemeProvider'
import { CommandPalette, useCommandPalette } from './components/ui'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import type { ReactNode } from 'react'

// OptimizationPage transitively imports recharts (~180 KB gz). Lazy-load it
// so those chunks are only fetched when the user navigates to /optimize.
const OptimizationPage = lazyWithRetry(() => import('./pages/OptimizationPage'))

function AppWithCommandPalette({ children }: { children: ReactNode }) {
  const { isOpen, close } = useCommandPalette()
  return (
    <>
      {children}
      <CommandPalette isOpen={isOpen} onClose={close} />
    </>
  )
}

function App() {
  // Restore an existing session (validate persisted token) on load.
  const initAuth = useAuthStore((s) => s.init)
  useEffect(() => {
    initAuth()
  }, [initAuth])

  return (
    <ThemeProvider>
    <ToastProvider>
    <BrowserRouter>
      <AppWithCommandPalette>
      <ErrorBoundary>
      <Routes>
        {/* Home */}
        <Route
          path={ROUTES.HOME}
          element={
            <AppLayout>
              <HomePage />
            </AppLayout>
          }
        />

        {/* Auth */}
        <Route
          path={ROUTES.LOGIN}
          element={
            <AppLayout>
              <LoginPage />
            </AppLayout>
          }
        />
        <Route
          path={ROUTES.REGISTER}
          element={
            <AppLayout>
              <RegisterPage />
            </AppLayout>
          }
        />

        {/* Editor routes */}
        <Route
          path={ROUTES.EDITOR}
          element={
            <AppLayout>
              <EditorPage />
            </AppLayout>
          }
        />
        <Route
          path={ROUTES.EDITOR_NEW}
          element={
            <AppLayout>
              <EditorPage />
            </AppLayout>
          }
        />
        <Route
          path={ROUTES.EDITOR_EDIT}
          element={
            <AppLayout>
              <EditorPage />
            </AppLayout>
          }
        />

        {/* Optimization — lazy-loaded to keep recharts out of the initial bundle */}
        <Route
          path={ROUTES.OPTIMIZE}
          element={
            <AppLayout>
              <Suspense fallback={<Spinner size="lg" />}>
                <OptimizationPage />
              </Suspense>
            </AppLayout>
          }
        />

        {/* Export - uses same :id pattern */}
        <Route
          path="/export/:id"
          element={
            <AppLayout>
              <ExportPage />
            </AppLayout>
          }
        />

        {/* Gallery */}
        <Route
          path={ROUTES.GALLERY}
          element={
            <AppLayout>
              <GalleryPage />
            </AppLayout>
          }
        />

        {/* Examples */}
        <Route
          path={ROUTES.EXAMPLES}
          element={
            <AppLayout>
              <ExamplesPage />
            </AppLayout>
          }
        />
        <Route
          path={ROUTES.EXAMPLE_DETAIL}
          element={
            <AppLayout>
              <ExamplesPage />
            </AppLayout>
          }
        />

        {/* Learn (redirect to examples for now) */}
        <Route
          path={ROUTES.LEARN}
          element={<Navigate to={ROUTES.EXAMPLES} replace />}
        />
        <Route
          path={ROUTES.LEARN_TUTORIAL}
          element={<Navigate to={ROUTES.EXAMPLES} replace />}
        />

        {/* About */}
        <Route
          path={ROUTES.ABOUT}
          element={
            <AppLayout>
              <AboutPage />
            </AppLayout>
          }
        />

        {/* Docs (redirect to about for now) */}
        <Route
          path={ROUTES.DOCS}
          element={<Navigate to={ROUTES.ABOUT} replace />}
        />

        {/* 404 */}
        <Route
          path="/404"
          element={
            <AppLayout>
              <NotFoundPage />
            </AppLayout>
          }
        />
        <Route path={ROUTES.NOT_FOUND} element={<Navigate to="/404" replace />} />
      </Routes>
      </ErrorBoundary>
      </AppWithCommandPalette>
    </BrowserRouter>
    </ToastProvider>
    </ThemeProvider>
  )
}

export default App
