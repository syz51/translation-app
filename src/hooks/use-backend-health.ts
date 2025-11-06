import { useEffect, useState } from 'react'
import { env } from '@/env'

export interface BackendHealthStatus {
  isChecking: boolean
  isHealthy: boolean
  error: string | null
  lastChecked: Date | null
}

export function useBackendHealth(shouldCheck: boolean = true) {
  const [status, setStatus] = useState<BackendHealthStatus>({
    isChecking: true,
    isHealthy: false,
    error: null,
    lastChecked: null,
  })

  useEffect(() => {
    if (!shouldCheck) {
      // Reset to default when check is disabled
      setStatus({
        isChecking: false,
        isHealthy: false,
        error: null,
        lastChecked: null,
      })
      return
    }

    let mounted = true
    const controller = new AbortController()

    const checkHealth = async () => {
      try {
        setStatus((prev) => ({ ...prev, isChecking: true, error: null }))

        const response = await fetch(
          `${env.VITE_TRANSCRIPTION_SERVER_URL}/health`,
          {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
          },
        )

        if (!mounted) return

        if (response.ok) {
          setStatus({
            isChecking: false,
            isHealthy: true,
            error: null,
            lastChecked: new Date(),
          })
        } else {
          setStatus({
            isChecking: false,
            isHealthy: false,
            error: `Backend returned ${response.status}`,
            lastChecked: new Date(),
          })
        }
      } catch (error) {
        if (!mounted) return

        setStatus({
          isChecking: false,
          isHealthy: false,
          error: error instanceof Error ? error.message : 'Connection failed',
          lastChecked: new Date(),
        })
      }
    }

    // Initial check
    checkHealth()

    // Only recheck if still checking after initial attempt (don't poll continuously)
    // This reduces unnecessary network calls on every page

    return () => {
      mounted = false
      controller.abort()
    }
  }, [shouldCheck])

  return status
}
