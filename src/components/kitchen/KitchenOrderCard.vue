<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Order, OrderStatus } from '@/types'
import { formatOrderNumber, formatTime, formatElapsed } from '@/utils/format'
import { useSettingsStore } from '@/stores/settings'
import { usePrint } from '@/composables/usePrint'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const props = defineProps<{
  order: Order
}>()

const emit = defineEmits<{
  updateStatus: [orderId: string, status: OrderStatus]
}>()

const settingsStore = useSettingsStore()
const { printOrder } = usePrint()

const orderTypeLabels: Record<string, string> = {
  eat_in: '店内',
  takeout: 'テイクアウト',
  goods: '物販',
}

const kitchenHandover = computed(() => settingsStore.settings.kitchenHandover)
const skipCooking = computed(() => settingsStore.settings.skipCooking)

// 戻る先
const prevStatus = computed((): Record<string, OrderStatus | undefined> => {
  if (skipCooking.value) {
    return { calling: 'paid' as OrderStatus }
  }
  return { cooking: 'paid' as OrderStatus, calling: 'cooking' as OrderStatus }
})


// 次のステータス
// 調理あり: paid → cooking → calling → served
// 調理なし: paid → calling → served
const nextTarget = computed((): OrderStatus | null => {
  const s = props.order.status

  if (s === 'paid') {
    return skipCooking.value ? 'calling' : 'cooking'
  }
  if (s === 'cooking') {
    return 'calling'
  }
  if (s === 'calling') {
    return 'served'
  }
  return null
})

const nextLabel = computed(() => {
  const s = props.order.status

  if (s === 'paid') {
    return skipCooking.value ? '📢 呼び出し' : '🍳 調理開始'
  }
  if (s === 'cooking') {
    return '📢 呼び出し'
  }
  if (s === 'calling') {
    return '📦 受渡し済み'
  }
  return ''
})

const nextColor = computed(() => {
  const s = props.order.status
  if (s === 'paid' && !skipCooking.value) return 'bg-orange-500 hover:bg-orange-600'
  if (s === 'calling') return 'bg-gray-500 hover:bg-gray-600'
  return 'bg-green-500 hover:bg-green-600'
})

const showCancelConfirm = ref(false)

function handleMainAction() {
  if (!nextTarget.value) return
  emit('updateStatus', props.order.id, nextTarget.value)
}
</script>

<template>
  <div
    :class="[
      'kitchen-card',
      order.status === 'paid'
        ? 'border-blue-400 bg-blue-50'
        : order.status === 'cooking'
          ? 'border-orange-400 bg-orange-50'
          : order.status === 'calling'
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 bg-white',
    ]"
  >
    <!-- ヘッダー -->
    <div class="flex items-start justify-between mb-3">
      <div>
        <div class="text-4xl font-black text-gray-900 tabular-nums">
          #{{ formatOrderNumber(order.orderNumber) }}
        </div>
        <div class="text-sm text-gray-500 mt-1">
          {{ formatTime(order.createdAt) }} · {{ formatElapsed(order.createdAt) }}
        </div>
      </div>
      <div class="flex flex-col items-end gap-2">
        <StatusBadge :status="order.status" large />
        <span class="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded font-medium">
          {{ orderTypeLabels[order.orderType] || order.orderType }}
        </span>
      </div>
    </div>

    <!-- 注文内容 -->
    <div class="space-y-2 mb-4">
      <div
        v-for="(item, i) in order.items"
        :key="i"
        class="flex items-start justify-between bg-white rounded-lg p-3 border border-gray-100"
      >
        <div class="flex-1">
          <div class="font-bold text-gray-800 text-lg flex items-center gap-2 flex-wrap">
            <span>{{ item.name }}</span>
            <span class="text-red-600">×{{ item.quantity }}</span>
            <span
              v-if="item.orderType"
              :class="[
                'text-xs px-1.5 py-0.5 rounded font-bold',
                item.orderType === 'eat_in' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700',
              ]"
            >
              {{ item.orderType === 'eat_in' ? '店内' : '持帰' }}
            </span>
          </div>
          <div v-if="item.options.length" class="text-sm text-blue-600 mt-0.5">
            {{ item.options.map((o) => o.name).join(', ') }}
          </div>
          <div v-if="item.note" class="text-sm text-orange-600 font-medium mt-0.5">
            📝 {{ item.note }}
          </div>
        </div>
      </div>
    </div>

    <!-- アクションボタン -->
    <div class="flex gap-2">
      <button
        class="btn-touch w-14 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl text-sm shrink-0"
        @click="showCancelConfirm = true"
        title="キャンセル"
      >
        ✕
      </button>

      <button
        class="btn-touch w-14 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-xl text-sm shrink-0"
        @click="printOrder(order)"
        title="レシート印刷"
      >
        🖨
      </button>

      <button
        v-if="prevStatus[order.status]"
        class="btn-touch w-14 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl text-sm shrink-0"
        @click="emit('updateStatus', order.id, prevStatus[order.status] as OrderStatus)"
        title="前の状態に戻す"
      >
        ↩
      </button>

      <button
        v-if="nextTarget"
        :class="['btn-touch flex-1 text-white rounded-xl text-xl', nextColor]"
        @click="handleMainAction"
      >
        {{ nextLabel }}
      </button>
    </div>

    <ConfirmDialog
      :show="showCancelConfirm"
      title="注文キャンセル"
      :message="`#${formatOrderNumber(order.orderNumber)} をキャンセルしますか？`"
      confirm-label="キャンセルする"
      confirm-class="bg-red-600 hover:bg-red-700"
      @confirm="emit('updateStatus', order.id, 'cancelled'); showCancelConfirm = false"
      @cancel="showCancelConfirm = false"
    />

  </div>
</template>
