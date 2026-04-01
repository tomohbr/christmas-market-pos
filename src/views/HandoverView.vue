<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import { useOrderStore } from '@/stores/orders'
import type { OrderStatus } from '@/types'
import { formatOrderNumber, formatTime } from '@/utils/format'
import AppHeader from '@/components/common/AppHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ServedHistoryPanel from '@/components/common/ServedHistoryPanel.vue'
import { ref } from 'vue'

const authStore = useAuthStore()
const demoStore = useDemoStore()
const orderStore = useOrderStore()

const isDemo = computed(() => demoStore.isDemoMode)
const eventId = computed(() => authStore.user?.eventId || 'demo-event')

// 完成（受渡し待ち）注文
const readyOrders = computed(() =>
  isDemo.value ? demoStore.readyOrders : orderStore.readyOrders
)

// 提供済み履歴（直近20件）
const servedOrders = computed(() => {
  const all = isDemo.value ? demoStore.orders : orderStore.orders
  return all
    .filter((o) => o.status === 'served')
    .sort((a, b) => (b.servedAt?.getTime() || 0) - (a.servedAt?.getTime() || 0))
    .slice(0, 20)
})

// 提供済み確認ダイアログ
const confirmServe = ref(false)
const confirmOrderId = ref('')
const confirmOrderNumber = ref(0)

function showServeConfirm(orderId: string, orderNumber: number) {
  confirmOrderId.value = orderId
  confirmOrderNumber.value = orderNumber
  confirmServe.value = true
}

function handleServe() {
  handleUpdateStatus(confirmOrderId.value, 'served')
  confirmServe.value = false
}

function handleUpdateStatus(orderId: string, status: OrderStatus) {
  if (isDemo.value) {
    demoStore.updateOrderStatus(orderId, status)
  } else {
    orderStore.updateStatus(eventId.value, orderId, status)
  }
}

// 履歴から戻す
function handleRevert(orderId: string, toStatus: OrderStatus) {
  handleUpdateStatus(orderId, toStatus)
}

onMounted(() => {
  if (!isDemo.value) {
    orderStore.startListening(eventId.value)
  }
})

onUnmounted(() => {
  orderStore.stopListening()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col pb-14">
    <AppHeader title="📦 受渡し" />

    <!-- 受渡し待ちリスト -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="readyOrders.length === 0" class="text-center text-gray-400 py-16 text-xl">
        受渡し待ちの注文はありません
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="order in readyOrders"
          :key="order.id"
          class="bg-green-50 border-2 border-green-400 rounded-2xl p-5 shadow-sm"
        >
          <div class="text-center mb-4">
            <div class="text-6xl font-black text-green-700 tabular-nums animate-pulse">
              #{{ formatOrderNumber(order.orderNumber) }}
            </div>
            <div class="text-sm text-gray-500 mt-1">
              {{ formatTime(order.createdAt) }}
            </div>
            <StatusBadge status="ready" large class="mt-2" />
          </div>

          <div class="bg-white rounded-xl p-3 mb-4 space-y-1">
            <div
              v-for="(item, i) in order.items"
              :key="i"
              class="flex justify-between text-gray-700"
            >
              <span class="font-medium">{{ item.name }}</span>
              <span class="font-bold">×{{ item.quantity }}</span>
            </div>
          </div>

          <button
            class="btn-touch w-full bg-green-600 hover:bg-green-700 text-white rounded-xl text-xl py-4"
            @click="showServeConfirm(order.id, order.orderNumber)"
          >
            受渡し済みにする
          </button>
        </div>
      </div>
    </div>

    <!-- 受渡し履歴パネル -->
    <ServedHistoryPanel
      :served-orders="servedOrders"
      @revert="handleRevert"
    />

    <!-- 提供済み確認ダイアログ -->
    <ConfirmDialog
      :show="confirmServe"
      title="受渡し確認"
      :message="`#${formatOrderNumber(confirmOrderNumber)} を受渡し済みにしますか？`"
      confirm-label="受渡し済み"
      confirm-class="bg-green-600 hover:bg-green-700"
      @confirm="handleServe"
      @cancel="confirmServe = false"
    />
  </div>
</template>
