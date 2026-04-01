import type { Venue, Booth, SalesReport, DayRate } from '@/types'

export const demoVenues: Venue[] = [
  {
    id: 'v1', name: '日比谷会場', location: '東京都千代田区',
    defaultCommissionRate: 0.15, defaultFixedFee: 50000,
    dayRates: [
      { dayOfWeek: 0, commissionRate: 0.18, fixedFee: 60000 }, // 日曜
      { dayOfWeek: 5, commissionRate: 0.17, fixedFee: 55000 }, // 金曜
      { dayOfWeek: 6, commissionRate: 0.18, fixedFee: 60000 }, // 土曜
    ],
  },
  {
    id: 'v2', name: '横浜赤レンガ会場', location: '神奈川県横浜市',
    defaultCommissionRate: 0.15, defaultFixedFee: 45000,
    dayRates: [
      { dayOfWeek: 0, commissionRate: 0.17, fixedFee: 55000 },
      { dayOfWeek: 6, commissionRate: 0.17, fixedFee: 55000 },
    ],
  },
  {
    id: 'v3', name: '大阪梅田会場', location: '大阪府大阪市',
    defaultCommissionRate: 0.15, defaultFixedFee: 40000,
    dayRates: [
      { dayOfWeek: 0, commissionRate: 0.17, fixedFee: 50000 },
      { dayOfWeek: 6, commissionRate: 0.17, fixedFee: 50000 },
    ],
  },
]

export const demoBooths: Booth[] = [
  // 日比谷会場
  { id: 'b1', venueId: 'v1', name: 'グリューワイン本舗', category: '飲食', commissionRate: 0.15, fixedFee: 50000, useVenueRate: true },
  { id: 'b2', venueId: 'v1', name: 'ソーセージハウス', category: '飲食', commissionRate: 0.15, fixedFee: 50000, useVenueRate: true },
  { id: 'b3', venueId: 'v1', name: 'シュトーレン工房', category: '飲食', commissionRate: 0.15, fixedFee: 30000, useVenueRate: false },
  { id: 'b4', venueId: 'v1', name: 'クリスマス雑貨', category: '物販', commissionRate: 0.10, fixedFee: 40000, useVenueRate: false },
  // 横浜会場
  { id: 'b5', venueId: 'v2', name: 'ホットチョコ専門店', category: '飲食', commissionRate: 0.15, fixedFee: 45000, useVenueRate: true },
  { id: 'b6', venueId: 'v2', name: 'ドイツパン屋', category: '飲食', commissionRate: 0.15, fixedFee: 45000, useVenueRate: true },
  { id: 'b7', venueId: 'v2', name: 'オーナメントショップ', category: '物販', commissionRate: 0.10, fixedFee: 35000, useVenueRate: false },
  // 大阪会場
  { id: 'b8', venueId: 'v3', name: 'ワイン＆ビール', category: '飲食', commissionRate: 0.15, fixedFee: 40000, useVenueRate: true },
  { id: 'b9', venueId: 'v3', name: 'クレープ屋さん', category: '飲食', commissionRate: 0.15, fixedFee: 40000, useVenueRate: true },
  { id: 'b10', venueId: 'v3', name: 'キャンドル工房', category: '物販', commissionRate: 0.10, fixedFee: 30000, useVenueRate: false },
]

// 複数日・複数店舗のサンプルレポート
function makeDate(daysAgo: number, hour: number = 18): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, 0, 0, 0)
  return d
}

function dateKey(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function randomHourlySales(): { hour: number; count: number; total: number }[] {
  return [11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((hour) => {
    const count = Math.floor(Math.random() * 20) + 3
    const avg = Math.floor(Math.random() * 500) + 500
    return { hour, count, total: count * avg }
  })
}

function generateReport(
  boothId: string,
  booth: Booth,
  venue: Venue,
  daysAgo: number,
  baseTotal: number
): SalesReport {
  const variation = 0.7 + Math.random() * 0.6
  const total = Math.round(baseTotal * variation)
  const orderCount = Math.round(total / (800 + Math.random() * 400))
  const cashRatio = 0.4 + Math.random() * 0.3
  const cashTotal = Math.round(total * cashRatio)

  return {
    id: `report-${boothId}-${daysAgo}`,
    boothId,
    boothName: booth.name,
    venueId: venue.id,
    venueName: venue.name,
    date: dateKey(daysAgo),
    sentAt: makeDate(daysAgo),
    sentBy: `${booth.name} 店長`,
    totalSales: total,
    orderCount,
    cancelledCount: Math.floor(Math.random() * 3),
    averagePerOrder: orderCount > 0 ? Math.round(total / orderCount) : 0,
    salesByPayment: {
      cash: { count: Math.round(orderCount * cashRatio), total: cashTotal },
      cashless: { count: orderCount - Math.round(orderCount * cashRatio), total: total - cashTotal },
    },
    salesByProduct: [
      { name: '人気商品A', count: Math.round(orderCount * 0.4), total: Math.round(total * 0.35) },
      { name: '定番商品B', count: Math.round(orderCount * 0.3), total: Math.round(total * 0.30) },
      { name: 'サイドC', count: Math.round(orderCount * 0.2), total: Math.round(total * 0.20) },
      { name: 'その他', count: Math.round(orderCount * 0.1), total: Math.round(total * 0.15) },
    ],
    salesByHour: randomHourlySales(),
    note: daysAgo === 0 ? '' : '',
  }
}

export function generateDemoReports(): SalesReport[] {
  const reports: SalesReport[] = []
  const baseTotals: Record<string, number> = {
    b1: 180000, b2: 150000, b3: 80000, b4: 120000,
    b5: 130000, b6: 100000, b7: 90000,
    b8: 140000, b9: 110000, b10: 70000,
  }

  // 過去7日分のレポートを生成
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    for (const booth of demoBooths) {
      const venue = demoVenues.find((v) => v.id === booth.venueId)!
      const base = baseTotals[booth.id] || 100000
      reports.push(generateReport(booth.id, booth, venue, daysAgo, base))
    }
  }

  return reports.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
}
