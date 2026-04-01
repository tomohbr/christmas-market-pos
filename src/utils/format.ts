// 金額フォーマット
export function formatPrice(price: number): string {
  return `¥${price.toLocaleString()}`
}

// 時刻フォーマット（HH:MM）
export function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

// 注文番号フォーマット（3桁ゼロ埋め）
export function formatOrderNumber(num: number): string {
  return String(num).padStart(3, '0')
}

// 経過時間表示
export function formatElapsed(from: Date): string {
  const diff = Math.floor((Date.now() - from.getTime()) / 1000)
  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  return `${Math.floor(diff / 3600)}時間前`
}
