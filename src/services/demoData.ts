import type { Product, Order, OrderStatus } from '@/types'

// デモモード用のサンプルデータ
// Firebase未接続時でも画面確認・操作テストができるようにする

export const demoProducts: Product[] = [
  {
    id: 'p1',
    name: 'グリューワイン',
    price: 800,
    category: 'ドリンク',
    sortOrder: 1,
    available: true,
    stock: null,
    options: [
      { id: 'opt1', name: 'シナモン追加', price: 100 },
    ],
    productType: 'drink',
    description: 'スパイス香る温かいワイン',
    imageUrl: '',
  },
  {
    id: 'p2',
    name: 'ホットチョコレート',
    price: 600,
    category: 'ドリンク',
    sortOrder: 2,
    available: true,
    stock: null,
    options: [
      { id: 'opt2', name: 'マシュマロ追加', price: 100 },
      { id: 'opt3', name: 'ホイップ追加', price: 150 },
    ],
    productType: 'drink',
    description: '濃厚なホットチョコ',
    imageUrl: '',
  },
  {
    id: 'p3',
    name: 'シュトーレン（1切れ）',
    price: 500,
    category: 'フード',
    sortOrder: 3,
    available: true,
    stock: 30,
    options: [],
    productType: 'food',
    description: 'ドイツの伝統菓子パン',
    imageUrl: '',
  },
  {
    id: 'p4',
    name: 'ソーセージプレート',
    price: 1000,
    category: 'フード',
    sortOrder: 4,
    available: true,
    stock: 50,
    options: [
      { id: 'opt4', name: 'マスタード追加', price: 0 },
      { id: 'opt5', name: 'ザワークラウト追加', price: 200 },
    ],
    productType: 'food',
    description: '本格ドイツソーセージ3種盛り',
    imageUrl: '',
  },
  {
    id: 'p5',
    name: 'レープクーヘン',
    price: 400,
    category: 'フード',
    sortOrder: 5,
    available: true,
    stock: 40,
    options: [],
    productType: 'food',
    description: 'スパイスクッキー',
    imageUrl: '',
  },
  {
    id: 'p6',
    name: 'クリスマスオーナメント',
    price: 1200,
    category: '物販',
    sortOrder: 6,
    available: true,
    stock: 20,
    options: [],
    productType: 'goods',
    description: '手作り木製オーナメント',
    imageUrl: '',
  },
  {
    id: 'p7',
    name: 'ホットアップルサイダー',
    price: 700,
    category: 'ドリンク',
    sortOrder: 7,
    available: true,
    stock: null,
    options: [],
    productType: 'drink',
    description: '温かいりんごジュース',
    imageUrl: '',
  },
  {
    id: 'p8',
    name: 'プレッツェル',
    price: 450,
    category: 'フード',
    sortOrder: 8,
    available: false, // 売り切れサンプル
    stock: 0,
    options: [
      { id: 'opt6', name: 'チーズディップ', price: 200 },
    ],
    productType: 'food',
    description: 'ドイツ式焼きたてプレッツェル',
    imageUrl: '',
  },
]

let demoOrderCounter = 0

export function createDemoOrder(overrides: Partial<Order> = {}): Order {
  demoOrderCounter++
  return {
    id: `demo-order-${demoOrderCounter}`,
    orderNumber: demoOrderCounter,
    status: 'paid' as OrderStatus,
    items: [],
    totalAmount: 0,
    paymentMethod: 'cash',
    orderType: 'takeout',
    createdAt: new Date(),
    updatedAt: new Date(),
    servedAt: null,
    createdBy: 'demo-cashier',
    eventId: 'demo-event',
    ...overrides,
  }
}

export function resetDemoCounter() {
  demoOrderCounter = 0
}
