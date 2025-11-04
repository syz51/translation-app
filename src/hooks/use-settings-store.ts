import { Store } from '@tauri-apps/plugin-store'
import { useEffect, useState } from 'react'

let storeInstance: Store | null = null

const STORE_FILE = 'settings.json'
const LAST_OUTPUT_PATH_KEY = 'lastOutputPath'

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await Store.load(STORE_FILE, {
      autoSave: true,
      defaults: {},
    })
  }
  return storeInstance
}

export function useSettingsStore() {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    getStore().then(() => setIsReady(true))
  }, [])

  const getLastOutputPath = async (): Promise<string | null> => {
    const store = await getStore()
    const path = await store.get<string>(LAST_OUTPUT_PATH_KEY)
    return path || null
  }

  const setLastOutputPath = async (path: string): Promise<void> => {
    const store = await getStore()
    await store.set(LAST_OUTPUT_PATH_KEY, path)
  }

  return {
    isReady,
    getLastOutputPath,
    setLastOutputPath,
  }
}
