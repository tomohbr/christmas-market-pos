import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Product, Order, OrderStatus, PaymentMethod, OrderType, OrderItem, SalesReport, Venue, Booth, RateOverride } from '@/types'
import { demoProducts } from '@/services/demoData'
import { demoVenues, demoBooths, generateDemoReports } from '@/services/demoOrganizerData'

const STORAGE_KEY_ORDERS = 'gluhwein_demo_orders'
const STORAGE_KEY_PRODUCTS = 'gluhwein_demo_products'
const STORAGE_KEY_COUNTER = 'gluhwein_demo_counter'
const STORAGE_KEY_REPORTS = 'gluhwein_demo_reports'

// localStorage との日付変換ヘルパー
function serializeOrders(orders: Order[]): string {
  return JSON.stringify(orders)
}

function deserializeOrders(json: string): Order[] {
  try {
    const raw = JSON.parse(json) as Order[]
    return raw.map((o) => ({
      ...o,
      createdAt: new Date(o.createdAt),
      updatedAt: new Date(o.updatedAt),
      servedAt: o.servedAt ? new Date(o.servedAt) : null,
    }))
  } catch {
    return []
  }
}

function loadOrders(): Order[] {
  const saved = localStorage.getItem(STORAGE_KEY_ORDERS)
  return saved ? deserializeOrders(saved) : []
}

function loadProducts(): Product[] {
  const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS)
  if (saved) {
    try { return JSON.parse(saved) } catch { /* fall through */ }
  }
  return [...demoProducts]
}

function loadCounter(): number {
  const saved = localStorage.getItem(STORAGE_KEY_COUNTER)
  return saved ? parseInt(saved, 10) || 0 : 0
}

function loadReports(): SalesReport[] {
  const saved = localStorage.getItem(STORAGE_KEY_REPORTS)
  if (saved) {
    try {
      const raw = JSON.parse(saved) as SalesReport[]
      return raw.map((r) => ({ ...r, sentAt: new Date(r.sentAt) }))
    } catch { /* ignore */ }
  }
  return []
}

export const useDemoStore = defineStore('demo', () => {
  const isDemoMode = ref(false)
  const venues = ref<Venue[]>([...demoVenues])
  const booths = ref<Booth[]>([...demoBooths])
  const rateOverrides = ref<RateOverride[]>([])
  const products = ref<Product[]>(loadProducts())
  const orders = ref<Order[]>(loadOrders())
  const reports = ref<SalesReport[]>(loadReports())
  let orderCounter = loadCounter()

  // localStorageへ書き込み（変更のたびに）
  function persist() {
    localStorage.setItem(STORAGE_KEY_ORDERS, serializeOrders(orders.value))
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products.value))
    localStorage.setItem(STORAGE_KEY_COUNTER, String(orderCounter))
  }

  function persistReports() {
    localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(reports.value))
  }

  // 他タブからの変更をリアルタイム受信
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY_ORDERS && e.newValue) {
      orders.value = deserializeOrders(e.newValue)
    }
    if (e.key === STORAGE_KEY_PRODUCTS && e.newValue) {
      try { products.value = JSON.parse(e.newValue) } catch { /* ignore */ }
    }
    if (e.key === STORAGE_KEY_COUNTER && e.newValue) {
      orderCounter = parseInt(e.newValue, 10) || 0
    }
    if (e.key === STORAGE_KEY_REPORTS && e.newValue) {
      try {
        const raw = JSON.parse(e.newValue) as SalesReport[]
        reports.value = raw.map((r) => ({ ...r, sentAt: new Date(r.sentAt) }))
      } catch { /* ignore */ }
    }
  })

  // デモモード有効化（既存データがあればリセットしない）
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function disableDemoMode() {
    isDemoMode.value = false
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  function enableDemoMode() {
    isDemoMode.value = true
    if (products.value.length === 0) {
      products.value = [...demoProducts]
      persist()
    }
    // 主催者用デモレポートが空なら自動生成
    if (reports.value.length === 0) {
      reports.value = generateDemoReports()
      persistReports()
    }
    // タブ間同期: storageイベントは別タブでしか発火しないので、
    // 同一ブラウザ内での確実な同期のためポーリングも併用（1秒間隔）
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        const savedOrders = localStorage.getItem(STORAGE_KEY_ORDERS)
        if (savedOrders && savedOrders !== serializeOrders(orders.value)) {
          orders.value = deserializeOrders(savedOrders)
        }
        const savedProducts = localStorage.getItem(STORAGE_KEY_PRODUCTS)
        if (savedProducts && savedProducts !== JSON.stringify(products.value)) {
          try { products.value = JSON.parse(savedProducts) } catch { /* ignore */ }
        }
        const savedCounter = localStorage.getItem(STORAGE_KEY_COUNTER)
        if (savedCounter) {
          const c = parseInt(savedCounter, 10) || 0
          if (c > orderCounter) orderCounter = c
        }
      }, 1000)
    }
  }

  // 全データリセット（管理画面から明示的に実行する用）
  function resetAll() {
    products.value = [...demoProducts]
    orders.value = []
    reports.value = []
    orderCounter = 0
    persist()
    persistReports()
  }

  const availableProducts = computed(() => products.value.filter((p) => p.available))

  const categories = computed(() => {
    const cats = new Set(products.value.map((p) => p.category))
    return Array.from(cats).sort()
  })

  function getByCategory(category: string) {
    return availableProducts.value
      .filter((p) => p.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function toggleAvailability(productId: string) {
    const p = products.value.find((p) => p.id === productId)
    if (p) {
      p.available = !p.available
      persist()
    }
  }

  function createOrder(
    items: OrderItem[],
    totalAmount: number,
    paymentMethod: PaymentMethod,
    orderType: OrderType,
    createdBy: string,
    selectedNumber?: number,
  ): number {
    const num = selectedNumber ?? ++orderCounter
    if (!selectedNumber) orderCounter = num
    const now = new Date()
    orders.value.push({
      id: `demo-${num}-${Date.now()}`,
      orderNumber: num,
      status: 'paid',
      items,
      totalAmount,
      paymentMethod,
      orderType,
      createdAt: now,
      updatedAt: now,
      servedAt: null,
      createdBy,
      eventId: 'demo-event',
    })

    // 在庫減算
    for (const item of items) {
      const product = products.value.find((p) => p.id === item.productId)
      if (product && product.stock !== null) {
        product.stock = Math.max(0, product.stock - item.quantity)
        if (product.stock <= 0) product.available = false
      }
    }

    persist()
    return num
  }

  function updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = orders.value.find((o) => o.id === orderId)
    if (order) {
      order.status = status
      order.updatedAt = new Date()
      if (status === 'served') order.servedAt = new Date()
      persist()
    }
  }

  function addProduct(product: Omit<Product, 'id'>) {
    const id = `demo-product-${Date.now()}`
    products.value.push({ ...product, id })
    persist()
  }

  function updateProduct(productId: string, updates: Partial<Product>) {
    const idx = products.value.findIndex((p) => p.id === productId)
    if (idx !== -1) {
      products.value[idx] = { ...products.value[idx], ...updates }
      persist()
    }
  }

  function deleteProduct(productId: string) {
    products.value = products.value.filter((p) => p.id !== productId)
    persist()
  }

  const activeOrders = computed(() =>
    orders.value
      .filter((o) => !['served', 'cancelled'].includes(o.status))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  )

  const kitchenOrders = computed(() =>
    orders.value
      .filter((o) => ['paid', 'cooking'].includes(o.status))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  )

  const callingOrders = computed(() =>
    orders.value
      .filter((o) => o.status === 'calling')
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
  )

  const todaySales = computed(() =>
    orders.value
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0)
  )

  const todayOrderCount = computed(() =>
    orders.value.filter((o) => o.status !== 'cancelled').length
  )

  // 売上レポート送信
  function submitReport(report: Omit<SalesReport, 'id'>) {
    const id = `report-${Date.now()}`
    reports.value.unshift({ ...report, id })
    persistReports()
  }

  // === 会場 CRUD ===
  function addVenue(venue: Omit<Venue, 'id'>) {
    const id = `v-${Date.now()}`
    venues.value.push({ ...venue, id })
  }

  function updateVenue(venueId: string, updates: Partial<Venue>) {
    const idx = venues.value.findIndex((v) => v.id === venueId)
    if (idx !== -1) venues.value[idx] = { ...venues.value[idx], ...updates }
  }

  function deleteVenue(venueId: string) {
    venues.value = venues.value.filter((v) => v.id !== venueId)
    booths.value = booths.value.filter((b) => b.venueId !== venueId)
  }

  // === ブース（出展者） CRUD ===
  function addBooth(booth: Omit<Booth, 'id'>) {
    const id = `b-${Date.now()}`
    booths.value.push({ ...booth, id })
  }

  function updateBooth(boothId: string, updates: Partial<Booth>) {
    const idx = booths.value.findIndex((b) => b.id === boothId)
    if (idx !== -1) booths.value[idx] = { ...booths.value[idx], ...updates }
  }

  function deleteBooth(boothId: string) {
    booths.value = booths.value.filter((b) => b.id !== boothId)
  }

  // === 料金オーバーライド CRUD ===
  function addRateOverride(override: Omit<RateOverride, 'id'>) {
    const id = `override-${Date.now()}`
    rateOverrides.value.push({ ...override, id })
  }

  function updateRateOverride(overrideId: string, updates: Partial<RateOverride>) {
    const idx = rateOverrides.value.findIndex((o) => o.id === overrideId)
    if (idx !== -1) rateOverrides.value[idx] = { ...rateOverrides.value[idx], ...updates }
  }

  function deleteRateOverride(overrideId: string) {
    rateOverrides.value = rateOverrides.value.filter((o) => o.id !== overrideId)
  }

  return {
    isDemoMode,
    venues,
    booths,
    products,
    orders,
    reports,
    availableProducts,
    categories,
    activeOrders,
    kitchenOrders,
    callingOrders,
    todaySales,
    todayOrderCount,
    enableDemoMode,
    disableDemoMode,
    resetAll,
    getByCategory,
    toggleAvailability,
    createOrder,
    updateOrderStatus,
    addProduct,
    updateProduct,
    deleteProduct,
    submitReport,
    addVenue,
    updateVenue,
    deleteVenue,
    addBooth,
    updateBooth,
    deleteBooth,
    rateOverrides,
    addRateOverride,
    updateRateOverride,
    deleteRateOverride,
  }
})
