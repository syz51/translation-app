import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ExtractionProvider } from '@/context/extraction-context'
import { useExtractionEvents } from '@/hooks/use-extraction-events'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponentContent() {
  // Set up event listeners for all routes
  useExtractionEvents()

  return (
    <>
      <Outlet />
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
