<script setup lang="ts">
import { formatOrderNumber } from '@/utils/format'

defineProps<{
  orderNumber: number
  size?: 'sm' | 'md' | 'lg'
}>()
</script>

<template>
  <div class="text-center">
    <div class="text-gray-500 text-sm font-medium">注文番号</div>
    <div
      :class="[
        'font-black tabular-nums tracking-tight text-gray-900',
        size === 'lg' ? 'text-8xl' : size === 'sm' ? 'text-3xl' : 'text-5xl',
      ]"
    >
      {{ formatOrderNumber(orderNumber) }}
    </div>
  </div>
</template>
