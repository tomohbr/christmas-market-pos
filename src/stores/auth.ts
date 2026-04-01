import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/firebase'
import type { AppUser, UserRole } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AppUser | null>(null)
  const loading = ref(true)
  const error = ref('')

  const isLoggedIn = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const currentRole = computed(() => user.value?.role)

  async function fetchUserProfile(firebaseUser: FirebaseUser): Promise<AppUser | null> {
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
    if (!userDoc.exists()) return null
    const data = userDoc.data()
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: data.displayName || firebaseUser.displayName || '',
      role: data.role as UserRole,
      eventId: data.eventId || '',
    }
  }

  function initAuth() {
    return new Promise<void>((resolve) => {
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          user.value = await fetchUserProfile(firebaseUser)
        } else {
          user.value = null
        }
        loading.value = false
        resolve()
      })
    })
  }

  async function login(email: string, password: string) {
    error.value = ''
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      user.value = await fetchUserProfile(credential.user)
      if (!user.value) {
        error.value = 'ユーザー情報が見つかりません。管理者に連絡してください。'
        await signOut(auth)
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('wrong-password') || msg.includes('user-not-found') || msg.includes('invalid-credential')) {
        error.value = 'メールアドレスまたはパスワードが正しくありません'
      } else {
        error.value = 'ログインに失敗しました'
      }
    }
  }

  async function logout() {
    await signOut(auth)
    user.value = null
  }

  // デモモード: Firebase未設定時にローカルで動作確認できるようにする
  function loginAsDemo(role: UserRole) {
    user.value = {
      uid: `demo-${role}`,
      email: `${role}@demo.local`,
      displayName: role === 'admin' ? '管理者' : role === 'cashier' ? 'レジ担当' : role === 'kitchen' ? '厨房担当' : role === 'organizer' ? '主催者' : '受渡し担当',
      role,
      eventId: 'demo-event',
    }
    loading.value = false
  }

  return {
    user,
    loading,
    error,
    isLoggedIn,
    isAdmin,
    currentRole,
    initAuth,
    login,
    logout,
    loginAsDemo,
  }
})
