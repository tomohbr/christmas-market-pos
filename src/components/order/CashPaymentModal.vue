<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { formatPrice } from '@/utils/format'

const props = defineProps<{
  show: boolean
  total: number
}>()

const emit = defineEmits<{
  confirm: [change: number]
  cancel: []
}>()

const receivedAmount = ref(0)
const receivedInput = ref('')

const change = computed(() => receivedAmount.value - props.total)
const isEnough = computed(() => receivedAmount.value >= props.total)

// モーダルが開くたびにリセット
watch(() => props.show, (v) => {
  if (v) {
    receivedAmount.value = 0
    receivedInput.value = ''
  }
})

// よく使う金額ボタン（クリスマスマーケットの価格帯を想定）
const quickAmounts = computed(() => {
  const t = props.total
  const amounts: number[] = []
  // ちょうど
  amounts.push(t)
  // 切り上げ候補を生成
  const candidates = [500, 1000, 2000, 3000, 5000, 10000]
  for (const c of candidates) {
    if (c >= t && !amounts.includes(c)) {
      amounts.push(c)
    }
  }
  // 最大5つに絞る
  return amounts.slice(0, 5)
})

function setAmount(amount: number) {
  receivedAmount.value = amount
  receivedInput.value = String(amount)
}

function handleInputChange(value: string) {
  receivedInput.value = value
  const num = parseInt(value, 10)
  receivedAmount.value = isNaN(num) ? 0 : num
}

// テンキー入力
function appendDigit(digit: string) {
  receivedInput.value += digit
  const num = parseInt(receivedInput.value, 10)
  receivedAmount.value = isNaN(num) ? 0 : num
}

function clearInput() {
  receivedInput.value = ''
  receivedAmount.value = 0
}

function backspace() {
  receivedInput.value = receivedInput.value.slice(0, -1)
  const num = parseInt(receivedInput.value, 10)
  receivedAmount.value = isNaN(num) ? 0 : num
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/50" @click="emit('cancel')" />
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[95vh] overflow-y-auto overscroll-contain">
        <!-- ヘッダー -->
        <div class="bg-blue-600 text-white px-4 py-3 sticky top-0 z-10">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold">現金会計</h2>
            <button
              class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-blue-500 text-2xl"
              @click="emit('cancel')"
            >
              ×
            </button>
          </div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-blue-100 text-sm">合計</span>
            <span class="text-2xl font-black">{{ formatPrice(total) }}</span>
          </div>
        </div>

        <div class="p-4 space-y-3">
          <!-- 預かり金額 -->
          <div>
            <label class="block text-sm font-bold text-gray-600 mb-1">お預かり</label>
            <div class="relative">
              <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">¥</span>
              <input
                :value="receivedInput"
                type="text"
                inputmode="numeric"
                placeholder="0"
                class="w-full min-h-[60px] pl-10 pr-4 border-2 border-gray-200 rounded-xl text-3xl font-black text-right focus:border-blue-500 focus:outline-none"
                @input="handleInputChange(($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <!-- よく使う金額ボタン -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="amount in quickAmounts"
              :key="amount"
              :class="[
                'btn-touch px-4 rounded-xl text-base flex-1 min-w-[80px]',
                receivedAmount === amount
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ]"
              @click="setAmount(amount)"
            >
              {{ formatPrice(amount) }}
            </button>
          </div>

          <!-- テンキー -->
          <div class="grid grid-cols-3 gap-1.5">
            <button
              v-for="d in ['1','2','3','4','5','6','7','8','9','00','0','⌫']"
              :key="d"
              :class="[
                'rounded-xl text-xl h-12 font-bold select-none active:scale-95 transition-transform',
                d === '⌫'
                  ? 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800',
              ]"
              @click="d === '⌫' ? backspace() : appendDigit(d)"
            >
              {{ d }}
            </button>
          </div>

          <!-- おつり表示 -->
          <div
            :class="[
              'rounded-xl p-3 text-center',
              isEnough ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300',
            ]"
          >
            <div class="text-xs font-bold" :class="isEnough ? 'text-green-600' : 'text-red-600'">
              {{ isEnough ? 'おつり' : '不足' }}
            </div>
            <div
              class="text-3xl font-black tabular-nums"
              :class="isEnough ? 'text-green-700' : 'text-red-700'"
            >
              {{ formatPrice(Math.abs(change)) }}
            </div>
          </div>

          <!-- 確定ボタン -->
          <div class="flex gap-2">
            <button
              class="btn-touch flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl"
              @click="emit('cancel')"
            >
              戻る
            </button>
            <button
              :disabled="!isEnough"
              class="btn-touch flex-[2] bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xl disabled:opacity-40"
              @click="emit('confirm', change)"
            >
              会計確定
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
