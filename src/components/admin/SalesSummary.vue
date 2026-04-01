<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Order, PaymentMethod, OrderType } from '@/types'
import { formatPrice, formatTime } from '@/utils/format'
import SalesCharts from '@/components/charts/SalesCharts.vue'

const props = defineProps<{
  orders: Order[]
}>()

// ========== フィルター条件 ==========

// 期間プリセット
type PeriodPreset = 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
const periodPreset = ref<PeriodPreset>('today')
const customFrom = ref('')
const customTo = ref('')

// 支払方法フィルタ
const filterPayment = ref<PaymentMethod | 'all'>('all')
// 注文種別フィルタ
const filterOrderType = ref<OrderType | 'all'>('all')
// 商品名フィルタ
const filterProductName = ref('')

// 表示セクション
const activeSection = ref<'summary' | 'hourly' | 'daily' | 'products' | 'orders'>('summary')

// ========== 期間計算 ==========

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

const periodRange = computed((): { from: Date; to: Date } => {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = new Date(todayStart.getTime() + 86400000)

  switch (periodPreset.value) {
    case 'today':
      return { from: todayStart, to: todayEnd }
    case 'yesterday': {
      const ydStart = new Date(todayStart.getTime() - 86400000)
      return { from: ydStart, to: todayStart }
    }
    case 'week': {
      const weekStart = new Date(todayStart.getTime() - 6 * 86400000)
      return { from: weekStart, to: todayEnd }
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: monthStart, to: todayEnd }
    }
    case 'custom': {
      const from = customFrom.value ? startOfDay(new Date(customFrom.value)) : todayStart
      const to = customTo.value ? new Date(startOfDay(new Date(customTo.value)).getTime() + 86400000) : todayEnd
      return { from, to }
    }
    default:
      return { from: new Date(0), to: todayEnd }
  }
})

// ========== フィルタ適用 ==========

const filteredOrders = computed(() => {
  const { from, to } = periodRange.value
  return props.orders.filter((o) => {
    // キャンセルは除外
    if (o.status === 'cancelled') return false
    // 期間
    if (periodPreset.value !== 'all') {
      if (o.createdAt < from || o.createdAt >= to) return false
    }
    // 支払方法
    if (filterPayment.value !== 'all' && o.paymentMethod !== filterPayment.value) return false
    // 注文種別
    if (filterOrderType.value !== 'all' && o.orderType !== filterOrderType.value) return false
    // 商品名
    if (filterProductName.value) {
      const keyword = filterProductName.value.toLowerCase()
      const hasMatch = o.items.some((i) => i.name.toLowerCase().includes(keyword))
      if (!hasMatch) return false
    }
    return true
  })
})

// キャンセル注文（期間内）
const cancelledInPeriod = computed(() => {
  const { from, to } = periodRange.value
  return props.orders.filter((o) => {
    if (o.status !== 'cancelled') return false
    if (periodPreset.value !== 'all') {
      if (o.createdAt < from || o.createdAt >= to) return false
    }
    return true
  }).length
})

// ========== 集計ロジック ==========

const totalSales = computed(() =>
  filteredOrders.value.reduce((s, o) => s + o.totalAmount, 0)
)
const orderCount = computed(() => filteredOrders.value.length)
const averagePerOrder = computed(() =>
  orderCount.value > 0 ? Math.round(totalSales.value / orderCount.value) : 0
)

// 支払方法別
const salesByPayment = computed(() => {
  const map: Record<string, { count: number; total: number }> = {}
  for (const o of filteredOrders.value) {
    if (!map[o.paymentMethod]) map[o.paymentMethod] = { count: 0, total: 0 }
    map[o.paymentMethod].count++
    map[o.paymentMethod].total += o.totalAmount
  }
  return map
})

// 注文種別別
const salesByOrderType = computed(() => {
  const map: Record<string, { count: number; total: number }> = {}
  for (const o of filteredOrders.value) {
    if (!map[o.orderType]) map[o.orderType] = { count: 0, total: 0 }
    map[o.orderType].count++
    map[o.orderType].total += o.totalAmount
  }
  return map
})

// 商品別
const salesByProduct = computed(() => {
  const map: Record<string, { name: string; count: number; total: number }> = {}
  for (const o of filteredOrders.value) {
    for (const item of o.items) {
      if (!map[item.productId]) map[item.productId] = { name: item.name, count: 0, total: 0 }
      map[item.productId].count += item.quantity
      const optTotal = item.options.reduce((s, op) => s + op.price, 0)
      map[item.productId].total += (item.price + optTotal) * item.quantity
    }
  }
  return Object.values(map).sort((a, b) => b.total - a.total)
})

// 時間帯別
const salesByHour = computed(() => {
  const map: Record<number, { count: number; total: number }> = {}
  for (const o of filteredOrders.value) {
    const h = o.createdAt.getHours()
    if (!map[h]) map[h] = { count: 0, total: 0 }
    map[h].count++
    map[h].total += o.totalAmount
  }
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    count: map[h]?.count || 0,
    total: map[h]?.total || 0,
  })).filter((h) => h.count > 0)
})

// ピーク時間帯
const peakHour = computed(() => {
  if (salesByHour.value.length === 0) return null
  return salesByHour.value.reduce((max, h) => (h.count > max.count ? h : max))
})

// 時間帯バーの最大値（グラフ用）
const maxHourlyCount = computed(() =>
  salesByHour.value.reduce((max, h) => Math.max(max, h.count), 1)
)

// 日別
const salesByDate = computed(() => {
  const map: Record<string, { date: string; count: number; total: number }> = {}
  for (const o of filteredOrders.value) {
    const key = `${o.createdAt.getFullYear()}-${String(o.createdAt.getMonth() + 1).padStart(2, '0')}-${String(o.createdAt.getDate()).padStart(2, '0')}`
    if (!map[key]) map[key] = { date: key, count: 0, total: 0 }
    map[key].count++
    map[key].total += o.totalAmount
  }
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
})

// 最大日次売上（グラフ用）
const maxDailyTotal = computed(() =>
  salesByDate.value.reduce((max, d) => Math.max(max, d.total), 1)
)

// ラベル
const paymentLabels: Record<string, string> = {
  cash: '現金', cashless: 'キャッシュレス', other: 'その他',
}
const orderTypeLabels: Record<string, string> = {
  eat_in: '店内', takeout: 'テイクアウト', goods: '物販',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]})`
}

// フィルタリセット
function resetFilters() {
  periodPreset.value = 'today'
  filterPayment.value = 'all'
  filterOrderType.value = 'all'
  filterProductName.value = ''
  customFrom.value = ''
  customTo.value = ''
}

const hasActiveFilters = computed(() =>
  filterPayment.value !== 'all' ||
  filterOrderType.value !== 'all' ||
  filterProductName.value !== ''
)
</script>

<template>
  <div class="space-y-4">
    <!-- ===== フィルターエリア ===== -->
    <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="font-bold text-gray-800">絞り込み</h3>
        <button
          v-if="hasActiveFilters"
          class="text-sm text-red-500 font-medium hover:underline"
          @click="resetFilters"
        >
          条件リセット
        </button>
      </div>

      <!-- 期間プリセット -->
      <div>
        <div class="text-xs font-bold text-gray-500 mb-1">期間</div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="p in [
              { key: 'today', label: '今日' },
              { key: 'yesterday', label: '昨日' },
              { key: 'week', label: '直近7日' },
              { key: 'month', label: '今月' },
              { key: 'all', label: '全期間' },
              { key: 'custom', label: '日付指定' },
            ]"
            :key="p.key"
            :class="[
              'px-3 py-2 rounded-lg text-sm font-bold transition-colors',
              periodPreset === p.key
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ]"
            @click="periodPreset = p.key as PeriodPreset"
          >
            {{ p.label }}
          </button>
        </div>
        <!-- カスタム日付 -->
        <div v-if="periodPreset === 'custom'" class="flex gap-2 mt-2">
          <input
            v-model="customFrom"
            type="date"
            class="flex-1 min-h-[40px] px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none"
          />
          <span class="self-center text-gray-400">〜</span>
          <input
            v-model="customTo"
            type="date"
            class="flex-1 min-h-[40px] px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none"
          />
        </div>
      </div>

      <!-- 支払方法 & 注文種別 -->
      <div class="flex gap-4">
        <div class="flex-1">
          <div class="text-xs font-bold text-gray-500 mb-1">支払方法</div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="p in [
                { key: 'all', label: 'すべて' },
                { key: 'cash', label: '現金' },
                { key: 'cashless', label: 'キャッシュレス' },
              ]"
              :key="p.key"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-bold',
                filterPayment === p.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ]"
              @click="filterPayment = p.key as PaymentMethod | 'all'"
            >
              {{ p.label }}
            </button>
          </div>
        </div>
        <div class="flex-1">
          <div class="text-xs font-bold text-gray-500 mb-1">注文種別</div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="p in [
                { key: 'all', label: 'すべて' },
                { key: 'eat_in', label: '店内' },
                { key: 'takeout', label: 'テイクアウト' },
                { key: 'goods', label: '物販' },
              ]"
              :key="p.key"
              :class="[
                'px-3 py-1.5 rounded-lg text-xs font-bold',
                filterOrderType === p.key
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ]"
              @click="filterOrderType = p.key as OrderType | 'all'"
            >
              {{ p.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 商品名検索 -->
      <div>
        <div class="text-xs font-bold text-gray-500 mb-1">商品名で絞り込み</div>
        <input
          v-model="filterProductName"
          type="text"
          placeholder="例: グリューワイン"
          class="w-full min-h-[40px] px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none"
        />
      </div>
    </div>

    <!-- ===== 表示切替タブ ===== -->
    <div class="flex gap-2 overflow-x-auto">
      <button
        v-for="s in [
          { key: 'summary', label: '概要' },
          { key: 'hourly', label: '時間帯' },
          { key: 'daily', label: '日別' },
          { key: 'products', label: '商品別' },
          { key: 'orders', label: '明細' },
        ]"
        :key="s.key"
        :class="[
          'px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap',
          activeSection === s.key
            ? 'bg-gray-800 text-white'
            : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200',
        ]"
        @click="activeSection = s.key as typeof activeSection"
      >
        {{ s.label }}
      </button>
    </div>

    <!-- ===== 概要 ===== -->
    <div v-if="activeSection === 'summary'" class="space-y-4">
      <!-- サマリカード -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="text-xs text-gray-500">売上合計</div>
          <div class="text-2xl font-black text-red-600">{{ formatPrice(totalSales) }}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="text-xs text-gray-500">注文数</div>
          <div class="text-2xl font-black text-gray-800">{{ orderCount }}件</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="text-xs text-gray-500">客単価</div>
          <div class="text-2xl font-black text-gray-800">{{ formatPrice(averagePerOrder) }}</div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <div class="text-xs text-gray-500">キャンセル</div>
          <div class="text-2xl font-black text-gray-400">{{ cancelledInPeriod }}件</div>
        </div>
      </div>

      <!-- ピーク情報 -->
      <div v-if="peakHour" class="bg-orange-50 rounded-xl p-4 border border-orange-200">
        <span class="text-sm text-orange-700 font-bold">
          ピーク時間帯: {{ peakHour.hour }}:00〜{{ peakHour.hour + 1 }}:00
          （{{ peakHour.count }}件 / {{ formatPrice(peakHour.total) }}）
        </span>
      </div>

      <!-- 支払方法別 -->
      <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">支払方法別</h3>
        <div class="space-y-2">
          <div
            v-for="(data, method) in salesByPayment"
            :key="method"
            class="flex items-center justify-between py-1.5"
          >
            <span class="text-gray-700 text-sm">{{ paymentLabels[method] || method }}</span>
            <div class="text-right">
              <span class="font-bold text-gray-800 text-sm">{{ formatPrice(data.total) }}</span>
              <span class="text-xs text-gray-500 ml-1">({{ data.count }}件)</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 注文種別別 -->
      <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">注文種別別</h3>
        <div class="space-y-2">
          <div
            v-for="(data, type) in salesByOrderType"
            :key="type"
            class="flex items-center justify-between py-1.5"
          >
            <span class="text-gray-700 text-sm">{{ orderTypeLabels[type] || type }}</span>
            <div class="text-right">
              <span class="font-bold text-gray-800 text-sm">{{ formatPrice(data.total) }}</span>
              <span class="text-xs text-gray-500 ml-1">({{ data.count }}件)</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== グラフ ===== -->
    <div v-if="activeSection === 'summary'">
      <SalesCharts
        :hourly-data="salesByHour"
        :daily-data="salesByDate"
        :payment-data="salesByPayment"
        :product-data="salesByProduct"
      />
    </div>

    <!-- ===== 時間帯別 ===== -->
    <div v-if="activeSection === 'hourly'" class="space-y-2">
      <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-4 text-sm">時間帯別売上</h3>
        <div v-if="salesByHour.length === 0" class="text-center text-gray-400 py-4">
          データがありません
        </div>
        <div class="space-y-2">
          <div
            v-for="h in salesByHour"
            :key="h.hour"
            class="flex items-center gap-3"
          >
            <span class="text-xs text-gray-500 w-16 shrink-0 text-right">
              {{ h.hour }}:00
            </span>
            <!-- バーチャート -->
            <div class="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
              <div
                class="h-full rounded-full flex items-center px-2"
                :class="peakHour && h.hour === peakHour.hour ? 'bg-orange-500' : 'bg-blue-500'"
                :style="{ width: `${Math.max((h.count / maxHourlyCount) * 100, 8)}%` }"
              >
                <span class="text-white text-xs font-bold whitespace-nowrap">
                  {{ h.count }}件
                </span>
              </div>
            </div>
            <span class="text-sm font-bold text-gray-700 w-20 text-right shrink-0">
              {{ formatPrice(h.total) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 日別 ===== -->
    <div v-if="activeSection === 'daily'" class="space-y-2">
      <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-4 text-sm">日別売上</h3>
        <div v-if="salesByDate.length === 0" class="text-center text-gray-400 py-4">
          データがありません
        </div>
        <div class="space-y-2">
          <div
            v-for="d in salesByDate"
            :key="d.date"
            class="flex items-center gap-3"
          >
            <span class="text-xs text-gray-500 w-20 shrink-0 text-right">
              {{ formatDate(d.date) }}
            </span>
            <div class="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
              <div
                class="bg-green-500 h-full rounded-full flex items-center px-2"
                :style="{ width: `${Math.max((d.total / maxDailyTotal) * 100, 12)}%` }"
              >
                <span class="text-white text-xs font-bold whitespace-nowrap">
                  {{ d.count }}件
                </span>
              </div>
            </div>
            <span class="text-sm font-bold text-gray-700 w-24 text-right shrink-0">
              {{ formatPrice(d.total) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 商品別 ===== -->
    <div v-if="activeSection === 'products'" class="space-y-2">
      <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">
          商品別売上ランキング
          <span class="text-gray-400 font-normal ml-1">({{ salesByProduct.length }}商品)</span>
        </h3>
        <div v-if="salesByProduct.length === 0" class="text-center text-gray-400 py-4">
          データがありません
        </div>
        <div class="space-y-1">
          <div
            v-for="(item, idx) in salesByProduct"
            :key="item.name"
            class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0"
          >
            <span
              :class="[
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                idx === 0 ? 'bg-yellow-400 text-yellow-900'
                  : idx === 1 ? 'bg-gray-300 text-gray-700'
                    : idx === 2 ? 'bg-orange-300 text-orange-800'
                      : 'bg-gray-100 text-gray-500',
              ]"
            >
              {{ idx + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-800 text-sm truncate">{{ item.name }}</div>
              <div class="text-xs text-gray-500">{{ item.count }}個販売</div>
            </div>
            <span class="font-bold text-gray-800 text-sm shrink-0">{{ formatPrice(item.total) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 注文明細 ===== -->
    <div v-if="activeSection === 'orders'" class="space-y-2">
      <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">
          注文一覧
          <span class="text-gray-400 font-normal ml-1">({{ filteredOrders.length }}件)</span>
        </h3>
        <div v-if="filteredOrders.length === 0" class="text-center text-gray-400 py-4">
          該当する注文はありません
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b-2 border-gray-200 text-gray-500 text-xs">
                <th class="py-2 text-left">#</th>
                <th class="py-2 text-left">時刻</th>
                <th class="py-2 text-left">内容</th>
                <th class="py-2 text-left">種別</th>
                <th class="py-2 text-left">支払</th>
                <th class="py-2 text-right">金額</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="order in filteredOrders.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())"
                :key="order.id"
                class="border-b border-gray-100 hover:bg-gray-50"
              >
                <td class="py-2 font-bold text-gray-800 tabular-nums">{{ order.orderNumber }}</td>
                <td class="py-2 text-gray-600 whitespace-nowrap">
                  {{ `${order.createdAt.getMonth()+1}/${order.createdAt.getDate()}` }}
                  {{ formatTime(order.createdAt) }}
                </td>
                <td class="py-2 text-gray-600 max-w-[200px] truncate">
                  {{ order.items.map((i) => `${i.name}×${i.quantity}`).join(', ') }}
                </td>
                <td class="py-2 text-gray-500 text-xs">{{ orderTypeLabels[order.orderType] || order.orderType }}</td>
                <td class="py-2 text-gray-500 text-xs">{{ paymentLabels[order.paymentMethod] || order.paymentMethod }}</td>
                <td class="py-2 font-bold text-gray-800 text-right whitespace-nowrap">{{ formatPrice(order.totalAmount) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
