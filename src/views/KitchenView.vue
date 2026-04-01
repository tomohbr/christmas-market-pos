<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import { useOrderStore } from '@/stores/orders'
import type { OrderStatus } from '@/types'
import AppHeader from '@/components/common/AppHeader.vue'
import KitchenOrderCard from '@/components/kitchen/KitchenOrderCard.vue'
import ServedHistoryPanel from '@/components/common/ServedHistoryPanel.vue'

const authStore = useAuthStore()
const demoStore = useDemoStore()
const orderStore = useOrderStore()

const isDemo = computed(() => demoStore.isDemoMode)
const eventId = computed(() => authStore.user?.eventId || 'demo-event')

// アクティブ注文
const allActiveOrders = computed(() => {
  const all = isDemo.value ? demoStore.orders : orderStore.orders
  return all
    .filter((o) => !['served', 'cancelled'].includes(o.status))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
})

// 提供済み履歴（直近20件）
const servedOrders = computed(() => {
  const all = isDemo.value ? demoStore.orders : orderStore.orders
  return all
    .filter((o) => o.status === 'served')
    .sort((a, b) => (b.servedAt?.getTime() || 0) - (a.servedAt?.getTime() || 0))
    .slice(0, 20)
})

// フィルター
const filter = ref<'all' | 'paid' | 'cooking'>('all')
const filteredOrders = computed(() => {
  if (filter.value === 'all') return allActiveOrders.value
  return allActiveOrders.value.filter((o) => o.status === filter.value)
})

const paidCount = computed(() =>
  allActiveOrders.value.filter((o) => o.status === 'paid').length
)
const cookingCount = computed(() =>
  allActiveOrders.value.filter((o) => o.status === 'cooking').length
)

function handleUpdateStatus(orderId: string, status: OrderStatus) {
  if (isDemo.value) {
    demoStore.updateOrderStatus(orderId, status)
  } else {
    orderStore.updateStatus(eventId.value, orderId, status)
  }
}

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
  <div class="min-h-screen bg-gray-900 flex flex-col pb-14">
    <AppHeader title="🍳 厨房" />

    <!-- フィルターバー -->
    <div class="bg-gray-800 px-4 py-3 flex gap-3 overflow-x-auto">
      <button
        :class="[
          'btn-touch px-5 rounded-xl text-base whitespace-nowrap',
          filter === 'all'
            ? 'bg-white text-gray-900'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
        ]"
        @click="filter = 'all'"
      >
        全て ({{ allActiveOrders.length }})
      </button>
      <button
        :class="[
          'btn-touch px-5 rounded-xl text-base whitespace-nowrap',
          filter === 'paid'
            ? 'bg-blue-500 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
        ]"
        @click="filter = 'paid'"
      >
        新着 ({{ paidCount }})
      </button>
      <button
        :class="[
          'btn-touch px-5 rounded-xl text-base whitespace-nowrap',
          filter === 'cooking'
            ? 'bg-orange-500 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600',
        ]"
        @click="filter = 'cooking'"
      >
        調理中 ({{ cookingCount }})
      </button>
    </div>

    <!-- 注文カード一覧 -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="filteredOrders.length === 0" class="text-center text-gray-500 py-16 text-xl">
        {{ filter === 'all' ? '注文はありません' : '該当する注文はありません' }}
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <KitchenOrderCard
          v-for="order in filteredOrders"
          :key="order.id"
          :order="order"
          @update-status="handleUpdateStatus"
        />
      </div>
    </div>

    <!-- 受渡し履歴パネル -->
    <ServedHistoryPanel
      :served-orders="servedOrders"
      @revert="handleRevert"
    />
  </div>
</template>
