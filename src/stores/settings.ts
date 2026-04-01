import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'gluhwein_settings'

interface AppSettings {
  // true: 厨房で受渡しまで完結 / false: 受渡し端末を別で使う
  kitchenHandover: boolean
}

const defaults: AppSettings = {
  kitchenHandover: true,
}

function load(): AppSettings {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try { return { ...defaults, ...JSON.parse(saved) } } catch { /* ignore */ }
  }
  return { ...defaults }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(load())

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  }

  function setKitchenHandover(value: boolean) {
    settings.value.kitchenHandover = value
    persist()
  }

  // 他タブからの変更を受信
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try { settings.value = { ...defaults, ...JSON.parse(e.newValue) } } catch { /* ignore */ }
    }
  })

  return {
    settings,
    setKitchenHandover,
  }
})
