// === ロール・認証 ===
export type UserRole = 'admin' | 'cashier' | 'kitchen' | 'handover' | 'organizer'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  eventId: string
}

// === 商品 ===
export type ProductType = 'food' | 'drink' | 'goods'

export interface ProductOption {
  id: string
  name: string
  price: number
}

export interface Product {
  id: string
  name: string
  price: number
  category: string
  sortOrder: number
  available: boolean
  stock: number | null // nullなら無制限
  options: ProductOption[]
  productType: ProductType
  description: string
  imageUrl: string
}

// === 注文 ===
export type OrderStatus = 'paid' | 'cooking' | 'calling' | 'served' | 'cancelled'
export type PaymentMethod = 'cash' | 'cashless' | 'other'
export type OrderType = 'eat_in' | 'takeout' | 'goods'

export interface OrderItemOption {
  name: string
  price: number
}

export interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
  options: OrderItemOption[]
  note: string
  orderType: OrderType  // 商品ごとの店内/テイクアウト区分
}

// カート用（注文確定前）
export interface CartItem extends OrderItem {
  cartId: string // カート内の一意識別子
}

export interface Order {
  id: string
  orderNumber: number
  status: OrderStatus
  items: OrderItem[]
  totalAmount: number
  paymentMethod: PaymentMethod
  orderType: OrderType  // 注文全体のデフォルト（後方互換）
  createdAt: Date
  updatedAt: Date
  servedAt: Date | null
  createdBy: string
  eventId: string
}

// === イベント ===
export type EventStatus = 'upcoming' | 'active' | 'ended'

export interface EventInfo {
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: EventStatus
  settings: EventSettings
}

export interface EventSettings {
  boothName: string
  currency: string
  taxRate: number
}

// === 日次カウンター ===
export interface DailyCounter {
  lastOrderNumber: number
}

// === カテゴリ一覧（表示用） ===
export interface Category {
  id: string
  name: string
  sortOrder: number
}

// === 曜日別料金設定 ===
// 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土
export interface DayRate {
  dayOfWeek: number // 0-6
  commissionRate: number // マージン率 (0.0 ~ 1.0)
  fixedFee: number // 固定出店料
}

// === 会場・店舗（主催者向け） ===
export interface Venue {
  id: string
  name: string
  location: string
  defaultCommissionRate: number // デフォルトマージン率
  defaultFixedFee: number // デフォルト出店料
  dayRates: DayRate[] // 曜日別料金（設定がない曜日はデフォルト適用）
}

export interface Booth {
  id: string
  venueId: string
  name: string
  category: string // 飲食, 物販, etc
  commissionRate: number // マージン率 (0.0 ~ 1.0) — ブース個別上書き、nullなら会場デフォルト
  fixedFee: number // 固定出店料 — ブース個別上書き、nullなら会場デフォルト
  useVenueRate: boolean // trueなら会場の設定を使う
}

// === 特定日の料金オーバーライド ===
export interface RateOverride {
  id: string
  date: string // YYYY-MM-DD
  boothId: string | null // nullなら全店舗に適用
  venueId: string // 会場単位
  commissionRate: number | null // nullなら変更なし
  fixedFee: number | null // nullなら変更なし
  reason: string // 変更理由（例: 「悪天候のため減額」「トラブル対応」）
}

// === 売上レポート ===
export interface SalesReport {
  id: string
  boothId: string
  boothName: string
  venueId: string
  venueName: string
  date: string // YYYY-MM-DD
  sentAt: Date
  sentBy: string
  totalSales: number
  orderCount: number
  cancelledCount: number
  averagePerOrder: number
  salesByPayment: Record<string, { count: number; total: number }>
  salesByProduct: { name: string; count: number; total: number }[]
  salesByHour: { hour: number; count: number; total: number }[]
  note: string
}
