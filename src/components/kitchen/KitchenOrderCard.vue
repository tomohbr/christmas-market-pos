<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Order, OrderStatus } from '@/types'
import { formatOrderNumber, formatTime, formatElapsed } from '@/utils/format'
import { useSettingsStore } from '@/stores/settings'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const props = defineProps<{
  order: Order
}>()

const emit = defineEmits<{
  updateStatus: [orderId: string, status: OrderStatus]
}>()

const settingsStore = useSettingsStore()

const orderTypeLabels: Record<string, string> = {
  eat_in: '店内',
  takeout: 'テイクアウト',
  goods: '物販',
}

// 厨房で受渡しまでやるか、受渡し端末を別で使うか
const kitchenHandover = computed(() => settingsStore.settings.kitchenHandover)

// 戻る先
const prevStatus: Record<string, OrderStatus> = {
  cooking: 'paid',
  ready: 'cooking',
}

// 次のステータス（設定によって変わる）
const nextTarget = computed((): OrderStatus | null => {
  const s = props.order.status
  if (s === 'paid') return 'cooking'
  if (s === 'cooking') {
    // 厨房完結モード → served / 受渡し端末別モード → ready
    return kitchenHandover.value ? 'served' : 'ready'
  }
  return null
})

const nextLabel = computed(() => {
  const s = props.order.status
  if (s === 'paid') return '🍳 調理開始'
  if (s === 'cooking') {
    return kitchenHandover.value ? '📦 受渡し' : '✅ 完成'
  }
  return ''
})

const nextColor = computed(() => {
  const s = props.order.status
  if (s === 'paid') return 'bg-orange-500 hover:bg-orange-600'
  if (s === 'cooking') return 'bg-green-500 hover:bg-green-600'
  return ''
})

// 確認ダイアログが必要か（受渡し済みにする時だけ）
const needsConfirm = computed(() =>
  props.order.status === 'cooking' && kitchenHandover.value
)

const showCancelConfirm = ref(false)
const showServeConfirm = ref(false)

function handleMainAction() {
  if (!nextTarget.value) return
  if (needsConfirm.value) {
    showServeConfirm.value = true
  } else {
    emit('updateStatus', props.order.id, nextTarget.value)
  }
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
          <div class="font-bold text-gray-800 text-lg">
            {{ item.name }}
            <span class="text-red-600 ml-1">×{{ item.quantity }}</span>
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
        v-if="prevStatus[order.status]"
        class="btn-touch w-14 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-xl text-sm shrink-0"
        @click="emit('updateStatus', order.id, prevStatus[order.status])"
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

    <ConfirmDialog
      :show="showServeConfirm"
      title="受渡し確認"
      :message="`#${formatOrderNumber(order.orderNumber)} を受渡し済みにしますか？`"
      confirm-label="受渡し済み"
      confirm-class="bg-green-600 hover:bg-green-700"
      @confirm="emit('updateStatus', order.id, 'served'); showServeConfirm = false"
      @cancel="showServeConfirm = false"
    />
  </div>
</template>
