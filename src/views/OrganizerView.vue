<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import type { SalesReport, Venue, Booth, DayRate, RateOverride } from '@/types'
import { formatPrice, formatTime } from '@/utils/format'
import { generateReportsCsv, generateSettlementCsv, downloadCsv, type SettlementRow } from '@/utils/csvExport'
import AppHeader from '@/components/common/AppHeader.vue'
import SalesCharts from '@/components/charts/SalesCharts.vue'

const authStore = useAuthStore()
const demoStore = useDemoStore()
const isDemo = computed(() => demoStore.isDemoMode)

// データソース
const venues = computed<Venue[]>(() => isDemo.value ? demoStore.venues : [])
const booths = computed<Booth[]>(() => isDemo.value ? demoStore.booths : [])
const allReports = computed<SalesReport[]>(() => isDemo.value ? demoStore.reports : [])
const rateOverrides = computed<RateOverride[]>(() => isDemo.value ? demoStore.rateOverrides : [])

// ===== フィルター =====
const activeTab = ref<'dashboard' | 'venue' | 'settlement' | 'exhibitors' | 'rateOverrides' | 'boothSettings'>('dashboard')
const filterVenueId = ref<string>('all')
const filterBoothId = ref<string>('all')
const filterCategory = ref<string>('all') // 飲食 / 物販
const filterPeriod = ref<'today' | 'yesterday' | 'week' | 'all'>('week')

// カテゴリ一覧（ブースから動的に取得）
const boothCategories = computed(() => {
  const cats = new Set(booths.value.map((b) => b.category))
  return Array.from(cats).sort()
})

// 期間内の日付リスト
function dateKey(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const periodDates = computed(() => {
  switch (filterPeriod.value) {
    case 'today': return [dateKey(0)]
    case 'yesterday': return [dateKey(1)]
    case 'week': return Array.from({ length: 7 }, (_, i) => dateKey(i))
    case 'all': return [] // 全期間
  }
})

// 会場+カテゴリで絞り込んだ店舗
const filteredBooths = computed(() => {
  return booths.value.filter((b) => {
    if (filterVenueId.value !== 'all' && b.venueId !== filterVenueId.value) return false
    if (filterCategory.value !== 'all' && b.category !== filterCategory.value) return false
    return true
  })
})

// カテゴリに属するブースIDセット（レポートフィルタ用）
const filteredBoothIds = computed(() => new Set(filteredBooths.value.map((b) => b.id)))

function setVenue(venueId: string) {
  filterVenueId.value = venueId
  filterBoothId.value = 'all'
}

function setCategory(cat: string) {
  filterCategory.value = cat
  filterBoothId.value = 'all'
}

// フィルタ適用済みレポート
const filteredReports = computed(() => {
  return allReports.value.filter((r) => {
    if (filterVenueId.value !== 'all' && r.venueId !== filterVenueId.value) return false
    if (filterBoothId.value !== 'all' && r.boothId !== filterBoothId.value) return false
    if (filterCategory.value !== 'all' && !filteredBoothIds.value.has(r.boothId)) return false
    if (periodDates.value.length > 0 && !periodDates.value.includes(r.date)) return false
    return true
  })
})

// ===== 集計 =====
const totalSales = computed(() => filteredReports.value.reduce((s, r) => s + r.totalSales, 0))
const totalOrders = computed(() => filteredReports.value.reduce((s, r) => s + r.orderCount, 0))
const totalCancelled = computed(() => filteredReports.value.reduce((s, r) => s + r.cancelledCount, 0))
const avgPerOrder = computed(() => totalOrders.value > 0 ? Math.round(totalSales.value / totalOrders.value) : 0)

// 会場別集計
const salesByVenue = computed(() => {
  const map: Record<string, { name: string; total: number; orders: number; boothCount: number }> = {}
  for (const r of filteredReports.value) {
    if (!map[r.venueId]) {
      const v = venues.value.find((v) => v.id === r.venueId)
      map[r.venueId] = { name: v?.name || r.venueName, total: 0, orders: 0, boothCount: 0 }
    }
    map[r.venueId].total += r.totalSales
    map[r.venueId].orders += r.orderCount
  }
  // 店舗数
  for (const key of Object.keys(map)) {
    map[key].boothCount = booths.value.filter((b) => b.venueId === key).length
  }
  return Object.entries(map)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.total - a.total)
})

// 店舗別集計
const salesByBooth = computed(() => {
  const map: Record<string, { name: string; venueName: string; venueId: string; total: number; orders: number; days: Set<string> }> = {}
  for (const r of filteredReports.value) {
    if (!map[r.boothId]) {
      map[r.boothId] = { name: r.boothName, venueName: r.venueName, venueId: r.venueId, total: 0, orders: 0, days: new Set() }
    }
    map[r.boothId].total += r.totalSales
    map[r.boothId].orders += r.orderCount
    map[r.boothId].days.add(r.date)
  }
  return Object.entries(map)
    .map(([id, d]) => ({ id, ...d, dayCount: d.days.size, avgDaily: d.days.size > 0 ? Math.round(d.total / d.days.size) : 0 }))
    .sort((a, b) => b.total - a.total)
})

// 日別推移
const salesByDate = computed(() => {
  const map: Record<string, { total: number; orders: number }> = {}
  for (const r of filteredReports.value) {
    if (!map[r.date]) map[r.date] = { total: 0, orders: 0 }
    map[r.date].total += r.totalSales
    map[r.date].orders += r.orderCount
  }
  return Object.entries(map)
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date))
})
const maxDailyTotal = computed(() => salesByDate.value.reduce((m, d) => Math.max(m, d.total), 1))

// 時間帯別（全レポート合算）
const salesByHour = computed(() => {
  const map: Record<number, { count: number; total: number }> = {}
  for (const r of filteredReports.value) {
    for (const h of r.salesByHour) {
      if (!map[h.hour]) map[h.hour] = { count: 0, total: 0 }
      map[h.hour].count += h.count
      map[h.hour].total += h.total
    }
  }
  return Object.entries(map)
    .map(([h, d]) => ({ hour: Number(h), ...d }))
    .sort((a, b) => a.hour - b.hour)
})
const maxHourlyCount = computed(() => salesByHour.value.reduce((m, h) => Math.max(m, h.count), 1))
const peakHour = computed(() => salesByHour.value.length > 0
  ? salesByHour.value.reduce((max, h) => h.count > max.count ? h : max)
  : null
)

// 支払方法別合算
const totalByPayment = computed(() => {
  const map: Record<string, { count: number; total: number }> = {}
  for (const r of filteredReports.value) {
    for (const [method, data] of Object.entries(r.salesByPayment)) {
      if (!map[method]) map[method] = { count: 0, total: 0 }
      map[method].count += data.count
      map[method].total += data.total
    }
  }
  return map
})

// 商品別合算
const totalByProduct = computed(() => {
  const map: Record<string, { name: string; count: number; total: number }> = {}
  for (const r of filteredReports.value) {
    for (const p of r.salesByProduct) {
      const key = `${r.boothId}-${p.name}`
      if (!map[key]) map[key] = { name: `${p.name}（${r.boothName}）`, count: 0, total: 0 }
      map[key].count += p.count
      map[key].total += p.total
    }
  }
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 30)
})

// ===== 精算・マージン（曜日別料金対応） =====
const settlementData = computed(() => {
  return booths.value.map((booth) => {
    const boothReports = allReports.value.filter((r) => {
      if (r.boothId !== booth.id) return false
      if (periodDates.value.length > 0 && !periodDates.value.includes(r.date)) return false
      return true
    })
    const total = boothReports.reduce((s, r) => s + r.totalSales, 0)
    const orders = boothReports.reduce((s, r) => s + r.orderCount, 0)
    const days = new Set(boothReports.map((r) => r.date)).size
    const venue = venues.value.find((v) => v.id === booth.venueId)

    // 日別にマージンと出店料を計算（曜日別料金対応）
    let totalCommission = 0
    let totalFixedFee = 0
    const uniqueDates = new Set(boothReports.map(r => r.date))
    for (const dateStr of uniqueDates) {
      const rate = getRateForDate(booth, dateStr)
      const daySales = boothReports.filter(r => r.date === dateStr).reduce((s, r) => s + r.totalSales, 0)
      totalCommission += Math.round(daySales * rate.commissionRate)
      totalFixedFee += rate.fixedFee
    }

    return {
      boothId: booth.id,
      boothName: booth.name,
      venueName: venue?.name || '',
      venueId: booth.venueId,
      category: booth.category,
      useVenueRate: booth.useVenueRate,
      totalSales: total,
      orderCount: orders,
      days,
      commission: totalCommission,
      fixedFee: totalFixedFee,
      totalFee: totalCommission + totalFixedFee,
      netToBooth: total - totalCommission - totalFixedFee,
    }
  }).filter((s) => {
    if (filterVenueId.value !== 'all' && s.venueId !== filterVenueId.value) return false
    if (filterCategory.value !== 'all' && s.category !== filterCategory.value) return false
    return true
  }).sort((a, b) => b.totalSales - a.totalSales)
})

const settlementTotals = computed(() => ({
  totalSales: settlementData.value.reduce((s, d) => s + d.totalSales, 0),
  totalCommission: settlementData.value.reduce((s, d) => s + d.commission, 0),
  totalFixedFee: settlementData.value.reduce((s, d) => s + d.fixedFee, 0),
  totalFee: settlementData.value.reduce((s, d) => s + d.totalFee, 0),
  totalNet: settlementData.value.reduce((s, d) => s + d.netToBooth, 0),
}))

// カテゴリ別精算小計
const settlementByCategory = computed(() => {
  const map: Record<string, { sales: number; commission: number; fixedFee: number; fee: number; net: number; count: number }> = {}
  for (const s of settlementData.value) {
    if (!map[s.category]) map[s.category] = { sales: 0, commission: 0, fixedFee: 0, fee: 0, net: 0, count: 0 }
    map[s.category].sales += s.totalSales
    map[s.category].commission += s.commission
    map[s.category].fixedFee += s.fixedFee
    map[s.category].fee += s.totalFee
    map[s.category].net += s.netToBooth
    map[s.category].count++
  }
  return Object.entries(map).map(([cat, d]) => ({ category: cat, ...d }))
})

const paymentLabels: Record<string, string> = { cash: '現金', cashless: 'キャッシュレス', other: 'その他' }

// ===== 出店設定の編集 =====
const editingBoothId = ref<string | null>(null)
const editCommission = ref(0)
const editFixedFee = ref(0)

function startEditBooth(booth: Booth) {
  editingBoothId.value = booth.id
  editCommission.value = booth.commissionRate * 100
  editFixedFee.value = booth.fixedFee
}

function saveBoothSettings() {
  if (!editingBoothId.value) return
  const idx = demoStore.booths.findIndex((b) => b.id === editingBoothId.value)
  if (idx !== -1) {
    demoStore.booths[idx] = {
      ...demoStore.booths[idx],
      commissionRate: editCommission.value / 100,
      fixedFee: editFixedFee.value,
    }
  }
  editingBoothId.value = null
}

function cancelEditBooth() {
  editingBoothId.value = null
}

// カテゴリ一括変更
const bulkCategory = ref('')
const bulkCommission = ref<number | null>(null)
const bulkFixedFee = ref<number | null>(null)

function applyBulkSettings() {
  if (!bulkCategory.value) return
  for (const booth of demoStore.booths) {
    if (booth.category === bulkCategory.value) {
      if (bulkCommission.value !== null) booth.commissionRate = bulkCommission.value / 100
      if (bulkFixedFee.value !== null) booth.fixedFee = bulkFixedFee.value
    }
  }
  bulkCommission.value = null
  bulkFixedFee.value = null
  bulkCategory.value = ''
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}(${['日','月','火','水','木','金','土'][d.getDay()]})`
}

// ===== 料金オーバーライド =====
const showOverrideForm = ref(false)
const overrideForm = ref({
  date: new Date().toISOString().split('T')[0],
  venueId: '',
  boothId: '' as string | null,
  commissionRate: null as number | null,
  fixedFee: null as number | null,
  reason: '',
})
const editingOverrideId = ref<string | null>(null)

function openAddOverride() {
  overrideForm.value = {
    date: new Date().toISOString().split('T')[0],
    venueId: venues.value[0]?.id || '',
    boothId: null,
    commissionRate: null,
    fixedFee: null,
    reason: '',
  }
  editingOverrideId.value = null
  showOverrideForm.value = true
}

function openEditOverride(o: RateOverride) {
  overrideForm.value = {
    date: o.date,
    venueId: o.venueId,
    boothId: o.boothId || '',
    commissionRate: o.commissionRate !== null ? o.commissionRate * 100 : null,
    fixedFee: o.fixedFee,
    reason: o.reason,
  }
  editingOverrideId.value = o.id
  showOverrideForm.value = true
}

function saveOverride() {
  if (!overrideForm.value.date || !overrideForm.value.venueId || !overrideForm.value.reason.trim()) return
  const data = {
    date: overrideForm.value.date,
    venueId: overrideForm.value.venueId,
    boothId: overrideForm.value.boothId || null,
    commissionRate: overrideForm.value.commissionRate !== null ? overrideForm.value.commissionRate / 100 : null,
    fixedFee: overrideForm.value.fixedFee,
    reason: overrideForm.value.reason,
  }
  if (editingOverrideId.value) {
    demoStore.updateRateOverride(editingOverrideId.value, data)
  } else {
    demoStore.addRateOverride(data)
  }
  showOverrideForm.value = false
}

function removeOverride(id: string) {
  if (!confirm('この料金調整を削除しますか？')) return
  demoStore.deleteRateOverride(id)
}

// オーバーライド用のブース一覧（会場フィルタ）
const overrideBoothOptions = computed(() => {
  if (!overrideForm.value.venueId) return []
  return booths.value.filter(b => b.venueId === overrideForm.value.venueId)
})

// 表示用にソート
const sortedOverrides = computed(() =>
  [...rateOverrides.value].sort((a, b) => b.date.localeCompare(a.date))
)

// ===== 出展者登録 =====
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const showVenueForm = ref(false)
const venueForm = ref({ name: '', location: '', defaultCommissionRate: 15, defaultFixedFee: 50000, dayRates: [] as { dayOfWeek: number; commissionRate: number; fixedFee: number }[] })
const editingVenueId = ref<string | null>(null)

function openAddVenue() {
  venueForm.value = { name: '', location: '', defaultCommissionRate: 15, defaultFixedFee: 50000, dayRates: [] }
  editingVenueId.value = null
  showVenueForm.value = true
}

function openEditVenue(v: Venue) {
  venueForm.value = {
    name: v.name,
    location: v.location,
    defaultCommissionRate: v.defaultCommissionRate * 100,
    defaultFixedFee: v.defaultFixedFee,
    dayRates: (v.dayRates || []).map(d => ({ dayOfWeek: d.dayOfWeek, commissionRate: d.commissionRate * 100, fixedFee: d.fixedFee })),
  }
  editingVenueId.value = v.id
  showVenueForm.value = true
}

function addDayRate() {
  const usedDays = new Set(venueForm.value.dayRates.map(d => d.dayOfWeek))
  const nextDay = [6, 0, 5, 4, 3, 2, 1].find(d => !usedDays.has(d))
  if (nextDay === undefined) return
  venueForm.value.dayRates.push({ dayOfWeek: nextDay, commissionRate: venueForm.value.defaultCommissionRate, fixedFee: venueForm.value.defaultFixedFee })
  venueForm.value.dayRates.sort((a, b) => a.dayOfWeek - b.dayOfWeek)
}

function removeDayRate(idx: number) {
  venueForm.value.dayRates.splice(idx, 1)
}

function saveVenue() {
  if (!venueForm.value.name.trim()) return
  const data: Partial<Venue> = {
    name: venueForm.value.name,
    location: venueForm.value.location,
    defaultCommissionRate: venueForm.value.defaultCommissionRate / 100,
    defaultFixedFee: venueForm.value.defaultFixedFee,
    dayRates: venueForm.value.dayRates.map(d => ({ dayOfWeek: d.dayOfWeek, commissionRate: d.commissionRate / 100, fixedFee: d.fixedFee })),
  }
  if (editingVenueId.value) {
    demoStore.updateVenue(editingVenueId.value, data)
  } else {
    demoStore.addVenue(data as Omit<Venue, 'id'>)
  }
  showVenueForm.value = false
}

// 特定日付のブースの料金を取得
// 優先順位: ① 特定日+特定店舗オーバーライド → ② 特定日+全店舗オーバーライド → ③ 曜日別 → ④ 会場デフォルト → ⑤ ブース個別
function getRateForDate(booth: Booth, dateStr: string): { commissionRate: number; fixedFee: number; overridden: boolean; reason: string } {
  // ① 特定日+特定店舗のオーバーライド
  const boothOverride = rateOverrides.value.find(o => o.date === dateStr && o.boothId === booth.id && o.venueId === booth.venueId)
  if (boothOverride) {
    const venue = venues.value.find(v => v.id === booth.venueId)
    const base = booth.useVenueRate && venue
      ? { commissionRate: venue.defaultCommissionRate, fixedFee: venue.defaultFixedFee }
      : { commissionRate: booth.commissionRate, fixedFee: booth.fixedFee }
    return {
      commissionRate: boothOverride.commissionRate !== null ? boothOverride.commissionRate : base.commissionRate,
      fixedFee: boothOverride.fixedFee !== null ? boothOverride.fixedFee : base.fixedFee,
      overridden: true,
      reason: boothOverride.reason,
    }
  }

  // ② 特定日+全店舗（venueId一致, boothId=null）のオーバーライド
  const venueOverride = rateOverrides.value.find(o => o.date === dateStr && o.boothId === null && o.venueId === booth.venueId)
  if (venueOverride) {
    const venue = venues.value.find(v => v.id === booth.venueId)
    const base = booth.useVenueRate && venue
      ? { commissionRate: venue.defaultCommissionRate, fixedFee: venue.defaultFixedFee }
      : { commissionRate: booth.commissionRate, fixedFee: booth.fixedFee }
    return {
      commissionRate: venueOverride.commissionRate !== null ? venueOverride.commissionRate : base.commissionRate,
      fixedFee: venueOverride.fixedFee !== null ? venueOverride.fixedFee : base.fixedFee,
      overridden: true,
      reason: venueOverride.reason,
    }
  }

  // ③④⑤ 通常の料金計算
  const venue = venues.value.find(v => v.id === booth.venueId)
  if (booth.useVenueRate && venue) {
    const dow = new Date(dateStr).getDay()
    const dayRate = (venue.dayRates || []).find(d => d.dayOfWeek === dow)
    if (dayRate) return { commissionRate: dayRate.commissionRate, fixedFee: dayRate.fixedFee, overridden: false, reason: '' }
    return { commissionRate: venue.defaultCommissionRate, fixedFee: venue.defaultFixedFee, overridden: false, reason: '' }
  }
  return { commissionRate: booth.commissionRate, fixedFee: booth.fixedFee, overridden: false, reason: '' }
}

function removeVenue(venueId: string) {
  if (!confirm('この会場と所属する出展者を全て削除しますか？')) return
  demoStore.deleteVenue(venueId)
}

const showBoothForm = ref(false)
const boothForm = ref({ venueId: '', name: '', category: '飲食', commissionRate: 15, fixedFee: 50000, useVenueRate: true })
const editingBoothFormId = ref<string | null>(null)

function openAddBooth(venueId?: string) {
  boothForm.value = { venueId: venueId || (venues.value[0]?.id || ''), name: '', category: '飲食', commissionRate: 15, fixedFee: 50000, useVenueRate: true }
  editingBoothFormId.value = null
  showBoothForm.value = true
}

function openEditBoothForm(b: Booth) {
  boothForm.value = { venueId: b.venueId, name: b.name, category: b.category, commissionRate: b.commissionRate * 100, fixedFee: b.fixedFee, useVenueRate: b.useVenueRate }
  editingBoothFormId.value = b.id
  showBoothForm.value = true
}

function saveBooth() {
  if (!boothForm.value.name.trim() || !boothForm.value.venueId) return
  const data = {
    venueId: boothForm.value.venueId,
    name: boothForm.value.name,
    category: boothForm.value.category,
    commissionRate: boothForm.value.commissionRate / 100,
    fixedFee: boothForm.value.fixedFee,
    useVenueRate: boothForm.value.useVenueRate,
  }
  if (editingBoothFormId.value) {
    demoStore.updateBooth(editingBoothFormId.value, data)
  } else {
    demoStore.addBooth(data)
  }
  showBoothForm.value = false
}

function removeBooth(boothId: string) {
  if (!confirm('この出展者を削除しますか？')) return
  demoStore.deleteBooth(boothId)
}

// 会場ごとにブースをグループ化
const boothsByVenue = computed(() => {
  const map: Record<string, Booth[]> = {}
  for (const v of venues.value) {
    map[v.id] = booths.value.filter((b) => b.venueId === v.id)
  }
  return map
})

// CSV出力
function exportReportsCsv() {
  const csv = generateReportsCsv(filteredReports.value)
  const today = new Date().toISOString().slice(0, 10)
  downloadCsv(csv, `売上レポート_${today}.csv`)
}

function exportSettlementCsv() {
  const rows: SettlementRow[] = settlementData.value.map((s) => ({
    boothName: s.boothName,
    venueName: s.venueName,
    category: s.category,
    totalSales: s.totalSales,
    commission: s.commission,
    fixedFee: s.fixedFee,
    totalFee: s.totalFee,
    netToBooth: s.netToBooth,
  }))
  const csv = generateSettlementCsv(rows)
  const today = new Date().toISOString().slice(0, 10)
  downloadCsv(csv, `精算データ_${today}.csv`)
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col">
    <AppHeader title="👑 主催者ダッシュボード" />

    <!-- タブ -->
    <div class="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
      <button
        v-for="tab in [
          { key: 'dashboard', label: '売上概要' },
          { key: 'venue', label: '会場・店舗別' },
          { key: 'settlement', label: '精算・マージン' },
          { key: 'exhibitors', label: '出展者登録' },
          { key: 'rateOverrides', label: '料金調整' },
          { key: 'boothSettings', label: '出店設定' },
        ]"
        :key="tab.key"
        :class="[
          'btn-touch px-5 rounded-xl text-sm whitespace-nowrap',
          activeTab === tab.key ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
        ]"
        @click="activeTab = tab.key as typeof activeTab"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- ===== 共通フィルター（売上概要・会場店舗別のみ表示） ===== -->
    <div v-if="activeTab === 'dashboard' || activeTab === 'venue'" class="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
      <!-- 期間 -->
      <div class="flex gap-2 items-center">
        <span class="text-xs font-bold text-gray-500 w-10 shrink-0">期間</span>
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="p in [
              { key: 'today', label: '今日' },
              { key: 'yesterday', label: '昨日' },
              { key: 'week', label: '7日間' },
              { key: 'all', label: '全期間' },
            ]"
            :key="p.key"
            :class="['px-3 py-1.5 rounded-lg text-xs font-bold', filterPeriod === p.key ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
            @click="filterPeriod = p.key as typeof filterPeriod"
          >
            {{ p.label }}
          </button>
        </div>
      </div>
      <!-- 会場 -->
      <div class="flex gap-2 items-center">
        <span class="text-xs font-bold text-gray-500 w-10 shrink-0">会場</span>
        <div class="flex gap-1 flex-wrap">
          <button
            :class="['px-3 py-1.5 rounded-lg text-xs font-bold', filterVenueId === 'all' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
            @click="setVenue('all')"
          >
            全会場
          </button>
          <button
            v-for="v in venues"
            :key="v.id"
            :class="['px-3 py-1.5 rounded-lg text-xs font-bold', filterVenueId === v.id ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
            @click="setVenue(v.id)"
          >
            {{ v.name }}
          </button>
        </div>
      </div>
      <!-- カテゴリ -->
      <div class="flex gap-2 items-center">
        <span class="text-xs font-bold text-gray-500 w-10 shrink-0">種別</span>
        <div class="flex gap-1 flex-wrap">
          <button
            :class="['px-3 py-1.5 rounded-lg text-xs font-bold', filterCategory === 'all' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
            @click="setCategory('all')"
          >
            すべて
          </button>
          <button
            v-for="cat in boothCategories"
            :key="cat"
            :class="['px-3 py-1.5 rounded-lg text-xs font-bold', filterCategory === cat ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
            @click="setCategory(cat)"
          >
            {{ cat }}
          </button>
        </div>
      </div>
      <!-- 店舗 -->
      <div class="flex gap-2 items-center">
        <span class="text-xs font-bold text-gray-500 w-10 shrink-0">店舗</span>
        <div class="flex gap-1 flex-wrap">
          <button
            :class="['px-3 py-1.5 rounded-lg text-xs font-bold', filterBoothId === 'all' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
            @click="filterBoothId = 'all'"
          >
            全店舗
          </button>
          <button
            v-for="b in filteredBooths"
            :key="b.id"
            :class="['px-3 py-1.5 rounded-lg text-xs font-bold', filterBoothId === b.id ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200']"
            @click="filterBoothId = b.id"
          >
            {{ b.name }}
          </button>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">

      <!-- ===== 売上概要 ===== -->
      <div v-if="activeTab === 'dashboard'" class="space-y-4">
        <!-- CSV出力 -->
        <div class="flex justify-end">
          <button
            class="btn-touch px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm"
            @click="exportReportsCsv"
          >
            売上レポートCSV
          </button>
        </div>
        <!-- サマリ -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">売上合計</div>
            <div class="text-2xl font-black text-red-600">{{ formatPrice(totalSales) }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">注文数</div>
            <div class="text-2xl font-black text-gray-800">{{ totalOrders.toLocaleString() }}件</div>
          </div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">客単価</div>
            <div class="text-2xl font-black text-gray-800">{{ formatPrice(avgPerOrder) }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">レポート数</div>
            <div class="text-2xl font-black text-gray-800">{{ filteredReports.length }}件</div>
          </div>
        </div>

        <!-- ピーク時間 -->
        <div v-if="peakHour" class="bg-orange-50 rounded-xl p-4 border border-orange-200">
          <span class="text-sm text-orange-700 font-bold">
            ピーク時間帯: {{ peakHour.hour }}:00〜{{ peakHour.hour + 1 }}:00
            （{{ peakHour.count }}件 / {{ formatPrice(peakHour.total) }}）
          </span>
        </div>

        <!-- グラフ -->
        <SalesCharts
          :hourly-data="salesByHour"
          :daily-data="salesByDate"
          :payment-data="totalByPayment"
          :product-data="totalByProduct"
          :venue-data="salesByVenue.map((v) => ({ name: v.name, total: v.total }))"
          :category-data="settlementByCategory.map((c) => ({ category: c.category, sales: c.sales }))"
        />

        <!-- 日別推移（テーブル） -->
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3 text-sm">日別売上推移（詳細）</h3>
          <div class="space-y-2">
            <div v-for="d in salesByDate" :key="d.date" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-20 shrink-0 text-right">{{ formatDate(d.date) }}</span>
              <div class="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                <div class="bg-green-500 h-full rounded-full flex items-center px-2" :style="{ width: `${Math.max((d.total / maxDailyTotal) * 100, 12)}%` }">
                  <span class="text-white text-xs font-bold whitespace-nowrap">{{ d.orders }}件</span>
                </div>
              </div>
              <span class="text-sm font-bold text-gray-700 w-24 text-right shrink-0">{{ formatPrice(d.total) }}</span>
            </div>
          </div>
        </div>

        <!-- 時間帯別 -->
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3 text-sm">時間帯別（合算）</h3>
          <div class="space-y-2">
            <div v-for="h in salesByHour" :key="h.hour" class="flex items-center gap-3">
              <span class="text-xs text-gray-500 w-12 shrink-0 text-right">{{ h.hour }}:00</span>
              <div class="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div :class="['h-full rounded-full flex items-center px-2', peakHour && h.hour === peakHour.hour ? 'bg-orange-500' : 'bg-blue-500']" :style="{ width: `${Math.max((h.count / maxHourlyCount) * 100, 8)}%` }">
                  <span class="text-white text-xs font-bold whitespace-nowrap">{{ h.count }}</span>
                </div>
              </div>
              <span class="text-xs font-bold text-gray-700 w-20 text-right shrink-0">{{ formatPrice(h.total) }}</span>
            </div>
          </div>
        </div>

        <!-- 支払方法別 -->
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3 text-sm">支払方法別</h3>
          <div class="space-y-2">
            <div v-for="(data, method) in totalByPayment" :key="method" class="flex justify-between py-1.5">
              <span class="text-gray-700 text-sm">{{ paymentLabels[method] || method }}</span>
              <div class="text-right">
                <span class="font-bold text-gray-800 text-sm">{{ formatPrice(data.total) }}</span>
                <span class="text-xs text-gray-500 ml-1">({{ data.count }}件)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 商品ランキング -->
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3 text-sm">商品ランキング TOP30</h3>
          <div class="space-y-1">
            <div v-for="(p, idx) in totalByProduct" :key="p.name" class="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
              <span :class="['w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0', idx < 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-100 text-gray-500']">{{ idx + 1 }}</span>
              <span class="flex-1 text-sm text-gray-800 truncate">{{ p.name }}</span>
              <span class="text-xs text-gray-500">{{ p.count }}個</span>
              <span class="text-sm font-bold text-gray-800 shrink-0">{{ formatPrice(p.total) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 会場・店舗別 ===== -->
      <div v-if="activeTab === 'venue'" class="space-y-4">
        <!-- 会場別 -->
        <div v-if="filterVenueId === 'all'" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3">会場別サマリ</h3>
          <div class="space-y-3">
            <div v-for="v in salesByVenue" :key="v.id" class="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 cursor-pointer" @click="setVenue(v.id)">
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-bold text-gray-800 text-lg">{{ v.name }}</div>
                  <div class="text-sm text-gray-500">{{ v.boothCount }}店舗 / {{ v.orders.toLocaleString() }}件</div>
                </div>
                <div class="text-right">
                  <div class="text-xl font-black text-red-600">{{ formatPrice(v.total) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 店舗別 -->
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3">店舗別売上</h3>
          <div class="space-y-2">
            <div v-for="(b, idx) in salesByBooth" :key="b.id" class="border border-gray-100 rounded-xl p-3">
              <div class="flex items-center justify-between">
                <div>
                  <span :class="['inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black mr-2', idx < 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-100 text-gray-500']">{{ idx + 1 }}</span>
                  <span class="font-bold text-gray-800">{{ b.name }}</span>
                  <span v-if="filterVenueId === 'all'" class="text-xs text-gray-400 ml-2">{{ b.venueName }}</span>
                </div>
                <span class="text-lg font-black text-red-600">{{ formatPrice(b.total) }}</span>
              </div>
              <div class="flex gap-4 mt-1 text-xs text-gray-500 ml-8">
                <span>{{ b.orders }}件</span>
                <span>{{ b.dayCount }}日稼働</span>
                <span>日平均 {{ formatPrice(b.avgDaily) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 精算・マージン ===== -->
      <div v-if="activeTab === 'settlement'" class="space-y-4">
        <!-- CSV出力 -->
        <div class="flex justify-end">
          <button
            class="btn-touch px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm"
            @click="exportSettlementCsv"
          >
            精算データCSV
          </button>
        </div>
        <!-- 全体サマリ -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">総売上</div>
            <div class="text-xl font-black text-gray-800">{{ formatPrice(settlementTotals.totalSales) }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">手数料合計</div>
            <div class="text-xl font-black text-yellow-600">{{ formatPrice(settlementTotals.totalCommission) }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">出店料合計</div>
            <div class="text-xl font-black text-yellow-600">{{ formatPrice(settlementTotals.totalFixedFee) }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">主催者収入計</div>
            <div class="text-xl font-black text-red-600">{{ formatPrice(settlementTotals.totalFee) }}</div>
          </div>
          <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div class="text-xs text-gray-500">店舗支払計</div>
            <div class="text-xl font-black text-blue-600">{{ formatPrice(settlementTotals.totalNet) }}</div>
          </div>
        </div>

        <!-- 店舗別精算テーブル -->
        <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <!-- カテゴリ別小計 -->
          <div v-if="filterCategory === 'all' && settlementByCategory.length > 1" class="mb-6">
            <h4 class="font-bold text-gray-700 mb-2 text-sm">カテゴリ別</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                v-for="cat in settlementByCategory"
                :key="cat.category"
                class="border border-gray-200 rounded-xl p-4 cursor-pointer hover:bg-gray-50"
                @click="setCategory(cat.category)"
              >
                <div class="flex items-center justify-between mb-2">
                  <span class="font-bold text-gray-800 text-lg">{{ cat.category }}</span>
                  <span class="text-sm text-gray-500">{{ cat.count }}店舗</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span class="text-gray-500">総売上</span>
                    <div class="font-bold text-gray-800">{{ formatPrice(cat.sales) }}</div>
                  </div>
                  <div>
                    <span class="text-gray-500">主催者収入</span>
                    <div class="font-bold text-yellow-700">{{ formatPrice(cat.fee) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h3 class="font-bold text-gray-800 mb-3">店舗別精算明細</h3>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-gray-200 text-gray-500 text-xs">
                  <th class="py-2 text-left">店舗</th>
                  <th class="py-2 text-left">会場</th>
                  <th class="py-2 text-left">種別</th>
                  <th class="py-2 text-right">売上</th>
                  <th class="py-2 text-right">件数</th>
                  <th class="py-2 text-right">手数料率</th>
                  <th class="py-2 text-right">手数料</th>
                  <th class="py-2 text-right">出店料</th>
                  <th class="py-2 text-right font-bold text-yellow-700">主催者収入</th>
                  <th class="py-2 text-right font-bold text-blue-700">店舗支払</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="s in settlementData"
                  :key="s.boothId"
                  class="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td class="py-2 font-medium text-gray-800">{{ s.boothName }}</td>
                  <td class="py-2 text-gray-500 text-xs">{{ s.venueName }}</td>
                  <td class="py-2 text-gray-500 text-xs">{{ s.category }}</td>
                  <td class="py-2 text-right font-bold">{{ formatPrice(s.totalSales) }}</td>
                  <td class="py-2 text-right text-gray-600">{{ s.orderCount }}</td>
                  <td class="py-2 text-right text-gray-600">{{ s.totalSales > 0 ? ((s.commission / s.totalSales) * 100).toFixed(0) : 0 }}%</td>
                  <td class="py-2 text-right text-yellow-700">{{ formatPrice(s.commission) }}</td>
                  <td class="py-2 text-right text-yellow-700">{{ formatPrice(s.fixedFee) }}</td>
                  <td class="py-2 text-right font-bold text-yellow-700">{{ formatPrice(s.totalFee) }}</td>
                  <td class="py-2 text-right font-bold text-blue-700">{{ formatPrice(s.netToBooth) }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t-2 border-gray-300 font-bold">
                  <td class="py-2" colspan="3">合計</td>
                  <td class="py-2 text-right">{{ formatPrice(settlementTotals.totalSales) }}</td>
                  <td class="py-2 text-right">{{ settlementData.reduce((s, d) => s + d.orderCount, 0) }}</td>
                  <td class="py-2"></td>
                  <td class="py-2 text-right text-yellow-700">{{ formatPrice(settlementTotals.totalCommission) }}</td>
                  <td class="py-2 text-right text-yellow-700">{{ formatPrice(settlementTotals.totalFixedFee) }}</td>
                  <td class="py-2 text-right text-yellow-700">{{ formatPrice(settlementTotals.totalFee) }}</td>
                  <td class="py-2 text-right text-blue-700">{{ formatPrice(settlementTotals.totalNet) }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ===== 料金調整（特定日オーバーライド） ===== -->
      <div v-if="activeTab === 'rateOverrides'" class="space-y-4">
        <div class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h3 class="font-bold text-gray-800">料金調整（特定日）</h3>
              <p class="text-sm text-gray-500 mt-1">トラブルや天候等で特定の日・店舗の出店料やマージンを変更</p>
            </div>
            <button
              class="btn-touch px-4 min-h-[40px] bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-sm font-bold"
              @click="openAddOverride"
            >
              ＋ 料金調整を追加
            </button>
          </div>

          <div v-if="sortedOverrides.length === 0" class="text-center py-8 text-gray-400">
            料金調整はまだありません
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="o in sortedOverrides"
              :key="o.id"
              class="border border-gray-200 rounded-xl p-4 hover:bg-gray-50"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-gray-800">{{ formatDate(o.date) }}</span>
                    <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {{ venues.find(v => v.id === o.venueId)?.name || '不明' }}
                    </span>
                    <span v-if="o.boothId" class="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-bold">
                      {{ booths.find(b => b.id === o.boothId)?.name || '不明' }}
                    </span>
                    <span v-else class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                      全店舗
                    </span>
                  </div>
                  <div class="flex gap-4 text-sm text-gray-600">
                    <span v-if="o.commissionRate !== null">手数料: <strong>{{ (o.commissionRate * 100).toFixed(0) }}%</strong></span>
                    <span v-if="o.fixedFee !== null">出店料: <strong>{{ formatPrice(o.fixedFee) }}</strong></span>
                  </div>
                  <p class="text-sm text-gray-500 mt-1">📝 {{ o.reason }}</p>
                </div>
                <div class="flex gap-1 shrink-0 ml-3">
                  <button
                    class="btn-touch px-2 min-h-[32px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs"
                    @click="openEditOverride(o)"
                  >
                    編集
                  </button>
                  <button
                    class="btn-touch px-2 min-h-[32px] bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs"
                    @click="removeOverride(o.id)"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- オーバーライドフォームモーダル -->
        <div v-if="showOverrideForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showOverrideForm = false">
          <div class="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 class="font-bold text-lg text-gray-800 mb-4">{{ editingOverrideId ? '料金調整を編集' : '料金調整を追加' }}</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">対象日</label>
                <input v-model="overrideForm.date" type="date" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">会場</label>
                <select v-model="overrideForm.venueId" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none">
                  <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">対象店舗</label>
                <select v-model="overrideForm.boothId" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none">
                  <option :value="''">会場内の全店舗</option>
                  <option v-for="b in overrideBoothOptions" :key="b.id" :value="b.id">{{ b.name }}</option>
                </select>
              </div>
              <div class="flex gap-3">
                <div class="flex-1">
                  <label class="block text-xs font-bold text-gray-500 mb-1">手数料率（%）<span class="text-gray-400 font-normal">空欄=変更なし</span></label>
                  <input v-model.number="overrideForm.commissionRate" type="number" min="0" max="100" step="1" placeholder="変更なし" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none text-lg" />
                </div>
                <div class="flex-1">
                  <label class="block text-xs font-bold text-gray-500 mb-1">出店料（円）<span class="text-gray-400 font-normal">空欄=変更なし</span></label>
                  <input v-model.number="overrideForm.fixedFee" type="number" min="0" step="1000" placeholder="変更なし" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none text-lg" />
                </div>
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">変更理由 <span class="text-red-500">*</span></label>
                <textarea
                  v-model="overrideForm.reason"
                  rows="2"
                  placeholder="例: 悪天候のため減額、トラブル対応で免除 等"
                  class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none"
                ></textarea>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button class="btn-touch flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl" @click="showOverrideForm = false">キャンセル</button>
              <button class="btn-touch flex-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold" @click="saveOverride">保存</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 出展者登録 ===== -->
      <div v-if="activeTab === 'exhibitors'" class="space-y-4">
        <!-- 会場管理 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-gray-800">会場一覧</h3>
            <button
              class="btn-touch px-4 min-h-[40px] bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-sm font-bold"
              @click="openAddVenue"
            >
              ＋ 会場追加
            </button>
          </div>

          <div v-if="venues.length === 0" class="text-center py-8 text-gray-400">
            会場が登録されていません
          </div>

          <div v-else class="space-y-4">
            <div v-for="venue in venues" :key="venue.id" class="border border-gray-200 rounded-xl overflow-hidden">
              <!-- 会場ヘッダー -->
              <div class="bg-gray-50 px-4 py-3">
                <div class="flex items-center justify-between">
                <div>
                  <span class="font-bold text-gray-800 text-lg">{{ venue.name }}</span>
                  <span class="text-sm text-gray-500 ml-2">{{ venue.location }}</span>
                </div>
                <div class="flex gap-2">
                  <button
                    class="btn-touch px-3 min-h-[36px] bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm"
                    @click="openEditVenue(venue)"
                  >
                    編集
                  </button>
                  <button
                    class="btn-touch px-3 min-h-[36px] bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm"
                    @click="removeVenue(venue.id)"
                  >
                    削除
                  </button>
                  <button
                    class="btn-touch px-3 min-h-[36px] bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold"
                    @click="openAddBooth(venue.id)"
                  >
                    ＋ 出展者追加
                  </button>
                </div>
                </div>
                <!-- 料金サマリー -->
                <div class="flex flex-wrap gap-2 mt-2 text-xs text-gray-500">
                  <span>デフォルト: {{ ((venue.defaultCommissionRate || 0.15) * 100).toFixed(0) }}% / {{ formatPrice(venue.defaultFixedFee || 50000) }}</span>
                  <template v-if="venue.dayRates?.length">
                    <span class="text-gray-300">|</span>
                    <span v-for="dr in venue.dayRates" :key="dr.dayOfWeek" class="bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded">
                      {{ DAY_LABELS[dr.dayOfWeek] }}: {{ (dr.commissionRate * 100).toFixed(0) }}% / {{ formatPrice(dr.fixedFee) }}
                    </span>
                  </template>
                </div>
              </div>

              <!-- ブース一覧 -->
              <div v-if="boothsByVenue[venue.id]?.length" class="divide-y divide-gray-100">
                <div
                  v-for="booth in boothsByVenue[venue.id]"
                  :key="booth.id"
                  class="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-sm">
                      {{ booth.name.charAt(0) }}
                    </div>
                    <div>
                      <span class="font-bold text-gray-800">{{ booth.name }}</span>
                      <span
                        :class="[
                          'text-xs ml-2 px-2 py-0.5 rounded font-bold',
                          booth.category === '飲食' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700',
                        ]"
                      >
                        {{ booth.category }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-4">
                    <div class="text-right text-sm text-gray-500">
                      <template v-if="booth.useVenueRate">
                        <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded font-bold">会場設定</span>
                      </template>
                      <template v-else>
                        <span>{{ (booth.commissionRate * 100).toFixed(0) }}%</span>
                        <span class="mx-1">/</span>
                        <span>{{ formatPrice(booth.fixedFee) }}</span>
                      </template>
                    </div>
                    <div class="flex gap-1">
                      <button
                        class="btn-touch px-2 min-h-[32px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs"
                        @click="openEditBoothForm(booth)"
                      >
                        編集
                      </button>
                      <button
                        class="btn-touch px-2 min-h-[32px] bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs"
                        @click="removeBooth(booth.id)"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="px-4 py-6 text-center text-gray-400 text-sm">
                出展者がまだ登録されていません
              </div>
            </div>
          </div>
        </div>

        <!-- 会場フォームモーダル -->
        <div v-if="showVenueForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showVenueForm = false">
          <div class="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 class="font-bold text-lg text-gray-800 mb-4">{{ editingVenueId ? '会場を編集' : '会場を追加' }}</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">会場名</label>
                <input v-model="venueForm.name" type="text" placeholder="例: 日比谷会場" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">場所</label>
                <input v-model="venueForm.location" type="text" placeholder="例: 東京都千代田区" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none" />
              </div>

              <!-- デフォルト料金 -->
              <div class="border-t border-gray-200 pt-4">
                <h4 class="font-bold text-gray-700 text-sm mb-3">デフォルト料金（平日）</h4>
                <div class="flex gap-3">
                  <div class="flex-1">
                    <label class="block text-xs font-bold text-gray-500 mb-1">手数料率（%）</label>
                    <input v-model.number="venueForm.defaultCommissionRate" type="number" min="0" max="100" step="1" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none text-lg" />
                  </div>
                  <div class="flex-1">
                    <label class="block text-xs font-bold text-gray-500 mb-1">出店料（円）</label>
                    <input v-model.number="venueForm.defaultFixedFee" type="number" min="0" step="1000" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none text-lg" />
                  </div>
                </div>
              </div>

              <!-- 曜日別料金 -->
              <div class="border-t border-gray-200 pt-4">
                <div class="flex items-center justify-between mb-3">
                  <h4 class="font-bold text-gray-700 text-sm">曜日別料金（上書き設定）</h4>
                  <button
                    v-if="venueForm.dayRates.length < 7"
                    class="btn-touch px-3 min-h-[32px] bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-xs font-bold"
                    @click="addDayRate"
                  >
                    ＋ 曜日追加
                  </button>
                </div>
                <p v-if="venueForm.dayRates.length === 0" class="text-sm text-gray-400">設定なし（全日デフォルト料金を適用）</p>
                <div v-else class="space-y-2">
                  <div v-for="(dr, idx) in venueForm.dayRates" :key="idx" class="flex items-center gap-2 bg-gray-50 rounded-xl p-3">
                    <select v-model.number="dr.dayOfWeek" class="min-h-[40px] px-3 border-2 border-gray-200 rounded-lg focus:border-yellow-500 focus:outline-none font-bold w-20">
                      <option v-for="d in 7" :key="d - 1" :value="d - 1">{{ DAY_LABELS[d - 1] }}</option>
                    </select>
                    <div class="flex-1">
                      <label class="block text-[10px] text-gray-400">手数料%</label>
                      <input v-model.number="dr.commissionRate" type="number" min="0" max="100" step="1" class="w-full min-h-[36px] px-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <div class="flex-1">
                      <label class="block text-[10px] text-gray-400">出店料</label>
                      <input v-model.number="dr.fixedFee" type="number" min="0" step="1000" class="w-full min-h-[36px] px-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <button class="btn-touch px-2 min-h-[36px] text-red-500 hover:bg-red-50 rounded-lg text-lg" @click="removeDayRate(idx)">✕</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button class="btn-touch flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl" @click="showVenueForm = false">キャンセル</button>
              <button class="btn-touch flex-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold" @click="saveVenue">保存</button>
            </div>
          </div>
        </div>

        <!-- ブースフォームモーダル -->
        <div v-if="showBoothForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" @click.self="showBoothForm = false">
          <div class="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 class="font-bold text-lg text-gray-800 mb-4">{{ editingBoothFormId ? '出展者を編集' : '出展者を追加' }}</h3>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">出展者名</label>
                <input v-model="boothForm.name" type="text" placeholder="例: グリューワイン本舗" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none" />
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">所属会場</label>
                <select v-model="boothForm.venueId" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none">
                  <option v-for="v in venues" :key="v.id" :value="v.id">{{ v.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-gray-600 mb-1">カテゴリ</label>
                <div class="flex gap-2">
                  <button
                    v-for="cat in ['飲食', '物販']"
                    :key="cat"
                    :class="['btn-touch flex-1 rounded-xl text-sm font-bold', boothForm.category === cat ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200']"
                    @click="boothForm.category = cat"
                  >
                    {{ cat }}
                  </button>
                </div>
              </div>
              <div>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" v-model="boothForm.useVenueRate" class="w-5 h-5 rounded" />
                  <span class="text-sm font-bold text-gray-700">会場の料金設定を使う（曜日別対応）</span>
                </label>
                <p class="text-xs text-gray-400 mt-1 ml-8">ONにすると会場の曜日別料金が自動適用されます</p>
              </div>
              <div v-if="!boothForm.useVenueRate" class="flex gap-3">
                <div class="flex-1">
                  <label class="block text-sm font-bold text-gray-600 mb-1">手数料率（%）</label>
                  <input v-model.number="boothForm.commissionRate" type="number" min="0" max="100" step="1" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none text-lg" />
                </div>
                <div class="flex-1">
                  <label class="block text-sm font-bold text-gray-600 mb-1">出店料（円）</label>
                  <input v-model.number="boothForm.fixedFee" type="number" min="0" step="1000" class="w-full min-h-[44px] px-4 border-2 border-gray-200 rounded-xl focus:border-yellow-500 focus:outline-none text-lg" />
                </div>
              </div>
            </div>
            <div class="flex gap-3 mt-6">
              <button class="btn-touch flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl" @click="showBoothForm = false">キャンセル</button>
              <button class="btn-touch flex-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold" @click="saveBooth">保存</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 出店設定 ===== -->
      <div v-if="activeTab === 'boothSettings'" class="space-y-4">
        <!-- カテゴリ一括設定 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3">カテゴリ一括設定</h3>
          <p class="text-sm text-gray-500 mb-3">カテゴリ内の全店舗に同じ手数料率・出店料を一括適用します。</p>
          <div class="flex flex-wrap gap-3 items-end">
            <div>
              <label class="block text-xs font-bold text-gray-500 mb-1">カテゴリ</label>
              <select
                v-model="bulkCategory"
                class="min-h-[40px] px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-yellow-500 focus:outline-none"
              >
                <option value="">選択</option>
                <option v-for="cat in boothCategories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 mb-1">手数料率（%）</label>
              <input
                v-model.number="bulkCommission"
                type="number"
                min="0"
                max="100"
                step="1"
                placeholder="例: 15"
                class="w-24 min-h-[40px] px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-500 mb-1">出店料（円）</label>
              <input
                v-model.number="bulkFixedFee"
                type="number"
                min="0"
                step="1000"
                placeholder="例: 50000"
                class="w-28 min-h-[40px] px-3 border-2 border-gray-200 rounded-lg text-sm focus:border-yellow-500 focus:outline-none"
              />
            </div>
            <button
              class="btn-touch px-5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-sm"
              :disabled="!bulkCategory"
              @click="applyBulkSettings"
            >
              一括適用
            </button>
          </div>
        </div>

        <!-- 店舗別設定 -->
        <div class="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <h3 class="font-bold text-gray-800 mb-3">店舗別設定</h3>
          <div class="space-y-2">
            <div
              v-for="booth in booths"
              :key="booth.id"
              class="border border-gray-100 rounded-xl p-4"
            >
              <template v-if="editingBoothId !== booth.id">
                <div class="flex items-center justify-between">
                  <div>
                    <span class="font-bold text-gray-800">{{ booth.name }}</span>
                    <span class="text-xs text-gray-400 ml-2">
                      {{ venues.find((v) => v.id === booth.venueId)?.name }}
                    </span>
                    <span
                      :class="[
                        'text-xs ml-2 px-2 py-0.5 rounded font-bold',
                        booth.category === '飲食' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700',
                      ]"
                    >
                      {{ booth.category }}
                    </span>
                  </div>
                  <button
                    class="btn-touch px-3 min-h-[36px] bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm"
                    @click="startEditBooth(booth)"
                  >
                    編集
                  </button>
                </div>
                <div class="flex gap-6 mt-2 text-sm text-gray-600">
                  <span>手数料率: <strong>{{ (booth.commissionRate * 100).toFixed(0) }}%</strong></span>
                  <span>出店料: <strong>{{ formatPrice(booth.fixedFee) }}</strong></span>
                </div>
              </template>

              <!-- 編集モード -->
              <template v-else>
                <div class="space-y-3">
                  <div class="font-bold text-gray-800">{{ booth.name }} の設定を編集</div>
                  <div class="flex gap-3">
                    <div class="flex-1">
                      <label class="block text-xs font-bold text-gray-500 mb-1">手数料率（%）</label>
                      <input
                        v-model.number="editCommission"
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        class="w-full min-h-[44px] px-3 border-2 border-yellow-300 rounded-lg text-lg focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                    <div class="flex-1">
                      <label class="block text-xs font-bold text-gray-500 mb-1">出店料（円）</label>
                      <input
                        v-model.number="editFixedFee"
                        type="number"
                        min="0"
                        step="1000"
                        class="w-full min-h-[44px] px-3 border-2 border-yellow-300 rounded-lg text-lg focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="btn-touch flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm"
                      @click="cancelEditBooth"
                    >
                      キャンセル
                    </button>
                    <button
                      class="btn-touch flex-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-sm"
                      @click="saveBoothSettings"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
