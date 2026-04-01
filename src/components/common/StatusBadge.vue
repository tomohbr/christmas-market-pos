<script setup lang="ts">
import type { OrderStatus } from '@/types'

defineProps<{
  status: OrderStatus
  large?: boolean
}>()

const statusConfig: Record<OrderStatus, { label: string; class: string }> = {
  paid: { label: '会計済', class: 'status-paid' },
  cooking: { label: '調理中', class: 'status-cooking' },
  ready: { label: '完成', class: 'status-ready' },
  served: { label: '提供済', class: 'status-served' },
  cancelled: { label: '取消', class: 'status-cancelled' },
}
</script>

<template>
  <span
    :class="[
      statusConfig[status].class,
      'inline-flex items-center justify-center rounded-full font-bold',
      large ? 'px-4 py-2 text-lg' : 'px-3 py-1 text-sm',
    ]"
  >
    {{ statusConfig[status].label }}
  </span>
</template>
