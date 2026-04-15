<script setup lang="ts">
import type { CartItem, PaymentMethod, OrderType } from '@/types'
import { formatPrice } from '@/utils/format'

const props = defineProps<{
  items: CartItem[]
  total: number
  orderType: OrderType
}>()

const emit = defineEmits<{
  updateQuantity: [cartId: string, quantity: number]
  remove: [cartId: string]
  clear: []
  submit: [paymentMethod: PaymentMethod]
  updateOrderType: [orderType: OrderType]
  updateItemOrderType: [cartId: string, orderType: OrderType]
}>()

const orderTypeLabels: Record<OrderType, string> = {
  eat_in: '店内',
  takeout: '持帰',
  goods: '物販',
}

const orderTypeShort: Record<OrderType, { label: string; color: string }> = {
  eat_in: { label: '店内', color: 'bg-blue-500 text-white' },
  takeout: { label: '持帰', color: 'bg-orange-500 text-white' },
  goods: { label: '物販', color: 'bg-gray-500 text-white' },
}

function toggleItemType(cartId: string, current: OrderType) {
  const next = current === 'eat_in' ? 'takeout' : 'eat_in'
  emit('updateItemOrderType', cartId, next)
}
</script>

<template>
  <div class="bg-white rounded-2xl shadow-lg flex flex-col h-full">
    <!-- ヘッダー -->
    <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
      <h2 class="font-bold text-lg text-gray-800">
        カート
        <span v-if="items.length" class="text-red-600">({{ items.length }})</span>
      </h2>
      <button
        v-if="items.length"
        class="text-sm text-red-500 font-medium hover:underline"
        @click="emit('clear')"
      >
        全削除
      </button>
    </div>

    <!-- 次に追加する商品のデフォルト区分 -->
    <div class="px-4 py-2 border-b border-gray-100 flex gap-2 items-center">
      <span class="text-xs text-gray-500 shrink-0">次の追加:</span>
      <button
        v-for="(label, key) in orderTypeLabels"
        :key="key"
        :class="[
          'flex-1 py-1.5 rounded-lg text-sm font-bold transition-colors',
          orderType === key
            ? 'bg-red-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        ]"
        @click="emit('updateOrderType', key as OrderType)"
      >
        {{ label }}
      </button>
    </div>

    <!-- カート内容 -->
    <div class="flex-1 overflow-y-auto px-4 py-2">
      <div v-if="items.length === 0" class="text-center text-gray-400 py-8">
        商品を選択してください
      </div>
      <div
        v-for="item in items"
        :key="item.cartId"
        class="py-3 border-b border-gray-100 last:border-0"
      >
        <div class="flex items-start gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <div class="font-bold text-gray-800 truncate">{{ item.name }}</div>
              <!-- 商品ごとの区分バッジ（タップで切替） -->
              <button
                :class="[
                  'px-2 py-0.5 rounded text-xs font-bold shrink-0 active:scale-95 transition-transform',
                  orderTypeShort[item.orderType || 'takeout'].color,
                ]"
                @click="toggleItemType(item.cartId, item.orderType || 'takeout')"
                :title="'タップで切替'"
              >
                {{ orderTypeShort[item.orderType || 'takeout'].label }}
              </button>
            </div>
            <div v-if="item.options.length" class="text-xs text-gray-500">
              {{ item.options.map((o) => o.name).join(', ') }}
            </div>
            <div v-if="item.note" class="text-xs text-orange-500">{{ item.note }}</div>
            <div class="text-red-600 font-bold">
              {{ formatPrice((item.price + item.options.reduce((s, o) => s + o.price, 0)) * item.quantity) }}
            </div>
          </div>
          <!-- 数量変更 -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              class="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg text-xl text-gray-700 font-bold flex items-center justify-center active:scale-95"
              @click="emit('updateQuantity', item.cartId, item.quantity - 1)"
            >
              −
            </button>
            <span class="w-8 text-center font-bold text-lg">{{ item.quantity }}</span>
            <button
              class="w-10 h-10 bg-gray-200 hover:bg-gray-300 rounded-lg text-xl text-gray-700 font-bold flex items-center justify-center active:scale-95"
              @click="emit('updateQuantity', item.cartId, item.quantity + 1)"
            >
              ＋
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 合計・会計ボタン -->
    <div class="px-4 py-3 border-t-2 border-gray-200 space-y-3">
      <div class="flex items-center justify-between">
        <span class="text-lg font-bold text-gray-600">合計</span>
        <span class="text-2xl font-black text-red-600">{{ formatPrice(total) }}</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          :disabled="items.length === 0"
          class="btn-touch bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-40"
          @click="emit('submit', 'cash')"
        >
          💴 現金
        </button>
        <button
          :disabled="items.length === 0"
          class="btn-touch bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-40"
          @click="emit('submit', 'cashless')"
        >
          💳 キャッシュレス
        </button>
      </div>
    </div>
  </div>
</template>
