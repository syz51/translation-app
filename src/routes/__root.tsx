import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ExtractionProvider } from '@/context/extraction-context'
import { useExtractionEvents } from '@/hooks/use-extraction-events'

export const Route = createRootRoute({
  component: RootComponent,
})

// Check if running in Tauri (desktop app)
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function RootComponentContent() {
  // Set up event listeners for all routes
  useExtractionEvents()

  return (
    <>
      <Outlet />
      {!isTauri && (
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      )}
    </>
  )
}

function RootComponent() {
  return (
    <ExtractionProvider>
      <RootComponentContent />
    </ExtractionProvider>
  )
}
