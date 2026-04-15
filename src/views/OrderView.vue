<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import { useOrderStore } from '@/stores/orders'
import { useProductStore } from '@/stores/products'
import type { Product, CartItem, PaymentMethod, OrderType, OrderItemOption, Order } from '@/types'
import { formatPrice } from '@/utils/format'
import { usePrint } from '@/composables/usePrint'
import { useSettingsStore } from '@/stores/settings'
import AppHeader from '@/components/common/AppHeader.vue'
import ProductGrid from '@/components/order/ProductGrid.vue'
import CartPanel from '@/components/order/CartPanel.vue'
import ProductOptionModal from '@/components/order/ProductOptionModal.vue'
import CashPaymentModal from '@/components/order/CashPaymentModal.vue'
import OrderNumberDisplay from '@/components/common/OrderNumberDisplay.vue'
import AppModal from '@/components/common/AppModal.vue'

const authStore = useAuthStore()
const demoStore = useDemoStore()
const orderStore = useOrderStore()
const productStore = useProductStore()

const settingsStore = useSettingsStore()
const isDemo = computed(() => demoStore.isDemoMode)
const eventId = computed(() => authStore.user?.eventId || 'demo-event')

// 番号札モード
const isSelectMode = computed(() => settingsStore.settings.orderNumberMode === 'select')
const numberMax = computed(() => settingsStore.settings.orderNumberMax || 16)
const showNumberSelect = ref(false)
const pendingPaymentMethod = ref<PaymentMethod>('cash')

// 商品一覧
const products = computed(() =>
  isDemo.value ? demoStore.products : productStore.products
)
const categories = computed(() => {
  const cats = new Set(products.value.map((p) => p.category))
  return ['すべて', ...Array.from(cats).sort()]
})
const selectedCategory = ref('すべて')

const filteredProducts = computed(() => {
  const list = products.value
  if (selectedCategory.value === 'すべて') {
    return list.sort((a, b) => a.sortOrder - b.sortOrder)
  }
  return list
    .filter((p) => p.category === selectedCategory.value)
    .sort((a, b) => a.sortOrder - b.sortOrder)
})

// カート
const cart = computed(() => orderStore.cart)
const cartTotal = computed(() => orderStore.cartTotal)
const orderType = computed(() => orderStore.orderType)

// 商品選択モーダル
const showOptionModal = ref(false)
const selectedProduct = ref<Product | null>(null)

function handleProductSelect(product: Product) {
  if (!product.available) return
  if (product.options.length > 0) {
    selectedProduct.value = product
    showOptionModal.value = true
  } else {
    // オプションなし→即カートへ
    addToCartDirect(product, [], '', 1)
  }
}

function addToCartDirect(product: Product, options: OrderItemOption[], note: string, quantity: number) {
  const cartItem: CartItem = {
    cartId: `${product.id}-${Date.now()}`,
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity,
    options,
    note,
    orderType: orderType.value,
  }
  orderStore.addToCart(cartItem)
}

function handleAddFromModal(options: OrderItemOption[], note: string, quantity: number) {
  if (!selectedProduct.value) return
  addToCartDirect(selectedProduct.value, options, note, quantity)
  showOptionModal.value = false
  selectedProduct.value = null
}

function handleUpdateOrderType(type: OrderType) {
  orderStore.orderType = type
}

function handleUpdateItemOrderType(cartId: string, type: OrderType) {
  const item = cart.value.find((c) => c.cartId === cartId)
  if (item) item.orderType = type
}

// 使用中の番号（提供済み・キャンセル以外）
const usedNumbers = computed(() => {
  const orders = isDemo.value ? demoStore.orders : orderStore.orders
  return new Set(
    orders
      .filter((o) => !['served', 'cancelled'].includes(o.status))
      .map((o) => o.orderNumber)
  )
})

// 会計フロー
const showCashModal = ref(false)
const showCashlessConfirm = ref(false)
const showChangeDisplay = ref(false)  // おつり表示画面
const showOrderComplete = ref(false)  // 番号札表示画面
const completedOrderNumber = ref(0)
const completedOrder = ref<Order | null>(null)
const { printReceipt, printFormalReceipt } = usePrint()
const completedChange = ref(0)
const isSubmitting = ref(false)

// カートからの会計ボタン押下
function handlePaymentRequest(paymentMethod: PaymentMethod) {
  if (cart.value.length === 0) return
  if (paymentMethod === 'cash') {
    showCashModal.value = true
  } else {
    showCashlessConfirm.value = true
  }
}

// 現金会計モーダルで確定（おつり額を受け取る）
function handleCashConfirm(change: number) {
  showCashModal.value = false
  completedChange.value = change
  pendingPaymentMethod.value = 'cash'
  // おつりがあれば先におつり画面を表示
  if (change > 0) {
    showChangeDisplay.value = true
  } else {
    proceedToSubmit('cash')
  }
}

// キャッシュレス確認で確定
function handleCashlessConfirm() {
  showCashlessConfirm.value = false
  completedChange.value = 0
  proceedToSubmit('cashless')
}

// selectモード: 番号選択画面を出す / autoモード: 直接submitOrder
function proceedToSubmit(paymentMethod: PaymentMethod) {
  if (isSelectMode.value) {
    pendingPaymentMethod.value = paymentMethod
    showNumberSelect.value = true
  } else {
    submitOrder(paymentMethod)
  }
}

// 番号を選択して注文確定
function handleNumberSelected(num: number) {
  showNumberSelect.value = false
  submitOrder(pendingPaymentMethod.value, num)
}

async function submitOrder(paymentMethod: PaymentMethod, selectedNumber?: number) {
  if (cart.value.length === 0 || isSubmitting.value) return
  isSubmitting.value = true

  try {
    let orderNumber: number

    if (isDemo.value) {
      orderNumber = demoStore.createOrder(
        cart.value.map(({ productId, name, price, quantity, options, note, orderType: itemType }) => ({
          productId, name, price, quantity, options, note, orderType: itemType || orderType.value,
        })),
        cartTotal.value,
        paymentMethod,
        orderType.value,
        authStore.user?.uid || 'demo',
        selectedNumber,
      )
      orderStore.clearCart()
    } else {
      orderNumber = await orderStore.submitOrder(
        eventId.value,
        paymentMethod,
        authStore.user?.uid || '',
        selectedNumber,
      )
    }

    completedOrderNumber.value = orderNumber

    // 確定した注文を取得（印刷用）
    // デモモードではpush直後なので末尾から検索、Firestoreモードではリスナー経由
    const orders = isDemo.value ? demoStore.orders : orderStore.orders
    completedOrder.value = orders.find((o) => o.orderNumber === orderNumber) || null

    // デバッグ: findできなかった場合のログ
    if (!completedOrder.value) {
      console.warn('[OrderView] completedOrder not found', {
        orderNumber,
        ordersLength: orders.length,
        lastOrder: orders.length > 0 ? orders[orders.length - 1].orderNumber : 'none',
      })
      // フォールバック: 最後に追加された注文を使う
      if (orders.length > 0) {
        const last = orders[orders.length - 1]
        if (last.orderNumber === orderNumber) {
          completedOrder.value = last
        }
      }
    }

    // 注文確定後は番号札表示へ（おつりは既に表示済み）
    showOrderComplete.value = true
  } catch (e) {
    alert('注文の作成に失敗しました。もう一度お試しください。')
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

// おつり画面から次へ（番号選択 or 注文確定）
function proceedFromChange() {
  showChangeDisplay.value = false
  proceedToSubmit(pendingPaymentMethod.value)
}

/** 完了した注文を確実に取得する */
function getCompletedOrder(): Order | null {
  if (completedOrder.value) return completedOrder.value
  // まだ取れていなければ再検索
  const orders = isDemo.value ? demoStore.orders : orderStore.orders
  const found = orders.find((o) => o.orderNumber === completedOrderNumber.value) || null
  if (found) completedOrder.value = found
  return found
}

function handlePrintReceipt() {
  const order = getCompletedOrder()
  if (order) {
    printReceipt(order)
  } else {
    alert('注文データの取得に失敗しました。管理画面の履歴から再印刷してください。')
  }
}

function handlePrintFormal() {
  const order = getCompletedOrder()
  if (order) {
    printFormalReceipt(order)
  } else {
    alert('注文データの取得に失敗しました。管理画面の履歴から再印刷してください。')
  }
}

function closeOrderComplete() {
  showOrderComplete.value = false
}

// カート表示（モバイル用トグル）
const showMobileCart = ref(false)

// リスナー
onMounted(() => {
  if (!isDemo.value) {
    productStore.startListening(eventId.value)
    orderStore.startListening(eventId.value)
  }
})

onUnmounted(() => {
  productStore.stopListening()
  orderStore.stopListening()
})
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex flex-col">
    <AppHeader title="🏪 注文受付" />

    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden">
      <!-- 左: 商品一覧 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- カテゴリタブ -->
        <div class="bg-white border-b border-gray-200 px-3 py-2 flex gap-2 overflow-x-auto shrink-0">
          <button
            v-for="cat in categories"
            :key="cat"
            :class="[
              'px-4 py-2 rounded-full text-sm whitespace-nowrap font-bold select-none active:scale-95 transition-transform',
              selectedCategory === cat
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
            ]"
            @click="selectedCategory = cat"
          >
            {{ cat }}
          </button>
        </div>

        <!-- 商品グリッド -->
        <div class="flex-1 overflow-y-auto p-3 pb-20 lg:pb-3">
          <ProductGrid
            :products="filteredProducts"
            @select="handleProductSelect"
          />
        </div>
      </div>

      <!-- 右: カート（PC） -->
      <div class="hidden lg:flex w-96 border-l border-gray-200">
        <CartPanel
          :items="cart"
          :total="cartTotal"
          :order-type="orderType"
          @update-quantity="orderStore.updateCartItemQuantity"
          @remove="orderStore.removeFromCart"
          @clear="orderStore.clearCart"
          @submit="handlePaymentRequest"
          @update-order-type="handleUpdateOrderType"
          @update-item-order-type="handleUpdateItemOrderType"
        />
      </div>
    </div>

    <!-- モバイル: カートバー -->
    <div class="lg:hidden fixed bottom-0 left-0 right-0 z-40" style="padding-bottom: env(safe-area-inset-bottom)">
      <!-- カート展開時 -->
      <div
        v-if="showMobileCart"
        class="bg-white border-t-2 border-gray-200 shadow-2xl rounded-t-2xl flex flex-col"
        style="max-height: 75vh"
      >
        <div class="p-2 text-center shrink-0">
          <button
            class="w-12 h-1.5 bg-gray-300 rounded-full inline-block"
            @click="showMobileCart = false"
          />
        </div>
        <div class="flex-1 overflow-y-auto">
          <CartPanel
            :items="cart"
            :total="cartTotal"
            :order-type="orderType"
            @update-quantity="orderStore.updateCartItemQuantity"
            @remove="orderStore.removeFromCart"
            @clear="orderStore.clearCart"
            @submit="(pm: PaymentMethod) => { handlePaymentRequest(pm); showMobileCart = false; }"
            @update-order-type="handleUpdateOrderType"
            @update-item-order-type="handleUpdateItemOrderType"
          />
        </div>
      </div>

      <!-- カートバー（折りたたみ時） -->
      <button
        v-if="!showMobileCart && cart.length > 0"
        class="w-full bg-red-600 text-white py-4 px-6 flex items-center justify-between shadow-lg active:bg-red-700"
        @click="showMobileCart = true"
      >
        <span class="font-bold text-lg">
          カート ({{ cart.length }}点)
        </span>
        <span class="font-black text-xl">
          {{ cartTotal.toLocaleString() }}円
        </span>
      </button>
    </div>

    <!-- 現金会計モーダル -->
    <CashPaymentModal
      :show="showCashModal"
      :total="cartTotal"
      @confirm="(change: number) => handleCashConfirm(change)"
      @cancel="showCashModal = false"
    />

    <!-- おつり表示モーダル（番号札の前に表示） -->
    <Teleport to="body">
      <div
        v-if="showChangeDisplay"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/50" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div class="bg-green-600 text-white px-5 py-4 text-center">
            <h2 class="text-xl font-bold">おつり</h2>
          </div>
          <div class="p-8 text-center">
            <div class="text-6xl font-black text-green-700 tabular-nums mb-6">
              {{ formatPrice(completedChange) }}
            </div>
            <p class="text-gray-500 mb-6">おつりをお渡ししてください</p>
            <button
              class="btn-touch w-full bg-green-600 hover:bg-green-700 text-white rounded-xl text-xl py-4"
              @click="proceedFromChange"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- キャッシュレス確認モーダル -->
    <Teleport to="body">
      <div
        v-if="showCashlessConfirm"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/50" @click="showCashlessConfirm = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div class="bg-purple-600 text-white px-5 py-4">
            <h2 class="text-xl font-bold">キャッシュレス会計</h2>
            <div class="flex items-center justify-between mt-2">
              <span class="text-purple-200">合計金額</span>
              <span class="text-3xl font-black">{{ formatPrice(cartTotal) }}</span>
            </div>
          </div>
          <div class="p-5 space-y-4">
            <p class="text-gray-600 text-center">
              端末での決済が完了したことを確認してください
            </p>
            <div class="flex gap-3">
              <button
                class="btn-touch flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl"
                @click="showCashlessConfirm = false"
              >
                戻る
              </button>
              <button
                class="btn-touch flex-[2] bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xl"
                @click="handleCashlessConfirm"
              >
                💳 決済完了
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 番号札選択モーダル（selectモード時） -->
    <Teleport to="body">
      <div
        v-if="showNumberSelect"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/50" @click="showNumberSelect = false" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
          <div class="bg-yellow-500 text-white px-5 py-4 text-center sticky top-0">
            <h2 class="text-xl font-bold">番号札を選択</h2>
          </div>
          <div class="p-4">
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="n in numberMax"
                :key="n"
                :disabled="usedNumbers.has(n)"
                :class="[
                  'aspect-square rounded-xl text-2xl font-black flex items-center justify-center active:scale-95 transition-transform',
                  usedNumbers.has(n)
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border-2 border-yellow-300',
                ]"
                @click="handleNumberSelected(n)"
              >
                {{ n }}
              </button>
            </div>
            <p class="text-xs text-gray-400 mt-3 text-center">グレーの番号は使用中です</p>
            <button
              class="btn-touch w-full bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl mt-3"
              @click="showNumberSelect = false"
            >
              戻る
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- オプション選択モーダル -->
    <ProductOptionModal
      :show="showOptionModal"
      :product="selectedProduct"
      @close="showOptionModal = false"
      @add-to-cart="handleAddFromModal"
    />

    <!-- 注文完了 → レシート選択画面 -->
    <Teleport to="body">
      <div
        v-if="showOrderComplete"
        class="fixed inset-0 z-[100] flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/50" />
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <!-- 番号札表示 -->
          <div class="bg-green-600 text-white px-5 py-5 text-center">
            <div class="text-lg font-bold mb-1">注文完了</div>
            <div class="text-6xl font-black tabular-nums">
              #{{ completedOrderNumber.toString().padStart(3, '0') }}
            </div>
            <p class="text-green-100 text-sm mt-2">この番号札をお客様にお渡しください</p>
          </div>

          <!-- レシート印刷選択 -->
          <div class="p-5 space-y-3">
            <p class="text-center font-bold text-gray-700">レシートを印刷しますか？</p>

            <button
              class="btn-touch w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-lg py-4"
              @click="handlePrintReceipt"
            >
              レシート印刷
            </button>

            <button
              class="btn-touch w-full bg-green-600 hover:bg-green-700 text-white rounded-xl text-lg py-4"
              @click="handlePrintFormal"
            >
              領収書印刷
            </button>

            <button
              class="btn-touch w-full bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xl py-4"
              @click="closeOrderComplete"
            >
              印刷しない → 次の注文へ
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
