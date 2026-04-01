<script setup lang="ts">
import { ref } from 'vue'
import type { Order, OrderStatus } from '@/types'
import { formatOrderNumber, formatTime } from '@/utils/format'

defineProps<{
  servedOrders: Order[]
}>()

const emit = defineEmits<{
  revert: [orderId: string, toStatus: OrderStatus]
}>()

const isOpen = ref(false)

// 戻し確認中の注文ID
const revertingId = ref<string | null>(null)

function handleRevert(order: Order) {
  // cooking に戻す（受渡し済みを取り消す）
  emit('revert', order.id, 'cooking')
  revertingId.value = null
}
</script>

<template>
  <!-- 履歴ボタン（常時表示） -->
  <div class="fixed bottom-0 left-0 right-0 z-40">
    <!-- パネル本体 -->
    <div
      v-if="isOpen"
      class="bg-white border-t-2 border-gray-300 shadow-2xl rounded-t-2xl"
      style="max-height: 50vh"
    >
      <!-- ハンドル + ヘッダー -->
      <div class="sticky top-0 bg-white rounded-t-2xl z-10">
        <div class="pt-2 pb-1 text-center">
          <button
            class="w-12 h-1.5 bg-gray-300 rounded-full inline-block"
            @click="isOpen = false"
          />
        </div>
        <div class="px-4 pb-2 flex items-center justify-between border-b border-gray-200">
          <h3 class="font-bold text-gray-800 text-lg">受渡し履歴</h3>
          <span class="text-sm text-gray-500">{{ servedOrders.length }}件</span>
        </div>
      </div>

      <!-- 履歴リスト -->
      <div class="overflow-y-auto px-4 py-2" style="max-height: calc(50vh - 70px)">
        <div v-if="servedOrders.length === 0" class="text-center text-gray-400 py-8">
          まだ履歴はありません
        </div>
        <div
          v-for="order in servedOrders"
          :key="order.id"
          class="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0"
        >
          <!-- 番号 + 内容 -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-xl font-black text-gray-400 tabular-nums">
                #{{ formatOrderNumber(order.orderNumber) }}
              </span>
              <span class="text-xs text-gray-400">
                {{ order.servedAt ? formatTime(order.servedAt) : '' }}
              </span>
            </div>
            <div class="text-sm text-gray-500 truncate">
              {{ order.items.map((i) => `${i.name}×${i.quantity}`).join(', ') }}
            </div>
          </div>

          <!-- 戻すボタン -->
          <div class="shrink-0">
            <button
              v-if="revertingId !== order.id"
              class="btn-touch px-3 min-h-[40px] bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-xl text-sm font-bold"
              @click="revertingId = order.id"
            >
              ↩ 戻す
            </button>
            <!-- 確認状態 -->
            <div v-else class="flex gap-1">
              <button
                class="btn-touch px-3 min-h-[40px] bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-lg text-sm"
                @click="revertingId = null"
              >
                やめる
              </button>
              <button
                class="btn-touch px-3 min-h-[40px] bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-bold"
                @click="handleRevert(order)"
              >
                戻す
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- トグルボタン（パネル閉じている時） -->
    <button
      v-if="!isOpen"
      class="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-6 flex items-center justify-center gap-2 shadow-lg"
      @click="isOpen = true"
    >
      <span class="font-bold">📋 受渡し履歴</span>
      <span v-if="servedOrders.length" class="bg-gray-500 text-white text-sm px-2 py-0.5 rounded-full">
        {{ servedOrders.length }}
      </span>
    </button>
  </div>
</template>
