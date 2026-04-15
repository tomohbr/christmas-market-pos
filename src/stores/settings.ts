import { defineStore } from 'pinia'
import { ref } from 'vue'

const STORAGE_KEY = 'gluhwein_settings'
const LOGO_STORAGE_KEY = 'gluhwein_logo'

/** 会社・店舗情報（レシート/領収書に印字） */
export interface ShopInfo {
  shopName: string
  companyName: string
  postalCode: string
  address: string
  phone: string
  invoiceNumber: string
  taxRate: number
  footerText: string
}

/** プリンター設定 */
export interface PrinterProfile {
  paperWidthMm: number   // 用紙幅 mm (58 or 80)
  dotsPerLine: number    // 1行のドット数 (384 or 576)
  charsPerLine: number   // 半角文字数目安
  model: string          // 機種名
}

/** 番号札モード */
export type OrderNumberMode = 'auto' | 'select'

/** 呼び出し通知モード */
export type NotifyMode = 'bell' | 'line' | 'both'

/** LINE連携設定 */
export interface LineConfig {
  enabled: boolean
  channelAccessToken: string  // LINE Messaging API チャネルアクセストークン
  notifyMode: NotifyMode      // 呼び出し通知モード
  lineAccountMode: 'single' | 'multi'  // シングル/マルチテナント
}

interface AppSettings {
  kitchenHandover: boolean
  skipCooking: boolean
  orderNumberMode: OrderNumberMode
  orderNumberMax: number
  shopInfo: ShopInfo
  printer: PrinterProfile
  line: LineConfig
}

const defaultShopInfo: ShopInfo = {
  shopName: '',
  companyName: '',
  postalCode: '',
  address: '',
  phone: '',
  invoiceNumber: '',
  taxRate: 0.10,
  footerText: 'ありがとうございました',
}

const defaultPrinter: PrinterProfile = {
  paperWidthMm: 58,
  dotsPerLine: 384,
  charsPerLine: 32,
  model: 'SII MP-B20',
}

const defaultLine: LineConfig = {
  enabled: false,
  channelAccessToken: '',
  notifyMode: 'bell',
  lineAccountMode: 'single',
}

const defaults: AppSettings = {
  kitchenHandover: true,
  skipCooking: false,
  orderNumberMode: 'auto' as OrderNumberMode,
  orderNumberMax: 16,
  shopInfo: { ...defaultShopInfo },
  printer: { ...defaultPrinter },
  line: { ...defaultLine },
}

function load(): AppSettings {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      return {
        ...defaults,
        ...parsed,
        shopInfo: { ...defaultShopInfo, ...parsed.shopInfo },
        printer: { ...defaultPrinter, ...parsed.printer },
        line: { ...defaultLine, ...parsed.line },
      }
    } catch { /* ignore */ }
  }
  return { ...defaults, shopInfo: { ...defaultShopInfo }, printer: { ...defaultPrinter }, line: { ...defaultLine } }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>(load())
  // ロゴは別キーで保存（大きいデータなので設定JSONと分離）
  const logoDataUri = ref(localStorage.getItem(LOGO_STORAGE_KEY) || '')

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  }

  function setKitchenHandover(value: boolean) {
    settings.value.kitchenHandover = value
    persist()
  }

  function setOrderNumberMode(mode: OrderNumberMode) {
    settings.value.orderNumberMode = mode
    persist()
  }

  function setOrderNumberMax(max: number) {
    settings.value.orderNumberMax = Math.max(2, Math.min(99, max))
    persist()
  }

  function setSkipCooking(value: boolean) {
    settings.value.skipCooking = value
    persist()
  }

  function updateShopInfo(updates: Partial<ShopInfo>) {
    settings.value.shopInfo = { ...settings.value.shopInfo, ...updates }
    persist()
  }

  function updateLine(updates: Partial<LineConfig>) {
    settings.value.line = { ...settings.value.line, ...updates }
    persist()
  }

  function updatePrinter(updates: Partial<PrinterProfile>) {
    settings.value.printer = { ...settings.value.printer, ...updates }
    persist()
  }

  /** ロゴ画像を設定（data URI形式） */
  function setLogo(dataUri: string) {
    logoDataUri.value = dataUri
    localStorage.setItem(LOGO_STORAGE_KEY, dataUri)
  }

  /** ロゴ画像を削除 */
  function removeLogo() {
    logoDataUri.value = ''
    localStorage.removeItem(LOGO_STORAGE_KEY)
  }

  // 他タブからの変更を受信
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue)
        settings.value = {
          ...defaults,
          ...parsed,
          shopInfo: { ...defaultShopInfo, ...parsed.shopInfo },
          printer: { ...defaultPrinter, ...parsed.printer },
          line: { ...defaultLine, ...parsed.line },
        }
      } catch { /* ignore */ }
    }
    if (e.key === LOGO_STORAGE_KEY) {
      logoDataUri.value = e.newValue || ''
    }
  })

  return {
    settings,
    logoDataUri,
    setKitchenHandover,
    setSkipCooking,
    setOrderNumberMode,
    setOrderNumberMax,
    updateLine,
    updateShopInfo,
    updatePrinter,
    setLogo,
    removeLogo,
  }
})
