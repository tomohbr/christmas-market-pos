<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

defineProps<{
  title: string
  showBack?: boolean
}>()

const authStore = useAuthStore()
const router = useRouter()

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

const roleLabels: Record<string, string> = {
  admin: '管理者',
  cashier: 'レジ',
  kitchen: '厨房',
  handover: '受渡し',
  organizer: '主催者',
}
</script>

<template>
  <header class="bg-red-800 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-lg">
    <div class="flex items-center gap-3">
      <button
        v-if="showBack"
        class="btn-touch bg-red-700 px-3 text-sm rounded-lg"
        @click="router.back()"
      >
        ← 戻る
      </button>
      <h1 class="text-xl font-bold tracking-tight">{{ title }}</h1>
    </div>
    <div class="flex items-center gap-3">
      <span v-if="authStore.user" class="text-sm bg-red-900 px-2 py-1 rounded">
        {{ roleLabels[authStore.user.role] || authStore.user.role }}
      </span>
      <button
        class="btn-touch bg-red-700 hover:bg-red-600 px-4 text-sm rounded-lg"
        @click="handleLogout"
      >
        ログアウト
      </button>
    </div>
  </header>
</template>
