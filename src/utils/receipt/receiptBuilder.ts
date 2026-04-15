/**
 * Canvas ベースのレシート / 領収書 PDF 生成
 * MP-B20 (58mm) 最適化。全関数 async（ロゴ画像読み込みのため）。
 */
import { jsPDF } from 'jspdf'
import type { Order } from '@/types'
import type { ShopInfo } from '@/stores/settings'
import { formatPrice, formatOrderNumber, formatTime } from '@/utils/format'

const CANVAS_WIDTH = 576
const FONT_FAMILY = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif'
const F = {
  SHOP: `bold 40px ${FONT_FAMILY}`,
  TITLE: `bold 48px ${FONT_FAMILY}`,
  ITEM: `bold 24px ${FONT_FAMILY}`,
  DETAIL: `22px ${FONT_FAMILY}`,
  LABEL: `22px ${FONT_FAMILY}`,
  LABEL_BOLD: `bold 22px ${FONT_FAMILY}`,
  TOTAL: `bold 36px ${FONT_FAMILY}`,
  SMALL: `18px ${FONT_FAMILY}`,
  FOOTER: `22px ${FONT_FAMILY}`,
}
const PAD = 16

// ---- 型 ----

export interface ReceiptConfig {
  shopName: string; companyName: string; postalCode: string; address: string
  phone: string; invoiceNumber: string; taxRate: number; footerText: string
  logoDataUri: string
}

export interface ManualReceiptItem { name: string; amount: number }
export interface ManualReceiptParams {
  items: ManualReceiptItem[]; totalAmount: number
  paymentMethod?: string; buyerName?: string; note?: string
}

const DEFAULT_CONFIG: ReceiptConfig = {
  shopName: 'Glühwein POS', companyName: '', postalCode: '', address: '',
  phone: '', invoiceNumber: '', taxRate: 0.10,
  footerText: 'ありがとうございました', logoDataUri: '',
}

export function shopInfoToReceiptConfig(info: ShopInfo, logoDataUri?: string): ReceiptConfig {
  return {
    shopName: info.shopName || DEFAULT_CONFIG.shopName,
    companyName: info.companyName, postalCode: info.postalCode,
    address: info.address, phone: info.phone,
    invoiceNumber: info.invoiceNumber, taxRate: info.taxRate,
    footerText: info.footerText || DEFAULT_CONFIG.footerText,
    logoDataUri: logoDataUri || '',
  }
}

// ==========================================================
// 1. テスト印刷
// ==========================================================
export async function buildTestReceiptPdf(config?: ReceiptConfig): Promise<string> {
  const c = config || DEFAULT_CONFIG
  const ctx = createCtx()
  let y = 16
  y = await drawLogo(ctx, y, c.logoDataUri)
  y = drawDoubleLine(ctx, y)
  y = center(ctx, c.shopName, y, F.SHOP)
  if (c.invoiceNumber) y = center(ctx, c.invoiceNumber, y, F.SMALL)
  y = drawDoubleLine(ctx, y)
  y += 8
  y = center(ctx, 'テスト印刷', y, F.TITLE)
  y += 4
  y = center(ctx, new Date().toLocaleString('ja-JP'), y, F.DETAIL)
  y += 4
  y = center(ctx, 'プリンター接続 OK', y, F.LABEL_BOLD)
  y += 8
  y = drawDoubleLine(ctx, y)
  y += 16
  return toPdfBase64(ctx, y)
}

// ==========================================================
// 2. レシート
// ==========================================================
export async function buildOrderReceiptPdf(order: Order, config?: ReceiptConfig): Promise<string> {
  const c = config || DEFAULT_CONFIG
  const ctx = createCtx()
  let y = 10

  y = await drawShopHeader(ctx, y, c)
  y += 4
  y = center(ctx, 'レ シ ー ト', y, F.TITLE)
  y += 2
  y = drawOrderMeta(ctx, y, order)
  y = drawDashLine(ctx, y)
  y = drawOrderItems(ctx, y, order)
  y = drawDashLine(ctx, y)
  y = drawTotals(ctx, y, order.totalAmount, c.taxRate)
  y = drawPayment(ctx, y, order.paymentMethod)
  y = drawDoubleLine(ctx, y)
  y = drawTaxBreakdown(ctx, y, order.totalAmount, c.taxRate)
  y = drawDoubleLine(ctx, y)
  y += 6
  y = center(ctx, c.footerText, y, F.FOOTER)
  y += 20
  return toPdfBase64(ctx, y)
}

// ==========================================================
// 3. 領収書
// ==========================================================
export async function buildFormalReceiptPdf(order: Order, config?: ReceiptConfig, buyerName?: string): Promise<string> {
  const c = config || DEFAULT_CONFIG
  const ctx = createCtx()
  let y = 10

  y = await drawShopHeader(ctx, y, c)
  y += 4
  y = center(ctx, '領 収 書', y, F.TITLE)
  y += 4
  if (buyerName) { y = center(ctx, `${buyerName} 様`, y, F.LABEL_BOLD); y += 2 }
  y = drawOrderMeta(ctx, y, order)
  y += 4
  y = drawBigTotal(ctx, y, order.totalAmount)
  y += 4
  y = center(ctx, '但し 上記正に領収いたしました', y, F.SMALL)
  y += 4
  y = drawDashLine(ctx, y)
  y = drawOrderItems(ctx, y, order)
  y = drawDashLine(ctx, y)
  y = drawTotals(ctx, y, order.totalAmount, c.taxRate)
  y = drawPayment(ctx, y, order.paymentMethod)
  y = drawDoubleLine(ctx, y)
  y = drawTaxBreakdown(ctx, y, order.totalAmount, c.taxRate)
  y = drawDoubleLine(ctx, y)
  y += 6
  y = center(ctx, c.footerText, y, F.FOOTER)
  y += 20
  return toPdfBase64(ctx, y)
}

// ==========================================================
// 4. 自由入力領収書
// ==========================================================
export async function buildManualReceiptPdf(params: ManualReceiptParams, config?: ReceiptConfig, buyerName?: string): Promise<string> {
  const c = config || DEFAULT_CONFIG
  const ctx = createCtx()
  let y = 10

  y = await drawShopHeader(ctx, y, c)
  y += 4
  y = center(ctx, '領 収 書', y, F.TITLE)
  y += 4
  if (buyerName) { y = center(ctx, `${buyerName} 様`, y, F.LABEL_BOLD); y += 2 }

  const now = new Date()
  y = center(ctx, `${now.toLocaleDateString('ja-JP')} ${formatTime(now)}`, y, F.LABEL)
  y += 4
  y = drawBigTotal(ctx, y, params.totalAmount)
  y += 4
  y = center(ctx, '但し 上記正に領収いたしました', y, F.SMALL)
  y += 4
  y = drawDashLine(ctx, y)

  for (const item of params.items) {
    if (item.name && item.amount > 0) {
      y = drawLeft(ctx, item.name, PAD, y, F.ITEM)
      y = drawRight(ctx, formatPrice(item.amount), y, F.DETAIL)
    }
  }
  if (params.items.length > 0) y = drawDashLine(ctx, y)

  y = drawTotals(ctx, y, params.totalAmount, c.taxRate)

  if (params.paymentMethod) {
    const label = PAYMENT_LABELS[params.paymentMethod] || params.paymentMethod
    y = drawLeft(ctx, '支払方法', PAD, y, F.LABEL)
    y = drawRight(ctx, label, y, F.LABEL)
  }
  if (params.note) {
    y += 2
    y = drawLeft(ctx, '但書', PAD, y, F.SMALL)
    y = drawLeft(ctx, `  ${params.note}`, PAD, y, F.SMALL)
  }

  y = drawDoubleLine(ctx, y)
  y = drawTaxBreakdown(ctx, y, params.totalAmount, c.taxRate)
  y = drawDoubleLine(ctx, y)
  y += 6
  y = center(ctx, c.footerText, y, F.FOOTER)
  y += 20
  return toPdfBase64(ctx, y)
}

// ==========================================================
// 共通描画パーツ
// ==========================================================

const PAYMENT_LABELS: Record<string, string> = {
  cash: '現金', cashless: 'キャッシュレス', other: 'その他',
}

/** ロゴ画像を描画（data URIがあれば） */
async function drawLogo(ctx: CanvasRenderingContext2D, y: number, dataUri: string): Promise<number> {
  if (!dataUri) return y
  try {
    const img = await loadImage(dataUri)
    // 最大幅: Canvas幅の60%、最大高さ: 120px
    const maxW = CANVAS_WIDTH * 0.6
    const maxH = 120
    let w = img.width
    let h = img.height
    if (w > maxW) { h = h * (maxW / w); w = maxW }
    if (h > maxH) { w = w * (maxH / h); h = maxH }
    const x = (CANVAS_WIDTH - w) / 2
    ctx.drawImage(img, x, y, w, h)
    return y + h + 8
  } catch (e) {
    console.warn('[Receipt] ロゴ読み込み失敗:', e)
    return y
  }
}

/** data URI → HTMLImageElement (Promise) */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** 店舗ヘッダー（ロゴ含む） */
async function drawShopHeader(ctx: CanvasRenderingContext2D, y: number, c: ReceiptConfig): Promise<number> {
  y = await drawLogo(ctx, y, c.logoDataUri)
  y = drawDoubleLine(ctx, y)
  y = center(ctx, c.shopName, y, F.SHOP)
  if (c.companyName && c.companyName !== c.shopName) y = center(ctx, c.companyName, y, F.SMALL)
  if (c.postalCode) y = center(ctx, `〒${c.postalCode}`, y, F.SMALL)
  if (c.address) y = center(ctx, c.address, y, F.SMALL)
  if (c.phone) y = center(ctx, `TEL ${c.phone}`, y, F.SMALL)
  if (c.invoiceNumber) { y += 2; y = center(ctx, `登録番号: ${c.invoiceNumber}`, y, F.SMALL) }
  y = drawDoubleLine(ctx, y)
  return y
}

function drawOrderMeta(ctx: CanvasRenderingContext2D, y: number, order: Order): number {
  const dateStr = order.createdAt.toLocaleDateString('ja-JP')
  const timeStr = formatTime(order.createdAt)
  y = drawLeft(ctx, `${dateStr} ${timeStr}`, PAD, y, F.LABEL)
  y = drawRight(ctx, `#${formatOrderNumber(order.orderNumber)}`, y, F.LABEL)
  return y
}

function drawOrderItems(ctx: CanvasRenderingContext2D, y: number, order: Order): number {
  for (const item of order.items) {
    const typeTag = item.orderType === 'eat_in' ? ' [店内]'
      : item.orderType === 'takeout' ? ' [持帰]' : ''
    y = drawWrappedText(ctx, `${item.name}${typeTag}`, PAD, y, F.ITEM, CANVAS_WIDTH - PAD * 2)

    const optTotal = item.options.reduce((s, o) => s + o.price, 0)
    const unitPrice = item.price + optTotal
    const subtotal = unitPrice * item.quantity
    y = drawLeft(ctx, `  ${item.quantity} x @${formatPrice(unitPrice)}`, PAD, y, F.DETAIL)
    y = drawRight(ctx, formatPrice(subtotal), y, F.DETAIL)

    for (const opt of item.options) {
      if (opt.price > 0) {
        y = drawLeft(ctx, `  + ${opt.name}`, PAD, y, F.SMALL)
        y = drawRight(ctx, `+${formatPrice(opt.price)}`, y, F.SMALL)
      } else {
        y = drawLeft(ctx, `  + ${opt.name}`, PAD, y, F.SMALL)
      }
    }
    if (item.note) {
      y = drawWrappedText(ctx, `  ※${item.note}`, PAD, y, F.SMALL, CANVAS_WIDTH - PAD * 2)
    }
    y += 8
  }
  return y
}

function drawTotals(ctx: CanvasRenderingContext2D, y: number, totalAmount: number, taxRate: number): number {
  const rate = taxRate || 0.10
  const pct = Math.round(rate * 100)
  const tax = Math.floor(totalAmount * rate / (1 + rate))
  const pre = totalAmount - tax

  y = drawLeft(ctx, '小計', PAD, y, F.LABEL)
  y = drawRight(ctx, formatPrice(pre), y, F.LABEL)
  y = drawLeft(ctx, `消費税(${pct}%)`, PAD, y, F.LABEL)
  y = drawRight(ctx, formatPrice(tax), y, F.LABEL)
  y += 4
  y = drawDashLine(ctx, y)
  y = drawLeft(ctx, '合計(税込)', PAD, y, F.TOTAL)
  y = drawRight(ctx, formatPrice(totalAmount), y, F.TOTAL)
  y += 4
  y = drawDashLine(ctx, y)
  return y
}

function drawPayment(ctx: CanvasRenderingContext2D, y: number, method: string): number {
  const label = PAYMENT_LABELS[method]
  if (label) {
    y = drawLeft(ctx, '支払方法', PAD, y, F.LABEL)
    y = drawRight(ctx, label, y, F.LABEL)
    y += 2
  }
  return y
}

function drawBigTotal(ctx: CanvasRenderingContext2D, y: number, amount: number): number {
  ctx.font = F.TITLE
  const text = formatPrice(amount)
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent || 24
  const desc = m.actualBoundingBoxDescent || 6
  const x = (CANVAS_WIDTH - m.width) / 2
  ctx.fillText(text, x, y + asc)
  ctx.save()
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x - 4, y + asc + desc + 4)
  ctx.lineTo(x + m.width + 4, y + asc + desc + 4)
  ctx.stroke()
  ctx.restore()
  return y + asc + desc + 12
}

function drawTaxBreakdown(ctx: CanvasRenderingContext2D, y: number, totalAmount: number, taxRate: number): number {
  const rate = taxRate || 0.10
  const pct = Math.round(rate * 100)
  const tax = Math.floor(totalAmount * rate / (1 + rate))
  y += 2
  y = drawLeft(ctx, `${pct}%対象`, PAD, y, F.SMALL)
  y = drawRight(ctx, formatPrice(totalAmount), y, F.SMALL)
  y = drawLeft(ctx, '(内消費税', PAD, y, F.SMALL)
  y = drawRight(ctx, `${formatPrice(tax)})`, y, F.SMALL)
  return y
}

// ==========================================================
// Canvas ユーティリティ
// ==========================================================

function createCtx(): CanvasRenderingContext2D {
  const c = document.createElement('canvas')
  c.width = CANVAS_WIDTH; c.height = 3000
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = 'black'
  return ctx
}

function drawLeft(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string): number {
  ctx.font = font
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent || 12
  const desc = m.actualBoundingBoxDescent || 3
  ctx.fillText(text, x, y + asc)
  return y + asc + desc + 4
}

function drawRight(ctx: CanvasRenderingContext2D, text: string, y: number, font: string): number {
  ctx.font = font
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent || 12
  const desc = m.actualBoundingBoxDescent || 3
  ctx.fillText(text, CANVAS_WIDTH - PAD - m.width, y + asc)
  return y + asc + desc + 4
}

function center(ctx: CanvasRenderingContext2D, text: string, y: number, font: string): number {
  ctx.font = font
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent || 12
  const desc = m.actualBoundingBoxDescent || 3
  ctx.fillText(text, (CANVAS_WIDTH - m.width) / 2, y + asc)
  return y + asc + desc + 4
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, maxWidth: number): number {
  ctx.font = font
  const m = ctx.measureText(text)
  const asc = m.actualBoundingBoxAscent || 12
  const desc = m.actualBoundingBoxDescent || 3
  const lineH = asc + desc + 4
  if (m.width <= maxWidth) { ctx.fillText(text, x, y + asc); return y + lineH }
  let line = ''
  for (const ch of text) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      ctx.fillText(line, x, y + asc); y += lineH; line = ch
    } else { line = test }
  }
  if (line) { ctx.fillText(line, x, y + asc); y += lineH }
  return y
}

function drawDoubleLine(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y); ctx.lineTo(CANVAS_WIDTH - PAD, y)
  ctx.moveTo(PAD, y + 3); ctx.lineTo(CANVAS_WIDTH - PAD, y + 3)
  ctx.stroke(); ctx.restore()
  return y + 10
}

function drawDashLine(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.save(); ctx.setLineDash([4, 3]); ctx.strokeStyle = '#000'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(CANVAS_WIDTH - PAD, y)
  ctx.stroke(); ctx.restore()
  return y + 8
}

function toPdfBase64(ctx: CanvasRenderingContext2D, h: number): string {
  const src = ctx.canvas
  const trim = document.createElement('canvas')
  trim.width = CANVAS_WIDTH; trim.height = h
  trim.getContext('2d')!.drawImage(src, 0, 0, CANVAS_WIDTH, h, 0, 0, CANVAS_WIDTH, h)
  const img = trim.toDataURL('image/png')
  const pdfW = 164; const pdfH = (h / CANVAS_WIDTH) * pdfW
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [pdfW, pdfH] })
  doc.addImage(img, 'PNG', 0, 0, pdfW, pdfH)
  return doc.output('datauristring').split(',')[1]
}
