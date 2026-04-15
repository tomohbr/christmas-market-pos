<script setup lang="ts">
/**
 * レシート / 領収書のHTMLプレビュー + 印刷ボタン
 */
import { computed, ref } from 'vue'
import type { Order } from '@/types'
import type { ShopInfo, PrinterProfile } from '@/stores/settings'
import { formatPrice, formatOrderNumber, formatTime } from '@/utils/format'
import { usePrint } from '@/composables/usePrint'
import type { ManualReceiptItem } from '@/utils/receipt'

const props = defineProps<{
  mode: 'receipt' | 'formal' | 'manual'
  order?: Order
  shopInfo: ShopInfo
  printer: PrinterProfile
  logoDataUri?: string
  buyerName?: string
  manualItems?: ManualReceiptItem[]
  manualTotal?: number
  manualPayment?: string
  manualNote?: string
}>()

const emit = defineEmits<{ close: [] }>()
const print = usePrint()

// 領収書の宛名（プレビュー内で編集可能）
const editBuyerName = ref(props.buyerName || '')

const c = computed(() => props.shopInfo)
const taxRate = computed(() => c.value.taxRate || 0.10)
const taxPercent = computed(() => Math.round(taxRate.value * 100))

const totalAmount = computed(() => {
  if (props.mode === 'manual') return props.manualTotal || 0
  return props.order?.totalAmount || 0
})
const taxAmount = computed(() => Math.floor(totalAmount.value * taxRate.value / (1 + taxRate.value)))
const preTax = computed(() => totalAmount.value - taxAmount.value)

const title = computed(() => props.mode === 'receipt' ? 'レ シ ー ト' : '領 収 書')

const paperWidth = computed(() => {
  const mm = props.printer.paperWidthMm || 58
  return Math.round(mm * 5)
})

const paymentLabels: Record<string, string> = {
  cash: '現金', cashless: 'キャッシュレス', other: 'その他',
}
const typeLabels: Record<string, string> = {
  eat_in: '[店内]', takeout: '[持帰]', goods: '[物販]',
}

// 印刷
function handlePrint() {
  if (props.mode === 'receipt' && props.order) {
    print.printReceipt(props.order)
  } else if (props.mode === 'formal' && props.order) {
    print.printFormalReceipt(props.order, editBuyerName.value || undefined)
  } else if (props.mode === 'manual') {
    print.printManualReceipt({
      items: props.manualItems?.filter(i => i.name && i.amount > 0) || [],
      totalAmount: props.manualTotal || 0,
      paymentMethod: props.manualPayment,
      note: props.manualNote,
    }, editBuyerName.value || undefined)
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 overflow-y-auto py-4 px-2" @click.self="emit('close')">
    <div class="relative w-full" :style="{ maxWidth: (paperWidth + 40) + 'px' }">
      <!-- 閉じるボタン -->
      <button
        class="absolute -top-2 -right-2 z-10 w-9 h-9 bg-red-500 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-lg"
        @click="emit('close')"
      >×</button>

      <!-- 領収書の場合: 宛名入力 -->
      <div v-if="mode !== 'receipt'" class="bg-white rounded-xl p-3 mb-2 shadow">
        <label class="text-xs font-bold text-gray-600">宛名（任意）</label>
        <input
          v-model="editBuyerName"
          type="text"
          placeholder="例: ○○株式会社"
          class="w-full mt-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
        />
      </div>

      <!-- レシート本体 -->
      <div
        class="bg-white shadow-2xl mx-auto"
        :style="{ width: paperWidth + 'px', fontFamily: 'monospace, sans-serif', fontSize: '12px', lineHeight: '1.5', padding: '16px 12px' }"
      >
        <!-- 店舗ヘッダー -->
        <div class="text-center border-t-2 border-b-2 border-black py-2 mb-2" style="border-style: double">
          <img v-if="logoDataUri" :src="logoDataUri" alt="" class="mx-auto mb-1" style="max-height:40px;max-width:80%" />
          <div class="font-bold text-base">{{ c.shopName || 'Shop Name' }}</div>
          <div v-if="c.companyName && c.companyName !== c.shopName" class="text-[10px]">{{ c.companyName }}</div>
          <div v-if="c.postalCode" class="text-[10px]">〒{{ c.postalCode }}</div>
          <div v-if="c.address" class="text-[10px]">{{ c.address }}</div>
          <div v-if="c.phone" class="text-[10px]">TEL {{ c.phone }}</div>
          <div v-if="c.invoiceNumber" class="text-[10px] mt-0.5">登録番号: {{ c.invoiceNumber }}</div>
        </div>

        <!-- タイトル -->
        <div class="text-center font-bold text-lg my-2">{{ title }}</div>

        <!-- 宛名（領収書） -->
        <div v-if="mode !== 'receipt' && editBuyerName" class="text-center font-bold mb-1">
          {{ editBuyerName }} 様
        </div>

        <!-- 日時・番号 -->
        <div v-if="order" class="flex justify-between text-[11px] mb-1">
          <span>{{ order.createdAt.toLocaleDateString('ja-JP') }} {{ formatTime(order.createdAt) }}</span>
          <span>#{{ formatOrderNumber(order.orderNumber) }}</span>
        </div>
        <div v-else class="text-[11px] text-center mb-1">
          {{ new Date().toLocaleDateString('ja-JP') }} {{ formatTime(new Date()) }}
        </div>

        <!-- 領収書: 大きな金額 -->
        <div v-if="mode !== 'receipt'" class="text-center my-3">
          <div class="text-2xl font-black border-b-2 border-black inline-block px-4 pb-1">
            {{ formatPrice(totalAmount) }}
          </div>
          <div class="text-[10px] mt-1">但し 上記正に領収いたしました</div>
        </div>

        <div class="border-t border-dashed border-gray-600 my-1"></div>

        <!-- 商品明細（注文ベース） -->
        <template v-if="order">
          <div v-for="(item, i) in order.items" :key="i" class="mb-1">
            <div class="font-bold">
              {{ item.name }}
              <span v-if="item.orderType" class="text-[10px] font-normal">{{ typeLabels[item.orderType] || '' }}</span>
            </div>
            <div class="flex justify-between text-[11px]">
              <span>&nbsp;&nbsp;{{ item.quantity }} x {{ formatPrice(item.price + item.options.reduce((s: number, o) => s + o.price, 0)) }}</span>
              <span>{{ formatPrice((item.price + item.options.reduce((s: number, o) => s + o.price, 0)) * item.quantity) }}</span>
            </div>
            <div v-for="opt in item.options" :key="opt.name" class="flex justify-between text-[10px] text-gray-600">
              <span>&nbsp;&nbsp;&nbsp;&nbsp;+ {{ opt.name }}</span>
              <span v-if="opt.price > 0">+{{ formatPrice(opt.price) }}</span>
            </div>
            <div v-if="item.note" class="text-[10px] text-gray-600">&nbsp;&nbsp;&nbsp;&nbsp;※{{ item.note }}</div>
          </div>
        </template>

        <!-- 明細（自由入力） -->
        <template v-if="mode === 'manual' && manualItems">
          <div v-for="(item, i) in manualItems.filter(x => x.name && x.amount > 0)" :key="i" class="flex justify-between font-bold mb-0.5">
            <span>{{ item.name }}</span>
            <span>{{ formatPrice(item.amount) }}</span>
          </div>
        </template>

        <!-- 小計・税 -->
        <div class="border-t border-dashed border-gray-600 my-1"></div>
        <div class="flex justify-between text-[11px]">
          <span>小計</span><span>{{ formatPrice(preTax) }}</span>
        </div>
        <div class="flex justify-between text-[11px]">
          <span>消費税({{ taxPercent }}%)</span><span>{{ formatPrice(taxAmount) }}</span>
        </div>

        <!-- 合計 -->
        <div class="border-t border-dashed border-gray-600 my-1"></div>
        <div class="flex justify-between font-bold text-base">
          <span>合計(税込)</span><span>{{ formatPrice(totalAmount) }}</span>
        </div>
        <div class="border-t border-dashed border-gray-600 my-1"></div>

        <!-- 支払方法 -->
        <div v-if="order" class="flex justify-between text-[11px]">
          <span>支払方法</span><span>{{ paymentLabels[order.paymentMethod] || '' }}</span>
        </div>
        <div v-else-if="manualPayment" class="flex justify-between text-[11px]">
          <span>支払方法</span><span>{{ paymentLabels[manualPayment] || manualPayment }}</span>
        </div>

        <!-- 但書 -->
        <div v-if="mode === 'manual' && manualNote" class="flex justify-between text-[10px]">
          <span>但書</span><span>{{ manualNote }}</span>
        </div>

        <!-- インボイス内訳 -->
        <div class="border-t-2 border-b-2 border-black my-2 py-1" style="border-style: double">
          <div class="flex justify-between text-[10px]">
            <span>{{ taxPercent }}%対象</span><span>{{ formatPrice(totalAmount) }}</span>
          </div>
          <div class="flex justify-between text-[10px]">
            <span>(内消費税</span><span>{{ formatPrice(taxAmount) }})</span>
          </div>
        </div>

        <!-- フッター -->
        <div class="text-center text-[11px] mt-2">{{ c.footerText || 'ありがとうございました' }}</div>
      </div>

      <!-- 操作ボタン -->
      <div class="flex gap-2 mt-3">
        <button
          class="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow active:scale-95 text-lg"
          @click="handlePrint"
        >
          印刷
        </button>
        <button
          class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-xl shadow active:scale-95"
          @click="emit('close')"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
</template>
