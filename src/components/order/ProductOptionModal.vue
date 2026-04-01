<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Product, OrderItemOption } from '@/types'
import { formatPrice } from '@/utils/format'
import AppModal from '@/components/common/AppModal.vue'

const props = defineProps<{
  show: boolean
  product: Product | null
}>()

const emit = defineEmits<{
  close: []
  addToCart: [options: OrderItemOption[], note: string, quantity: number]
}>()

const selectedOptions = ref<Set<string>>(new Set())
const note = ref('')
const quantity = ref(1)

watch(() => props.show, (newVal) => {
  if (newVal) {
    selectedOptions.value = new Set()
    note.value = ''
    quantity.value = 1
  }
})

function toggleOption(optionId: string) {
  if (selectedOptions.value.has(optionId)) {
    selectedOptions.value.delete(optionId)
  } else {
    selectedOptions.value.add(optionId)
  }
}

function handleAdd() {
  if (!props.product) return
  const options: OrderItemOption[] = props.product.options
    .filter((o) => selectedOptions.value.has(o.id))
    .map((o) => ({ name: o.name, price: o.price }))
  emit('addToCart', options, note.value, quantity.value)
}
</script>

<template>
  <AppModal :show="show" :title="product?.name || ''" @close="emit('close')">
    <template v-if="product">
      <div class="space-y-4">
        <!-- 価格 -->
        <div class="text-2xl font-black text-red-600">
          {{ formatPrice(product.price) }}
        </div>

        <!-- オプション -->
        <div v-if="product.options.length > 0">
          <div class="text-sm font-bold text-gray-600 mb-2">オプション</div>
          <div class="space-y-2">
            <button
              v-for="opt in product.options"
              :key="opt.id"
              :class="[
                'w-full flex items-center justify-between p-3 rounded-xl border-2 transition-colors',
                selectedOptions.has(opt.id)
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300',
              ]"
              @click="toggleOption(opt.id)"
            >
              <span class="font-medium text-gray-800">{{ opt.name }}</span>
              <span class="font-bold" :class="opt.price > 0 ? 'text-red-600' : 'text-green-600'">
                {{ opt.price > 0 ? '+' + formatPrice(opt.price) : '無料' }}
              </span>
            </button>
          </div>
        </div>

        <!-- 備考 -->
        <div>
          <div class="text-sm font-bold text-gray-600 mb-1">備考</div>
          <input
            v-model="note"
            type="text"
            placeholder="アレルギー、温度等"
            class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
          />
        </div>

        <!-- 数量 -->
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-gray-600">数量</span>
          <div class="flex items-center gap-2">
            <button
              class="btn-touch w-12 h-12 bg-gray-200 hover:bg-gray-300 rounded-xl text-xl"
              :disabled="quantity <= 1"
              @click="quantity--"
            >
              −
            </button>
            <span class="text-2xl font-black w-12 text-center">{{ quantity }}</span>
            <button
              class="btn-touch w-12 h-12 bg-gray-200 hover:bg-gray-300 rounded-xl text-xl"
              @click="quantity++"
            >
              ＋
            </button>
          </div>
        </div>

        <!-- 追加ボタン -->
        <button
          class="btn-touch w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-xl py-4"
          @click="handleAdd"
        >
          カートに追加
        </button>
      </div>
    </template>
  </AppModal>
</template>
