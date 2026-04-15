<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Product, ProductType } from '@/types'
import { formatPrice } from '@/utils/format'
import AppModal from '@/components/common/AppModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const props = defineProps<{
  products: Product[]
}>()

const emit = defineEmits<{
  toggleAvailability: [productId: string]
  addProduct: [product: Omit<Product, 'id'>]
  updateProduct: [productId: string, updates: Partial<Product>]
  deleteProduct: [productId: string]
}>()

// 商品追加/編集モーダル
const showForm = ref(false)
const editingProduct = ref<Product | null>(null)

const formName = ref('')
const formPrice = ref(0)
const formCategory = ref('')
const formProductType = ref<ProductType>('food')
const formDescription = ref('')
const formSortOrder = ref(0)
const formStock = ref<number | null>(null)
const formHasStock = ref(false)

function openAddForm() {
  editingProduct.value = null
  formName.value = ''
  formPrice.value = 0
  formCategory.value = ''
  formProductType.value = 'food'
  formDescription.value = ''
  formSortOrder.value = props.products.length + 1
  formStock.value = null
  formHasStock.value = false
  showForm.value = true
}

function openEditForm(product: Product) {
  editingProduct.value = product
  formName.value = product.name
  formPrice.value = product.price
  formCategory.value = product.category
  formProductType.value = product.productType
  formDescription.value = product.description
  formSortOrder.value = product.sortOrder
  formStock.value = product.stock
  formHasStock.value = product.stock !== null
  showForm.value = true
}

function handleSubmitForm() {
  const productData: Omit<Product, 'id'> = {
    name: formName.value,
    price: formPrice.value,
    category: formCategory.value,
    productType: formProductType.value,
    description: formDescription.value,
    sortOrder: formSortOrder.value,
    stock: formHasStock.value ? (formStock.value ?? 0) : null,
    available: true,
    options: editingProduct.value?.options || [],
    imageUrl: '',
  }

  if (editingProduct.value) {
    emit('updateProduct', editingProduct.value.id, productData)
  } else {
    emit('addProduct', productData)
  }
  showForm.value = false
}

const productTypeLabels: Record<ProductType, string> = {
  food: 'フード',
  drink: 'ドリンク',
  goods: '物販',
}

const categoryOptions = computed(() => {
  const cats = new Set(props.products.map((p) => p.category))
  return Array.from(cats)
})

// 商品削除
const showDeleteConfirm = ref(false)
const deletingProduct = ref<Product | null>(null)

function confirmDelete(product: Product) {
  deletingProduct.value = product
  showDeleteConfirm.value = true
}

function handleDelete() {
  if (deletingProduct.value) {
    emit('deleteProduct', deletingProduct.value.id)
  }
  showDeleteConfirm.value = false
  deletingProduct.value = null
}
</script>

<template>
  <div>
    <!-- ヘッダー -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-800">商品管理</h2>
      <button
        class="btn-touch bg-red-600 hover:bg-red-700 text-white px-5 rounded-xl"
        @click="openAddForm"
      >
        ＋ 商品追加
      </button>
    </div>

    <!-- 商品一覧 -->
    <div class="space-y-2">
      <div
        v-for="product in products"
        :key="product.id"
        :class="[
          'bg-white rounded-xl p-4 border-2 flex items-center gap-4',
          product.available ? 'border-gray-100' : 'border-red-200 bg-red-50',
        ]"
      >
        <!-- 商品情報 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-800 text-lg">{{ product.name }}</span>
            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {{ productTypeLabels[product.productType] }}
            </span>
            <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
              {{ product.category }}
            </span>
          </div>
          <div class="text-red-600 font-bold">{{ formatPrice(product.price) }}</div>
          <div v-if="product.stock !== null" class="text-xs text-gray-500">
            在庫: {{ product.stock }}
          </div>
        </div>

        <!-- 操作ボタン -->
        <div class="flex items-center gap-2">
          <!-- 売り切れ切替（大きなボタン） -->
          <button
            :class="[
              'btn-touch px-4 rounded-xl text-sm font-bold',
              product.available
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-red-500 text-white hover:bg-red-600',
            ]"
            @click="emit('toggleAvailability', product.id)"
          >
            {{ product.available ? '販売中' : '売り切れ' }}
          </button>
          <button
            class="btn-touch w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"
            @click="openEditForm(product)"
          >
            ✏️
          </button>
          <button
            class="btn-touch w-10 h-10 bg-red-50 hover:bg-red-100 rounded-lg text-red-500"
            @click="confirmDelete(product)"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>

    <!-- 商品追加/編集モーダル -->
    <AppModal
      :show="showForm"
      :title="editingProduct ? '商品を編集' : '商品を追加'"
      @close="showForm = false"
    >
      <form @submit.prevent="handleSubmitForm" class="space-y-4">
        <div>
          <label class="block text-sm font-bold text-gray-600 mb-1">商品名</label>
          <input
            v-model="formName"
            type="text"
            required
            class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-600 mb-1">価格（円）</label>
          <input
            v-model.number="formPrice"
            type="number"
            min="0"
            required
            class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-600 mb-1">カテゴリ</label>
          <input
            v-model="formCategory"
            type="text"
            required
            list="category-list"
            placeholder="ドリンク、フード、物販..."
            class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
          />
          <datalist id="category-list">
            <option v-for="cat in categoryOptions" :key="cat" :value="cat" />
          </datalist>
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-600 mb-1">商品タイプ</label>
          <div class="flex gap-2">
            <button
              v-for="(label, key) in productTypeLabels"
              :key="key"
              type="button"
              :class="[
                'btn-touch flex-1 rounded-xl text-sm',
                formProductType === key
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ]"
              @click="formProductType = key as ProductType"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <div>
          <label class="flex items-center gap-2 text-sm font-bold text-gray-600 mb-1">
            <input v-model="formHasStock" type="checkbox" class="w-5 h-5" />
            在庫数を管理する
          </label>
          <input
            v-if="formHasStock"
            v-model.number="formStock"
            type="number"
            min="0"
            placeholder="在庫数"
            class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none mt-1"
          />
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-600 mb-1">表示順</label>
          <input
            v-model.number="formSortOrder"
            type="number"
            min="0"
            class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
          />
        </div>

        <div>
          <label class="block text-sm font-bold text-gray-600 mb-1">説明（任意）</label>
          <input
            v-model="formDescription"
            type="text"
            class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          class="btn-touch w-full bg-red-600 hover:bg-red-700 text-white rounded-xl text-lg"
        >
          {{ editingProduct ? '更新' : '追加' }}
        </button>
      </form>
    </AppModal>

    <!-- 削除確認ダイアログ -->
    <ConfirmDialog
      :show="showDeleteConfirm"
      title="商品を削除"
      :message="`「${deletingProduct?.name}」を削除しますか？この操作は元に戻せません。`"
      confirm-label="削除する"
      confirm-class="bg-red-600 hover:bg-red-700"
      @confirm="handleDelete"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
