<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import { useOrderStore } from '@/stores/orders'
import { useProductStore } from '@/stores/products'
import type { Product, CartItem, PaymentMethod, OrderType, OrderItemOption } from '@/types'
import { formatPrice } from '@/utils/format'
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

const isDemo = computed(() => demoStore.isDemoMode)
const eventId = computed(() => authStore.user?.eventId || 'demo-event')

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

// 会計フロー
const showCashModal = ref(false)
const showCashlessConfirm = ref(false)
const showChangeDisplay = ref(false)  // おつり表示画面
const showOrderComplete = ref(false)  // 番号札表示画面
const completedOrderNumber = ref(0)
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
  submitOrder('cash')
}

// キャッシュレス確認で確定
function handleCashlessConfirm() {
  showCashlessConfirm.value = false
  completedChange.value = 0
  submitOrder('cashless')
}

async function submitOrder(paymentMethod: PaymentMethod) {
  if (cart.value.length === 0 || isSubmitting.value) return
  isSubmitting.value = true

  try {
    let orderNumber: number

    if (isDemo.value) {
      orderNumber = demoStore.createOrder(
        cart.value.map(({ productId, name, price, quantity, options, note }) => ({
          productId, name, price, quantity, options, note,
        })),
        cartTotal.value,
        paymentMethod,
        orderType.value,
        authStore.user?.uid || 'demo',
      )
      orderStore.clearCart()
    } else {
      orderNumber = await orderStore.submitOrder(
        eventId.value,
        paymentMethod,
        authStore.user?.uid || '',
      )
    }

    completedOrderNumber.value = orderNumber

    // おつりがあればおつり画面→番号札、なければ直接番号札
    if (completedChange.value > 0) {
      showChangeDisplay.value = true
    } else {
      showOrderComplete.value = true
    }
  } catch (e) {
    alert('注文の作成に失敗しました。もう一度お試しください。')
    console.error(e)
  } finally {
    isSubmitting.value = false
  }
}

// おつり画面から番号札画面へ
function proceedToOrderNumber() {
  showChangeDisplay.value = false
  showOrderComplete.value = true
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

    <div class="flex-1 flex flex-col lg:flex-row">
      <!-- 左: 商品一覧 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- カテゴリタブ -->
        <div class="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
          <button
            v-for="cat in categories"
            :key="cat"
            :class="[
              'btn-touch px-4 py-2 rounded-full text-sm whitespace-nowrap',
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
        <div class="flex-1 overflow-y-auto p-4">
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
        />
      </div>
    </div>

    <!-- モバイル: カートバー -->
    <div class="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      <!-- カート展開時 -->
      <div
        v-if="showMobileCart"
        class="bg-white border-t-2 border-gray-200 shadow-2xl rounded-t-2xl max-h-[70vh] flex flex-col"
      >
        <div class="p-2 text-center">
          <button
            class="w-12 h-1.5 bg-gray-300 rounded-full inline-block"
            @click="showMobileCart = false"
          />
        </div>
        <CartPanel
          :items="cart"
          :total="cartTotal"
          :order-type="orderType"
          @update-quantity="orderStore.updateCartItemQuantity"
          @remove="orderStore.removeFromCart"
          @clear="orderStore.clearCart"
          @submit="(pm: PaymentMethod) => { handlePaymentRequest(pm); showMobileCart = false; }"
          @update-order-type="handleUpdateOrderType"
        />
      </div>

      <!-- カートバー（折りたたみ時） -->
      <button
        v-if="!showMobileCart"
        class="w-full bg-red-600 text-white py-4 px-6 flex items-center justify-between shadow-lg"
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
              @click="proceedToOrderNumber"
            >
              OK → 番号札へ
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

    <!-- オプション選択モーダル -->
    <ProductOptionModal
      :show="showOptionModal"
      :product="selectedProduct"
      @close="showOptionModal = false"
      @add-to-cart="handleAddFromModal"
    />

    <!-- 注文完了モーダル -->
    <AppModal
      :show="showOrderComplete"
      title="注文完了"
      @close="closeOrderComplete"
    >
      <div class="text-center py-4">
        <div class="text-green-500 text-5xl mb-4">✓</div>
        <p class="text-gray-600 mb-4">この番号札をお客様にお渡しください</p>
        <OrderNumberDisplay
          :order-number="completedOrderNumber"
          size="lg"
        />
        <button
          class="btn-touch w-full bg-red-600 hover:bg-red-700 text-white rounded-xl mt-6 text-xl py-4"
          @click="closeOrderComplete"
        >
          次の注文へ
        </button>
      </div>
    </AppModal>
  </div>
</template>
