import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Order, OrderStatus, CartItem, PaymentMethod, OrderType } from '@/types'
import { orderService } from '@/services/orderService'

export const useOrderStore = defineStore('orders', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)
  let unsubscribe: (() => void) | null = null

  // カート（注文確定前）
  const cart = ref<CartItem[]>([])
  const orderType = ref<OrderType>('takeout')

  // ステータス別フィルタ
  const activeOrders = computed(() =>
    orders.value
      .filter((o) => !['served', 'cancelled'].includes(o.status))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  )

  const kitchenOrders = computed(() =>
    orders.value
      .filter((o) => ['paid', 'cooking'].includes(o.status))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  )

  const readyOrders = computed(() =>
    orders.value
      .filter((o) => o.status === 'ready')
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
  )

  const todayOrders = computed(() =>
    orders.value.filter((o) => {
      const today = new Date()
      return (
        o.createdAt.getDate() === today.getDate() &&
        o.createdAt.getMonth() === today.getMonth() &&
        o.createdAt.getFullYear() === today.getFullYear()
      )
    })
  )

  const todaySales = computed(() =>
    todayOrders.value
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0)
  )

  const todayOrderCount = computed(() =>
    todayOrders.value.filter((o) => o.status !== 'cancelled').length
  )

  // カート操作
  function addToCart(item: CartItem) {
    // 同一商品・同一オプションがあれば数量加算
    const existing = cart.value.find(
      (c) =>
        c.productId === item.productId &&
        JSON.stringify(c.options) === JSON.stringify(item.options) &&
        c.note === item.note
    )
    if (existing) {
      existing.quantity += item.quantity
    } else {
      cart.value.push(item)
    }
  }

  function removeFromCart(cartId: string) {
    cart.value = cart.value.filter((c) => c.cartId !== cartId)
  }

  function updateCartItemQuantity(cartId: string, quantity: number) {
    const item = cart.value.find((c) => c.cartId === cartId)
    if (item) {
      if (quantity <= 0) {
        removeFromCart(cartId)
      } else {
        item.quantity = quantity
      }
    }
  }

  function clearCart() {
    cart.value = []
  }

  const cartTotal = computed(() =>
    cart.value.reduce((sum, item) => {
      const optionTotal = item.options.reduce((os, o) => os + o.price, 0)
      return sum + (item.price + optionTotal) * item.quantity
    }, 0)
  )

  // 注文確定
  async function submitOrder(
    eventId: string,
    paymentMethod: PaymentMethod,
    createdBy: string
  ): Promise<number> {
    if (cart.value.length === 0) throw new Error('カートが空です')

    const orderNumber = await orderService.createOrder(eventId, {
      items: cart.value.map(({ productId, name, price, quantity, options, note }) => ({
        productId,
        name,
        price,
        quantity,
        options,
        note,
      })),
      totalAmount: cartTotal.value,
      paymentMethod,
      orderType: orderType.value,
      createdBy,
    })

    clearCart()
    return orderNumber
  }

  // ステータス変更
  async function updateStatus(eventId: string, orderId: string, status: OrderStatus) {
    await orderService.updateOrderStatus(eventId, orderId, status)
  }

  // リアルタイムリスナー
  function startListening(eventId: string) {
    loading.value = true
    unsubscribe = orderService.listenOrders(eventId, (updated) => {
      orders.value = updated
      loading.value = false
    })
  }

  function stopListening() {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    orders,
    loading,
    cart,
    orderType,
    activeOrders,
    kitchenOrders,
    readyOrders,
    todayOrders,
    todaySales,
    todayOrderCount,
    cartTotal,
    addToCart,
    removeFromCart,
    updateCartItemQuantity,
    clearCart,
    submitOrder,
    updateStatus,
    startListening,
    stopListening,
  }
})
