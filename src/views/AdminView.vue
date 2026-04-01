<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import { useOrderStore } from '@/stores/orders'
import { useProductStore } from '@/stores/products'
import { useSettingsStore } from '@/stores/settings'
import type { Product, OrderStatus } from '@/types'
import { formatPrice, formatOrderNumber, formatTime } from '@/utils/format'
import AppHeader from '@/components/common/AppHeader.vue'
import ProductManager from '@/components/admin/ProductManager.vue'
import SalesSummary from '@/components/admin/SalesSummary.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const demoStore = useDemoStore()
const orderStore = useOrderStore()
const productStore = useProductStore()

const settingsStore = useSettingsStore()

const isDemo = computed(() => demoStore.isDemoMode)
const eventId = computed(() => authStore.user?.eventId || 'demo-event')

// タブ
const activeTab = ref<'products' | 'orders' | 'sales' | 'quick' | 'settings' | 'report'>('quick')

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
    // productService.addProduct(eventId.value, product)
  }
}

function handleUpdateProduct(productId: string, updates: Partial<Product>) {
  if (isDemo.value) {
    demoStore.updateProduct(productId, updates)
  } else {
    // productService.updateProduct(eventId.value, productId, updates)
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

const reportNote = ref('')
const reportSent = ref(false)

const sentReports = computed(() =>
  isDemo.value ? demoStore.reports : []
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
    boothId: 'b1',
    boothName: 'グリューワイン本舗',
    venueId: 'v1',
    venueName: '日比谷会場',
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

function handleSendReport() {
  const report = buildReport()
  if (isDemo.value) {
    demoStore.submitReport(report)
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
  }
})

onUnmounted(() => {
  productStore.stopListening()
  orderStore.stopListening()
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <AppHeader title="⚙️ 管理" />

    <!-- タブ -->
    <div class="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
      <button
        v-for="tab in [
          { key: 'quick', label: 'ダッシュボード' },
          { key: 'products', label: '商品管理' },
          { key: 'orders', label: '注文履歴' },
          { key: 'sales', label: '売上集計' },
          { key: 'report', label: '売上送信' },
          { key: 'settings', label: '設定' },
        ]"
        :key="tab.key"
        :class="[
          'btn-touch px-5 rounded-xl text-sm whitespace-nowrap',
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
          <!-- キャンセルボタン（未提供の注文のみ） -->
          <div v-if="!['served', 'cancelled'].includes(order.status)" class="mt-2">
            <button
              class="text-sm text-red-500 font-medium hover:underline"
              @click="showCancelConfirm(order.id, order.orderNumber)"
            >
              この注文をキャンセル
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
  </div>
</template>
