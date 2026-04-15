import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Product } from '@/types'
import { productService } from '@/services/productService'

export const useProductStore = defineStore('products', () => {
  const products = ref<Product[]>([])
  const loading = ref(false)
  let unsubscribe: (() => void) | null = null

  const availableProducts = computed(() =>
    products.value.filter((p) => p.available)
  )

  const categories = computed(() => {
    const cats = new Set(products.value.map((p) => p.category))
    return Array.from(cats).sort()
  })

  function getByCategory(category: string) {
    return availableProducts.value
      .filter((p) => p.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function startListening(eventId: string) {
    loading.value = true
    unsubscribe = productService.listenProducts(eventId, (updated) => {
      products.value = updated
      loading.value = false
    })
  }

  function stopListening() {
    unsubscribe?.()
    unsubscribe = null
  }

  async function toggleAvailability(eventId: string, productId: string, available: boolean) {
    await productService.updateProduct(eventId, productId, { available })
  }

  async function updateStock(eventId: string, productId: string, stock: number | null) {
    const updates: Partial<Product> = { stock }
    if (stock !== null && stock <= 0) {
      updates.available = false
    }
    await productService.updateProduct(eventId, productId, updates)
  }

  async function addProduct(eventId: string, product: Omit<Product, 'id'>) {
    await productService.addProduct(eventId, product)
  }

  async function updateProduct(eventId: string, productId: string, updates: Partial<Product>) {
    await productService.updateProduct(eventId, productId, updates)
  }

  async function deleteProduct(eventId: string, productId: string) {
    await productService.deleteProduct(eventId, productId)
  }

  return {
    products,
    loading,
    availableProducts,
    categories,
    getByCategory,
    startListening,
    stopListening,
    toggleAvailability,
    updateStock,
    addProduct,
    updateProduct,
    deleteProduct,
  }
})
