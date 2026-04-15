<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import { useOrderStore } from '@/stores/orders'
import { useProductStore } from '@/stores/products'
import { useSettingsStore } from '@/stores/settings'
import { usePrint } from '@/composables/usePrint'
import type { Product, OrderStatus, Order } from '@/types'
import { formatPrice, formatOrderNumber, formatTime } from '@/utils/format'
import AppHeader from '@/components/common/AppHeader.vue'
import ProductManager from '@/components/admin/ProductManager.vue'
import SalesSummary from '@/components/admin/SalesSummary.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ReceiptPreview from '@/components/common/ReceiptPreview.vue'

const router = useRouter()
const authStore = useAuthStore()
const demoStore = useDemoStore()
const orderStore = useOrderStore()
const productStore = useProductStore()

const settingsStore = useSettingsStore()
const print = usePrint()

const isDemo = computed(() => demoStore.isDemoMode)
const eventId = computed(() => authStore.user?.eventId || 'demo-event')

// ロゴ画像アップロード
function handleLogoUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  // 500KB制限（localStorageに収まるサイズ）
  if (file.size > 500 * 1024) {
    alert('画像サイズは500KB以下にしてください')
    input.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUri = reader.result as string
    settingsStore.setLogo(dataUri)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

// タブ
const activeTab = ref<'products' | 'orders' | 'sales' | 'quick' | 'settings' | 'report' | 'issue'>('quick')
const showShopInfoForm = ref(false)
const showLineConfig = ref(false)
const shopInfoSaved = ref(false)

// 会社情報の編集用コピー（保存ボタンを押すまでストアに反映しない）
const editShopInfo = ref({ ...settingsStore.settings.shopInfo })

function saveShopInfo() {
  settingsStore.updateShopInfo(editShopInfo.value)
  shopInfoSaved.value = true
  setTimeout(() => { shopInfoSaved.value = false }, 2000)
}

// フォームを開くときにストアから最新値をコピー
function toggleShopInfoForm() {
  if (!showShopInfoForm.value) {
    editShopInfo.value = { ...settingsStore.settings.shopInfo }
  }
  showShopInfoForm.value = !showShopInfoForm.value
}

// 自由入力領収書
const manualBuyerName = ref('')
const manualItems = ref([{ name: '', amount: 0 }])
const manualPayment = ref('cash')
const manualNote = ref('')
const manualTotal = computed(() => manualItems.value.reduce((s, i) => s + (i.amount || 0), 0))

function addManualItem() { manualItems.value.push({ name: '', amount: 0 }) }
function removeManualItem(idx: number) { manualItems.value.splice(idx, 1) }

function previewManual() {
  previewBuyerName.value = manualBuyerName.value
  openPreview('manual')
}

function printManual() {
  print.printManualReceipt({
    items: manualItems.value.filter(i => i.name && i.amount > 0),
    totalAmount: manualTotal.value,
    paymentMethod: manualPayment.value,
    note: manualNote.value || undefined,
  }, manualBuyerName.value || undefined)
}

// プレビュー表示
const showPreview = ref(false)
const previewMode = ref<'receipt' | 'formal' | 'manual'>('receipt')
const previewOrder = ref<Order | undefined>(undefined)
const previewBuyerName = ref('')

function openPreview(mode: 'receipt' | 'formal' | 'manual', order?: Order) {
  previewMode.value = mode
  previewOrder.value = order
  if (mode !== 'manual') previewBuyerName.value = ''
  showPreview.value = true
}

const products = computed(() =>
  isDemo.value ? demoStore.products : productStore.products
)

const allOrders = computed(() =>
  isDemo.value
    ? [...demoStore.orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    : [...orderStore.orders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
)

const todaySales = computed(() =>
  isDemo.value ? demoStore.todaySales : orderStore.todaySales
)
const todayOrderCount = computed(() =>
  isDemo.value ? demoStore.todayOrderCount : orderStore.todayOrderCount
)

// 商品管理
function handleToggleAvailability(productId: string) {
  if (isDemo.value) {
    demoStore.toggleAvailability(productId)
  } else {
    const p = products.value.find((p) => p.id === productId)
    if (p) {
      productStore.toggleAvailability(eventId.value, productId, !p.available)
    }
  }
}

function handleAddProduct(product: Omit<Product, 'id'>) {
  if (isDemo.value) {
    demoStore.addProduct(product)
  } else {
    productStore.addProduct(eventId.value, product)
  }
}

function handleUpdateProduct(productId: string, updates: Partial<Product>) {
  if (isDemo.value) {
    demoStore.updateProduct(productId, updates)
  } else {
    productStore.updateProduct(eventId.value, productId, updates)
  }
}

function handleDeleteProduct(productId: string) {
  if (isDemo.value) {
    demoStore.deleteProduct(productId)
  } else {
    productStore.deleteProduct(eventId.value, productId)
  }
}

// 注文キャンセル
const confirmCancel = ref(false)
const cancelOrderId = ref('')
const cancelOrderNumber = ref(0)

function showCancelConfirm(orderId: string, orderNumber: number) {
  cancelOrderId.value = orderId
  cancelOrderNumber.value = orderNumber
  confirmCancel.value = true
}

function handleCancel() {
  if (isDemo.value) {
    demoStore.updateOrderStatus(cancelOrderId.value, 'cancelled')
  } else {
    orderStore.updateStatus(eventId.value, cancelOrderId.value, 'cancelled')
  }
  confirmCancel.value = false
}

// 売上送信
import type { SalesReport } from '@/types'
import { reportService } from '@/services/reportService'

const reportNote = ref('')
const reportSent = ref(false)
const firestoreReports = ref<SalesReport[]>([])
let unsubReports: (() => void) | null = null

const sentReports = computed(() =>
  isDemo.value ? demoStore.reports : firestoreReports.value
)

function todayDateKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayReportAlreadySent = computed(() =>
  sentReports.value.some((r) => r.date === todayDateKey())
)

function buildReport(): Omit<SalesReport, 'id'> {
  const todayOrders = allOrders.value.filter((o) => {
    const today = new Date()
    return o.createdAt.getDate() === today.getDate()
      && o.createdAt.getMonth() === today.getMonth()
      && o.createdAt.getFullYear() === today.getFullYear()
  })
  const valid = todayOrders.filter((o) => o.status !== 'cancelled')
  const total = valid.reduce((s, o) => s + o.totalAmount, 0)

  const byPayment: Record<string, { count: number; total: number }> = {}
  for (const o of valid) {
    if (!byPayment[o.paymentMethod]) byPayment[o.paymentMethod] = { count: 0, total: 0 }
    byPayment[o.paymentMethod].count++
    byPayment[o.paymentMethod].total += o.totalAmount
  }

  const byProduct: Record<string, { name: string; count: number; total: number }> = {}
  for (const o of valid) {
    for (const item of o.items) {
      if (!byProduct[item.productId]) byProduct[item.productId] = { name: item.name, count: 0, total: 0 }
      byProduct[item.productId].count += item.quantity
      const optTotal = item.options.reduce((s, op) => s + op.price, 0)
      byProduct[item.productId].total += (item.price + optTotal) * item.quantity
    }
  }

  const byHour: Record<number, { count: number; total: number }> = {}
  for (const o of valid) {
    const h = o.createdAt.getHours()
    if (!byHour[h]) byHour[h] = { count: 0, total: 0 }
    byHour[h].count++
    byHour[h].total += o.totalAmount
  }

  return {
    boothId: eventId.value,
    boothName: '自社ブース',
    venueId: eventId.value,
    venueName: '朝食イベント',
    date: todayDateKey(),
    sentAt: new Date(),
    sentBy: authStore.user?.displayName || 'admin',
    totalSales: total,
    orderCount: valid.length,
    cancelledCount: todayOrders.filter((o) => o.status === 'cancelled').length,
    averagePerOrder: valid.length > 0 ? Math.round(total / valid.length) : 0,
    salesByPayment: byPayment,
    salesByProduct: Object.values(byProduct).sort((a, b) => b.total - a.total),
    salesByHour: Object.entries(byHour)
      .map(([h, d]) => ({ hour: Number(h), ...d }))
      .sort((a, b) => a.hour - b.hour),
    note: reportNote.value,
  }
}

async function handleSendReport() {
  const report = buildReport()
  if (isDemo.value) {
    demoStore.submitReport(report)
  } else {
    await reportService.saveReport(eventId.value, report)
  }
  reportSent.value = true
  reportNote.value = ''
  setTimeout(() => { reportSent.value = false }, 3000)
}

// 画面遷移ショートカット
function goTo(path: string) {
  router.push(path)
}

onMounted(() => {
  if (!isDemo.value) {
    productStore.startListening(eventId.value)
    orderStore.startListening(eventId.value)
    unsubReports = reportService.listenReports(eventId.value, (reports) => {
      firestoreReports.value = reports
    })
  }
})

onUnmounted(() => {
  productStore.stopListening()
  orderStore.stopListening()
  unsubReports?.()
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <AppHeader title="⚙️ 管理" />

    <!-- タブ -->
    <div class="bg-white border-b border-gray-200 px-3 py-2 flex gap-1.5 overflow-x-auto shrink-0">
      <button
        v-for="tab in [
          { key: 'quick', label: 'ダッシュボード' },
          { key: 'products', label: '商品' },
          { key: 'orders', label: '履歴' },
          { key: 'issue', label: '発行' },
          { key: 'sales', label: '売上' },
          { key: 'report', label: '送信' },
          { key: 'settings', label: '設定' },
        ]"
        :key="tab.key"
        :class="[
          'px-4 py-2 rounded-xl text-sm whitespace-nowrap font-bold select-none active:scale-95 transition-transform',
          activeTab === tab.key
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        ]"
        @click="activeTab = tab.key as typeof activeTab"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <!-- ダッシュボード -->
      <div v-if="activeTab === 'quick'" class="space-y-4">
        <!-- 売上サマリ -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div class="text-sm text-gray-500">本日売上</div>
            <div class="text-3xl font-black text-red-600">{{ formatPrice(todaySales) }}</div>
          </div>
          <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div class="text-sm text-gray-500">本日注文数</div>
            <div class="text-3xl font-black text-gray-800">{{ todayOrderCount }}件</div>
          </div>
        </div>

        <!-- クイックアクション -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-3">画面切替</h3>
          <div class="grid grid-cols-2 gap-3">
            <button
              class="btn-touch bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
              @click="goTo('/order')"
            >
              🏪 レジ画面
            </button>
            <button
              class="btn-touch bg-orange-600 hover:bg-orange-700 text-white rounded-xl"
              @click="goTo('/kitchen')"
            >
              🍳 厨房画面
            </button>
            <button
              class="btn-touch bg-green-600 hover:bg-green-700 text-white rounded-xl"
              @click="goTo('/handover')"
            >
              📦 受渡し画面
            </button>
            <button
              class="btn-touch bg-gray-600 hover:bg-gray-700 text-white rounded-xl"
              @click="activeTab = 'products'"
            >
              📋 商品管理
            </button>
          </div>
        </div>

        <!-- 売り切れ管理（クイック） -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-3">売り切れ切替</h3>
          <div class="space-y-2">
            <div
              v-for="product in products"
              :key="product.id"
              class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <span class="font-medium text-gray-800">{{ product.name }}</span>
              <button
                :class="[
                  'btn-touch px-4 rounded-xl text-sm min-h-[40px]',
                  product.available
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-red-500 text-white hover:bg-red-600',
                ]"
                @click="handleToggleAvailability(product.id)"
              >
                {{ product.available ? '販売中' : '売り切れ' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 商品管理 -->
      <ProductManager
        v-if="activeTab === 'products'"
        :products="products"
        @toggle-availability="handleToggleAvailability"
        @add-product="handleAddProduct"
        @update-product="handleUpdateProduct"
        @delete-product="handleDeleteProduct"
      />

      <!-- 注文履歴 -->
      <div v-if="activeTab === 'orders'" class="space-y-2">
        <h2 class="text-xl font-bold text-gray-800 mb-4">注文履歴</h2>
        <div v-if="allOrders.length === 0" class="text-center text-gray-400 py-8">
          注文はまだありません
        </div>
        <div
          v-for="order in allOrders"
          :key="order.id"
          class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
        >
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-3">
              <span class="text-2xl font-black text-gray-800 tabular-nums">
                #{{ formatOrderNumber(order.orderNumber) }}
              </span>
              <StatusBadge :status="order.status" />
            </div>
            <div class="text-right">
              <div class="font-bold text-red-600">{{ formatPrice(order.totalAmount) }}</div>
              <div class="text-xs text-gray-500">{{ formatTime(order.createdAt) }}</div>
            </div>
          </div>
          <div class="text-sm text-gray-600">
            {{ order.items.map((i) => `${i.name}×${i.quantity}`).join(', ') }}
          </div>
          <!-- 印刷・再発行ボタン -->
          <div class="mt-2 flex gap-2 flex-wrap">
            <button
              class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold px-3 py-1.5 rounded-lg active:scale-95"
              @click="openPreview('receipt', order)"
            >
              レシート
            </button>
            <button
              class="text-xs bg-green-100 hover:bg-green-200 text-green-700 font-bold px-3 py-1.5 rounded-lg active:scale-95"
              @click="openPreview('formal', order)"
            >
              領収書
            </button>
            <button
              v-if="!['served', 'cancelled'].includes(order.status)"
              class="text-xs text-red-500 font-medium hover:underline ml-auto"
              @click="showCancelConfirm(order.id, order.orderNumber)"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>

      <!-- 発行（自由入力領収書） -->
      <div v-if="activeTab === 'issue'" class="space-y-4">
        <h2 class="text-xl font-bold text-gray-800">領収書発行</h2>
        <p class="text-sm text-gray-500">注文に紐づかない領収書を自由に発行できます。過去注文の再発行は「履歴」タブから。</p>

        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3">
          <!-- 宛名 -->
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-1">宛名（任意）</label>
            <input v-model="manualBuyerName" type="text" placeholder="例: ○○株式会社"
              class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
          </div>

          <!-- 明細 -->
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-2">内訳</label>
            <div v-for="(item, idx) in manualItems" :key="idx" class="flex gap-2 mb-2">
              <input v-model="item.name" type="text" placeholder="品名"
                class="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
              <input v-model.number="item.amount" type="number" inputmode="numeric" placeholder="金額"
                class="w-28 px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none text-right" />
              <button v-if="manualItems.length > 1" class="text-red-400 text-xl px-2" @click="removeManualItem(idx)">×</button>
            </div>
            <button class="text-sm text-blue-600 font-bold" @click="addManualItem">+ 行を追加</button>
          </div>

          <!-- 支払方法 -->
          <div class="flex gap-2 items-center">
            <label class="text-xs font-bold text-gray-600 shrink-0">支払</label>
            <select v-model="manualPayment"
              class="px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none bg-white">
              <option value="cash">現金</option>
              <option value="cashless">キャッシュレス</option>
              <option value="other">その他</option>
            </select>
          </div>

          <!-- 但書 -->
          <div>
            <label class="block text-xs font-bold text-gray-600 mb-1">但書（任意）</label>
            <input v-model="manualNote" type="text" placeholder="例: お品代として"
              class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
          </div>

          <!-- 合計 -->
          <div class="bg-gray-50 rounded-xl p-4 text-center">
            <div class="text-sm text-gray-500">合計金額</div>
            <div class="text-3xl font-black text-red-600">{{ formatPrice(manualTotal) }}</div>
          </div>

          <!-- ボタン -->
          <div class="flex gap-2">
            <button
              :disabled="manualTotal <= 0"
              class="btn-touch flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl disabled:opacity-40"
              @click="previewManual"
            >
              プレビュー
            </button>
            <button
              :disabled="manualTotal <= 0"
              class="btn-touch flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40"
              @click="printManual"
            >
              印刷
            </button>
          </div>
        </div>

      </div>

      <!-- 売上集計 -->
      <div v-if="activeTab === 'sales'">
        <h2 class="text-xl font-bold text-gray-800 mb-4">売上集計</h2>
        <SalesSummary :orders="allOrders" />
      </div>

      <!-- 設定 -->
      <!-- 売上送信 -->
      <div v-if="activeTab === 'report'" class="space-y-4">
        <h2 class="text-xl font-bold text-gray-800">主催者へ売上送信</h2>

        <!-- 本日サマリプレビュー -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-3">本日の売上サマリ</h3>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="text-xs text-gray-500">売上合計</div>
              <div class="text-xl font-black text-red-600">{{ formatPrice(todaySales) }}</div>
            </div>
            <div class="bg-gray-50 rounded-lg p-3">
              <div class="text-xs text-gray-500">注文数</div>
              <div class="text-xl font-black text-gray-800">{{ todayOrderCount }}件</div>
            </div>
          </div>

          <!-- 備考 -->
          <div class="mb-4">
            <label class="block text-sm font-bold text-gray-600 mb-1">備考・連絡事項</label>
            <textarea
              v-model="reportNote"
              rows="3"
              placeholder="特記事項があれば記入（売り切れ状況、トラブル等）"
              class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-red-500 focus:outline-none resize-none"
            />
          </div>

          <!-- 送信ボタン -->
          <div v-if="todayReportAlreadySent" class="bg-yellow-50 border border-yellow-300 rounded-xl p-3 mb-3">
            <span class="text-yellow-700 text-sm font-medium">本日分は送信済みです。再送信も可能です。</span>
          </div>

          <button
            class="btn-touch w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-lg"
            :disabled="todayOrderCount === 0"
            @click="handleSendReport"
          >
            📤 主催者へ売上を送信
          </button>

          <div
            v-if="reportSent"
            class="mt-3 bg-green-50 border border-green-300 rounded-xl p-3 text-center"
          >
            <span class="text-green-700 font-bold">送信完了しました</span>
          </div>
        </div>

        <!-- 送信履歴 -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-3">送信履歴</h3>
          <div v-if="sentReports.length === 0" class="text-gray-400 text-center py-4">
            まだ送信履歴はありません
          </div>
          <div class="space-y-2">
            <div
              v-for="report in sentReports"
              :key="report.id"
              class="border border-gray-100 rounded-xl p-3"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="font-bold text-gray-800">{{ report.date }}</span>
                <span class="text-xs text-gray-500">
                  {{ formatTime(report.sentAt) }} 送信
                </span>
              </div>
              <div class="flex gap-4 text-sm">
                <span class="text-red-600 font-bold">{{ formatPrice(report.totalSales) }}</span>
                <span class="text-gray-600">{{ report.orderCount }}件</span>
                <span class="text-gray-600">客単価 {{ formatPrice(report.averagePerOrder) }}</span>
              </div>
              <div v-if="report.note" class="text-xs text-gray-500 mt-1">
                📝 {{ report.note }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 設定 -->
      <div v-if="activeTab === 'settings'" class="space-y-4">
        <h2 class="text-xl font-bold text-gray-800 mb-4">設定</h2>

        <!-- オペレーション構成 -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-4">オペレーション構成</h3>

          <div class="space-y-3">
            <button
              :class="[
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                settingsStore.settings.kitchenHandover
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
              @click="settingsStore.setKitchenHandover(true)"
            >
              <div class="font-bold text-gray-800 text-lg">🍳📦 厨房で受渡しまで行う</div>
              <div class="text-sm text-gray-500 mt-1">
                端末1台で調理→受渡しを完結。少人数オペレーション向け。
              </div>
              <div class="text-sm text-gray-500">
                厨房画面: 調理開始 → 受渡し済み
              </div>
            </button>

            <button
              :class="[
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                !settingsStore.settings.kitchenHandover
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
              @click="settingsStore.setKitchenHandover(false)"
            >
              <div class="font-bold text-gray-800 text-lg">🍳 + 📦 受渡し端末を別で使う</div>
              <div class="text-sm text-gray-500 mt-1">
                厨房と受渡しで端末を分ける構成。混雑時やスタッフが多い場合に。
              </div>
              <div class="text-sm text-gray-500">
                厨房画面: 調理開始 → 完成 / 受渡し画面: 完成 → 受渡し済み
              </div>
            </button>
          </div>

          <!-- 調理中ステータス -->
          <!-- 番号札モード -->
          <h3 class="font-bold text-gray-800 mt-5 mb-3">番号札</h3>
          <div class="space-y-3">
            <button
              :class="[
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                settingsStore.settings.orderNumberMode === 'auto'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
              @click="settingsStore.setOrderNumberMode('auto')"
            >
              <div class="font-bold text-gray-800">自動採番</div>
              <div class="text-sm text-gray-500 mt-1">1, 2, 3... と自動で番号が振られます</div>
            </button>
            <button
              :class="[
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                settingsStore.settings.orderNumberMode === 'select'
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
              @click="settingsStore.setOrderNumberMode('select')"
            >
              <div class="font-bold text-gray-800">手動選択</div>
              <div class="text-sm text-gray-500 mt-1">会計時に番号札を選択（物理番号札と連動）</div>
            </button>
            <div v-if="settingsStore.settings.orderNumberMode === 'select'" class="flex items-center gap-3 pl-2">
              <label class="text-sm font-bold text-gray-600 shrink-0">番号の数:</label>
              <select
                :value="settingsStore.settings.orderNumberMax"
                @change="settingsStore.setOrderNumberMax(parseInt(($event.target as HTMLSelectElement).value))"
                class="px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none bg-white"
              >
                <option v-for="n in [8, 10, 12, 16, 20, 24, 30, 50]" :key="n" :value="n">1〜{{ n }}</option>
              </select>
            </div>
          </div>

          <h3 class="font-bold text-gray-800 mt-5 mb-3">厨房フロー</h3>
          <div class="space-y-3">
            <button
              :class="[
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                !settingsStore.settings.skipCooking
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
              @click="settingsStore.setSkipCooking(false)"
            >
              <div class="font-bold text-gray-800">「調理中」あり（通常）</div>
              <div class="text-sm text-gray-500 mt-1">
                新着 → 調理開始 → 完成/受渡し
              </div>
            </button>
            <button
              :class="[
                'w-full p-4 rounded-xl border-2 text-left transition-colors',
                settingsStore.settings.skipCooking
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
              @click="settingsStore.setSkipCooking(true)"
            >
              <div class="font-bold text-gray-800">「調理中」スキップ</div>
              <div class="text-sm text-gray-500 mt-1">
                新着 → 即完成/受渡し（調理工程がない場合）
              </div>
            </button>
          </div>
        </div>

        <!-- 会社情報・インボイス設定 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            class="w-full px-5 py-4 flex items-center justify-between text-left"
            @click="toggleShopInfoForm"
          >
            <div>
              <h3 class="font-bold text-gray-800">会社・店舗情報</h3>
              <p v-if="settingsStore.settings.shopInfo.shopName" class="text-xs text-green-600 mt-0.5">
                保存済み: {{ settingsStore.settings.shopInfo.shopName }}
                {{ settingsStore.settings.shopInfo.invoiceNumber ? ' / ' + settingsStore.settings.shopInfo.invoiceNumber : '' }}
              </p>
              <p v-else class="text-xs text-gray-400 mt-0.5">未設定（タップして入力）</p>
            </div>
            <span class="text-gray-400 text-xl shrink-0 ml-2">{{ showShopInfoForm ? '▲' : '▼' }}</span>
          </button>

          <div v-if="showShopInfoForm" class="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
            <!-- ロゴ画像 -->
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">ロゴ画像</label>
              <div v-if="settingsStore.logoDataUri" class="mb-2 flex items-center gap-3">
                <div class="bg-gray-100 rounded-lg p-2 flex items-center justify-center" style="width:120px;height:50px">
                  <img :src="settingsStore.logoDataUri" alt="ロゴ" class="max-w-full max-h-full object-contain" />
                </div>
                <button class="text-sm text-red-500 font-bold hover:underline" @click="settingsStore.removeLogo()">削除</button>
              </div>
              <label class="btn-touch bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl px-4 cursor-pointer inline-flex text-sm">
                <span>{{ settingsStore.logoDataUri ? '変更' : '画像を選択' }}</span>
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="hidden" @change="handleLogoUpload" />
              </label>
              <p class="text-xs text-gray-400 mt-1">PNG/JPEG推奨。レシート上部に印字されます。</p>
            </div>

            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">店舗名 / 屋号 *</label>
              <input v-model="editShopInfo.shopName" type="text" placeholder="例: Glühwein Stand"
                class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">会社名（正式名称）</label>
              <input v-model="editShopInfo.companyName" type="text" placeholder="例: 株式会社○○"
                class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold text-gray-600 mb-1">郵便番号</label>
                <input v-model="editShopInfo.postalCode" type="text" placeholder="000-0000"
                  class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-600 mb-1">電話番号</label>
                <input v-model="editShopInfo.phone" type="tel" placeholder="000-0000-0000"
                  class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-1">住所</label>
              <input v-model="editShopInfo.address" type="text" placeholder="例: 東京都渋谷区..."
                class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
            </div>
            <div class="border-t border-gray-100 pt-3">
              <label class="block text-xs font-bold text-gray-600 mb-1">
                インボイス登録番号
                <span class="font-normal text-gray-400 ml-1">（適格請求書発行事業者）</span>
              </label>
              <input v-model="editShopInfo.invoiceNumber" type="text" placeholder="T1234567890123"
                class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none font-mono" />
              <p class="text-xs text-gray-400 mt-1">T + 13桁の数字（例: T1234567890123）</p>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-bold text-gray-600 mb-1">消費税率</label>
                <select v-model.number="editShopInfo.taxRate"
                  class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none bg-white">
                  <option :value="0.10">10%（標準税率）</option>
                  <option :value="0.08">8%（軽減税率）</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-600 mb-1">レシート末尾メッセージ</label>
                <input v-model="editShopInfo.footerText" type="text" placeholder="ありがとうございました"
                  class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
              </div>
            </div>

            <!-- 保存ボタン -->
            <div class="pt-3 border-t border-gray-100">
              <button
                class="btn-touch w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-lg"
                @click="saveShopInfo"
              >
                保存
              </button>
              <div v-if="shopInfoSaved" class="text-center text-green-600 font-bold text-sm mt-2">
                保存しました
              </div>
            </div>
          </div>
        </div>

        <!-- LINE連携設定 -->
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            class="w-full px-5 py-4 flex items-center justify-between text-left"
            @click="showLineConfig = !showLineConfig"
          >
            <div>
              <h3 class="font-bold text-gray-800">LINE連携</h3>
              <p class="text-xs mt-0.5" :class="settingsStore.settings.line.enabled ? 'text-green-600' : 'text-gray-400'">
                {{ settingsStore.settings.line.enabled ? '有効' : '未設定' }}
              </p>
            </div>
            <span class="text-gray-400 text-xl shrink-0 ml-2">{{ showLineConfig ? '▲' : '▼' }}</span>
          </button>
          <div v-if="showLineConfig" class="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
            <!-- 呼び出し通知モード -->
            <div>
              <label class="block text-xs font-bold text-gray-600 mb-2">呼び出し通知モード</label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  :class="[
                    'px-3 py-3 rounded-xl text-sm font-bold transition-colors border-2',
                    settingsStore.settings.line.notifyMode === 'bell'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  ]"
                  @click="settingsStore.updateLine({ notifyMode: 'bell', enabled: false })"
                >
                  🔔 ベルのみ
                </button>
                <button
                  :class="[
                    'px-3 py-3 rounded-xl text-sm font-bold transition-colors border-2',
                    settingsStore.settings.line.notifyMode === 'line'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  ]"
                  @click="settingsStore.updateLine({ notifyMode: 'line', enabled: true })"
                >
                  💬 LINEのみ
                </button>
                <button
                  :class="[
                    'px-3 py-3 rounded-xl text-sm font-bold transition-colors border-2',
                    settingsStore.settings.line.notifyMode === 'both'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                  ]"
                  @click="settingsStore.updateLine({ notifyMode: 'both', enabled: true })"
                >
                  🔔+💬 併用
                </button>
              </div>
              <p class="text-xs text-gray-400 mt-1">
                {{ settingsStore.settings.line.notifyMode === 'bell' ? 'スタッフがベルで手動呼び出し' : settingsStore.settings.line.notifyMode === 'line' ? 'LINEで自動通知' : 'ベル手動 + LINE自動通知' }}
              </p>
            </div>

            <!-- LINE設定（line or both の時のみ表示） -->
            <template v-if="settingsStore.settings.line.notifyMode !== 'bell'">
              <!-- アカウントモード -->
              <div>
                <label class="block text-xs font-bold text-gray-600 mb-2">LINEアカウント運用</label>
                <div class="grid grid-cols-2 gap-2">
                  <button
                    :class="[
                      'px-3 py-3 rounded-xl text-sm font-bold transition-colors border-2',
                      settingsStore.settings.line.lineAccountMode === 'single'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    ]"
                    @click="settingsStore.updateLine({ lineAccountMode: 'single' })"
                  >
                    1アカウント
                  </button>
                  <button
                    :class="[
                      'px-3 py-3 rounded-xl text-sm font-bold transition-colors border-2',
                      settingsStore.settings.line.lineAccountMode === 'multi'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    ]"
                    @click="settingsStore.updateLine({ lineAccountMode: 'multi' })"
                  >
                    店舗ごと
                  </button>
                </div>
                <p class="text-xs text-gray-400 mt-1">
                  {{ settingsStore.settings.line.lineAccountMode === 'single' ? '1つのLINE公式アカウントで全店舗運用' : '各店舗が自社のLINEアカウントを使用' }}
                </p>
              </div>

              <div>
                <label class="block text-xs font-bold text-gray-600 mb-1">チャネルアクセストークン</label>
                <input
                  :value="settingsStore.settings.line.channelAccessToken"
                  @change="settingsStore.updateLine({ channelAccessToken: ($event.target as HTMLInputElement).value })"
                  type="password"
                  placeholder="LINE Developers Console から取得"
                  class="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none font-mono text-xs"
                />
              </div>

              <div class="bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
                <p class="font-bold text-gray-600">セットアップ手順:</p>
                <p>1. LINE公式アカウントを開設</p>
                <p>2. LINE Developers Console でMessaging APIチャネルを作成</p>
                <p>3. チャネルアクセストークンを発行して上に貼り付け</p>
                <p>4. Firebase Cloud Functions をデプロイ（functions-template/参照）</p>
                <p>5. Webhook URLをLINE Developers Consoleに設定</p>
              </div>
            </template>
          </div>
        </div>

        <!-- プリンター設定 -->
        <div class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-3">プリンター (SII MP-B20)</h3>

          <!-- Step 1: アプリインストール -->
          <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <p class="text-sm font-bold text-yellow-800 mb-2">Step 1: アプリをインストール</p>
            <a
              href="https://apps.apple.com/app/id1502527506"
              target="_blank"
              rel="noopener"
              class="btn-touch bg-yellow-500 hover:bg-yellow-600 text-white rounded-xl px-5 inline-flex"
            >
              App Store で入手
            </a>
          </div>

          <!-- Step 2: プレビュー確認 -->
          <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
            <p class="text-sm font-bold text-green-800 mb-2">Step 2: レシートプレビュー</p>
            <button
              class="btn-touch bg-green-600 hover:bg-green-700 text-white rounded-xl px-5"
              @click="openPreview('receipt')"
            >
              プレビュー表示
            </button>
          </div>

          <!-- Step 3: 印刷テスト -->
          <div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p class="text-sm font-bold text-blue-800 mb-2">Step 3: 印刷テスト</p>
            <p class="text-xs text-blue-600 mb-2">
              Bluetooth ペアリング済み＆URL Print Agent でプリンター設定済みの状態で押してください
            </p>
            <button
              class="btn-touch bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5"
              @click="print.testPrint()"
            >
              テスト印刷
            </button>
          </div>

          <!-- ステータス表示 -->
          <div
            v-if="print.statusMessage.value"
            class="mb-3 p-3 rounded-lg text-sm"
            :class="print.statusMessage.value.includes('エラー') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'"
          >
            {{ print.statusMessage.value }}
            <button class="ml-2 underline text-xs" @click="print.clearStatus()">閉じる</button>
          </div>

          <!-- URLスキーム直接テスト -->
          <div class="text-xs text-gray-400 space-y-1 mt-3 border-t border-gray-100 pt-3">
            <p class="font-bold text-gray-500">トラブル時:</p>
            <p>
              <a href="siiprintagent://" class="text-blue-500 underline">
                URL Print Agent を直接開く
              </a>
              （アプリが開けばインストール済み）
            </p>
            <p>Safari のアドレスバーに直接 URL を入力して開いている場合は正常動作します。PWA（ホーム画面追加）からは制限がある場合があります。</p>
          </div>
        </div>

        <!-- デモデータリセット -->
        <div v-if="isDemo" class="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 class="font-bold text-gray-800 mb-3">デモデータ</h3>
          <button
            class="btn-touch bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl px-5"
            @click="demoStore.resetAll()"
          >
            全データリセット
          </button>
          <p class="text-xs text-gray-400 mt-2">注文・商品を初期状態に戻します</p>
        </div>
      </div>
    </div>

    <!-- キャンセル確認ダイアログ -->
    <ConfirmDialog
      :show="confirmCancel"
      title="注文キャンセル"
      :message="`#${formatOrderNumber(cancelOrderNumber)} をキャンセルしますか？この操作は元に戻せません。`"
      confirm-label="キャンセルする"
      confirm-class="bg-red-600 hover:bg-red-700"
      @confirm="handleCancel"
      @cancel="confirmCancel = false"
    />

    <!-- レシート/領収書プレビュー -->
    <Teleport to="body">
      <ReceiptPreview
        v-if="showPreview"
        :mode="previewMode"
        :order="previewOrder"
        :shop-info="settingsStore.settings.shopInfo"
        :printer="settingsStore.settings.printer"
        :logo-data-uri="settingsStore.logoDataUri"
        :buyer-name="previewBuyerName"
        :manual-items="manualItems"
        :manual-total="manualTotal"
        :manual-payment="manualPayment"
        :manual-note="manualNote"
        @close="showPreview = false"
      />
    </Teleport>
  </div>
</template>
