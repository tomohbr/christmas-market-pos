import type { Order, SalesReport } from '@/types'

function escCsv(val: string | number): string {
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function generateOrdersCsv(orders: Order[]): string {
  const headers = ['注文番号', '日時', '商品名', '数量', '単価', 'オプション', '小計', '支払方法', '注文種別', 'ステータス']
  const paymentLabels: Record<string, string> = { cash: '現金', cashless: 'キャッシュレス', other: 'その他' }
  const typeLabels: Record<string, string> = { eat_in: '店内', takeout: 'テイクアウト', goods: '物販' }
  const statusLabels: Record<string, string> = { paid: '会計済', cooking: '調理中', calling: '呼び出し', served: '受渡済', cancelled: '取消' }

  const rows: string[] = [headers.join(',')]

  for (const order of orders) {
    for (const item of order.items) {
      const optionNames = item.options.map((o) => o.name).join('/')
      const optionPrice = item.options.reduce((s, o) => s + o.price, 0)
      const subtotal = (item.price + optionPrice) * item.quantity
      rows.push([
        escCsv(order.orderNumber),
        escCsv(formatDateTime(order.createdAt)),
        escCsv(item.name),
        escCsv(item.quantity),
        escCsv(item.price),
        escCsv(optionNames),
        escCsv(subtotal),
        escCsv(paymentLabels[order.paymentMethod] || order.paymentMethod),
        escCsv(typeLabels[item.orderType] || item.orderType),
        escCsv(statusLabels[order.status] || order.status),
      ].join(','))
    }
  }

  return rows.join('\n')
}

export function generateSummaryOrdersCsv(orders: Order[]): string {
  const headers = ['注文番号', '日時', '合計金額', '支払方法', '注文種別', 'ステータス', '商品数']
  const paymentLabels: Record<string, string> = { cash: '現金', cashless: 'キャッシュレス', other: 'その他' }
  const typeLabels: Record<string, string> = { eat_in: '店内', takeout: 'テイクアウト', goods: '物販' }
  const statusLabels: Record<string, string> = { paid: '会計済', cooking: '調理中', calling: '呼び出し', served: '受渡済', cancelled: '取消' }

  const rows: string[] = [headers.join(',')]

  for (const order of orders) {
    const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
    rows.push([
      escCsv(order.orderNumber),
      escCsv(formatDateTime(order.createdAt)),
      escCsv(order.totalAmount),
      escCsv(paymentLabels[order.paymentMethod] || order.paymentMethod),
      escCsv(typeLabels[order.orderType] || order.orderType),
      escCsv(statusLabels[order.status] || order.status),
      escCsv(itemCount),
    ].join(','))
  }

  return rows.join('\n')
}

export function generateReportsCsv(reports: SalesReport[]): string {
  const headers = ['日付', '会場', '店舗名', '売上合計', '注文数', 'キャンセル数', '客単価', '現金売上', 'キャッシュレス売上']

  const rows: string[] = [headers.join(',')]

  for (const r of reports) {
    const cashTotal = r.salesByPayment?.cash?.total || 0
    const cashlessTotal = r.salesByPayment?.cashless?.total || 0
    rows.push([
      escCsv(r.date),
      escCsv(r.venueName),
      escCsv(r.boothName),
      escCsv(r.totalSales),
      escCsv(r.orderCount),
      escCsv(r.cancelledCount),
      escCsv(r.averagePerOrder),
      escCsv(cashTotal),
      escCsv(cashlessTotal),
    ].join(','))
  }

  return rows.join('\n')
}

export interface SettlementRow {
  boothName: string
  venueName: string
  category: string
  totalSales: number
  commission: number
  fixedFee: number
  totalFee: number
  netToBooth: number
}

export function generateSettlementCsv(rows: SettlementRow[]): string {
  const headers = ['店舗名', '会場', 'カテゴリ', '売上合計', 'マージン', '出店料', '手数料合計', '店舗取分']

  const csvRows: string[] = [headers.join(',')]

  for (const r of rows) {
    csvRows.push([
      escCsv(r.boothName),
      escCsv(r.venueName),
      escCsv(r.category),
      escCsv(r.totalSales),
      escCsv(r.commission),
      escCsv(r.fixedFee),
      escCsv(r.totalFee),
      escCsv(r.netToBooth),
    ].join(','))
  }

  return csvRows.join('\n')
}

export function downloadCsv(content: string, filename: string): void {
  // BOM付きUTF-8（Excel対応）
  const bom = '\uFEFF'
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
