import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { Product } from '@/types'

function productsRef(eventId: string) {
  return collection(db, 'events', eventId, 'products')
}

export const productService = {
  listenProducts(eventId: string, callback: (products: Product[]) => void): () => void {
    const q = query(productsRef(eventId), orderBy('sortOrder', 'asc'))
    return onSnapshot(q, (snapshot) => {
      const products: Product[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[]
      callback(products)
    })
  },

  async addProduct(eventId: string, product: Omit<Product, 'id'>): Promise<string> {
    const docRef = await addDoc(productsRef(eventId), product)
    return docRef.id
  },

  async updateProduct(eventId: string, productId: string, updates: Partial<Product>): Promise<void> {
    const ref = doc(db, 'events', eventId, 'products', productId)
    await updateDoc(ref, updates as Record<string, unknown>)
  },

  async deleteProduct(eventId: string, productId: string): Promise<void> {
    const ref = doc(db, 'events', eventId, 'products', productId)
    await deleteDoc(ref)
  },
}
