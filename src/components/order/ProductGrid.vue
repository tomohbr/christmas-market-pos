<script setup lang="ts">
import type { Product } from '@/types'
import { formatPrice } from '@/utils/format'

defineProps<{
  products: Product[]
}>()

const emit = defineEmits<{
  select: [product: Product]
}>()
</script>

<template>
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
    <button
      v-for="product in products"
      :key="product.id"
      :disabled="!product.available"
      class="relative bg-white rounded-xl p-4 text-left shadow-sm border-2 border-transparent hover:border-red-400 active:scale-95 transition-all disabled:opacity-50 disabled:hover:border-transparent disabled:active:scale-100"
      @click="emit('select', product)"
    >
      <!-- 商品名 -->
      <div class="font-bold text-gray-800 text-lg leading-tight mb-1">
        {{ product.name }}
      </div>
      <!-- 価格 -->
      <div class="text-red-600 font-black text-xl">
        {{ formatPrice(product.price) }}
      </div>
      <!-- 在庫表示 -->
      <div
        v-if="product.stock !== null && product.available"
        class="text-xs text-gray-500 mt-1"
      >
        残り{{ product.stock }}個
      </div>
      <!-- オプションあり表示 -->
      <div
        v-if="product.options.length > 0"
        class="text-xs text-blue-500 mt-1"
      >
        オプションあり
      </div>
      <!-- 売り切れオーバーレイ -->
      <div v-if="!product.available" class="sold-out-overlay">
        <span class="text-white font-black text-xl rotate-[-12deg]">売り切れ</span>
      </div>
    </button>
  </div>
</template>
