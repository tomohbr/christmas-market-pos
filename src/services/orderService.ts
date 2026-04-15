import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  query,
  orderBy,
  where,
  runTransaction,
  Timestamp,
  limit,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Order, OrderStatus, OrderItem, PaymentMethod, OrderType } from '@/types'

function ordersRef(eventId: string) {
  return collection(db, 'events', eventId, 'orders')
}

function todayDateKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface CreateOrderData {
  items: OrderItem[]
  totalAmount: number
  paymentMethod: PaymentMethod
  orderType: OrderType
  createdBy: string
}

export const orderService = {
  // 注文番号をatomicに採番して注文を作成
  async createOrder(eventId: string, data: CreateOrderData, selectedNumber?: number): Promise<number> {
    const counterRef = doc(db, 'events', eventId, 'dailyCounters', todayDateKey())

    const orderNumber = await runTransaction(db, async (transaction) => {
      let nextNumber: number

      if (selectedNumber != null) {
        // 手動選択モード: カウンターは更新せず選択番号を使用
        nextNumber = selectedNumber
      } else {
        // 自動採番モード
        const counterDoc = await transaction.get(counterRef)
        if (counterDoc.exists()) {
          nextNumber = counterDoc.data().lastOrderNumber + 1
          transaction.update(counterRef, { lastOrderNumber: nextNumber })
        } else {
          nextNumber = 1
          transaction.set(counterRef, { lastOrderNumber: 1 })
        }
      }

      const orderRef = doc(ordersRef(eventId))
      const now = Timestamp.now()
      transaction.set(orderRef, {
        orderNumber: nextNumber,
        status: 'paid' as OrderStatus,
        items: data.items,
        totalAmount: data.totalAmount,
        paymentMethod: data.paymentMethod,
        orderType: data.orderType,
        createdAt: now,
        updatedAt: now,
        servedAt: null,
        createdBy: data.createdBy,
        eventId,
      })

      return nextNumber
    })

    return orderNumber
  },

  async updateOrderStatus(eventId: string, orderId: string, status: OrderStatus): Promise<void> {
    const ref = doc(db, 'events', eventId, 'orders', orderId)
    const updates: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now(),
    }
    if (status === 'served') {
      updates.servedAt = Timestamp.now()
    }
    await updateDoc(ref, updates)
  },

  // 当日の注文をリアルタイム監視（served/cancelledも含めて直近のものを取得）
  listenOrders(eventId: string, callback: (orders: Order[]) => void): () => void {
    // 当日の0時を起点にフィルタ
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const q = query(
      ordersRef(eventId),
      where('createdAt', '>=', Timestamp.fromDate(todayStart)),
      orderBy('createdAt', 'asc'),
      limit(500) // 1日500注文を上限（クリスマスマーケットブースには十分）
    )

    return onSnapshot(q, (snapshot) => {
      const orders: Order[] = snapshot.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          orderNumber: data.orderNumber,
          status: data.status,
          items: data.items,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          orderType: data.orderType,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          servedAt: data.servedAt?.toDate() || null,
          createdBy: data.createdBy,
          eventId: data.eventId,
        } as Order
      })
      callback(orders)
    })
  },

  // 全注文取得（売上集計用）
  listenAllOrders(eventId: string, callback: (orders: Order[]) => void): () => void {
    const q = query(
      ordersRef(eventId),
      orderBy('createdAt', 'desc'),
      limit(1000)
    )

    return onSnapshot(q, (snapshot) => {
      const orders: Order[] = snapshot.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          orderNumber: data.orderNumber,
          status: data.status,
          items: data.items,
          totalAmount: data.totalAmount,
          paymentMethod: data.paymentMethod,
          orderType: data.orderType,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          servedAt: data.servedAt?.toDate() || null,
          createdBy: data.createdBy,
          eventId: data.eventId,
        } as Order
      })
      callback(orders)
    })
  },
}
