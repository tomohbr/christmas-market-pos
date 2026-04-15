<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useRouter, useRoute } from 'vue-router'

defineProps<{
  title: string
  showBack?: boolean
}>()

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
const showNav = ref(false)

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

function goTo(path: string) {
  showNav.value = false
  router.push(path)
}

const navItems = [
  { path: '/order', label: 'レジ', icon: '🏪' },
  { path: '/kitchen', label: '厨房', icon: '🍳' },
  { path: '/handover', label: '受渡し', icon: '📦' },
  { path: '/admin', label: '管理', icon: '⚙️' },
]
</script>

<template>
  <header class="sticky top-0 z-50">
    <!-- メインバー -->
    <div class="bg-red-800 text-white px-3 py-2 flex items-center justify-between shadow-lg" style="padding-top: max(0.5rem, env(safe-area-inset-top))">
      <div class="flex items-center gap-2 min-w-0">
        <button
          class="w-9 h-9 flex items-center justify-center bg-red-700 hover:bg-red-600 rounded-lg text-lg shrink-0 active:scale-95"
          @click="showNav = !showNav"
        >
          ☰
        </button>
        <h1 class="text-lg font-bold tracking-tight truncate">{{ title }}</h1>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          class="bg-red-700 hover:bg-red-600 px-3 py-1.5 text-sm rounded-lg font-bold active:scale-95"
          @click="handleLogout"
        >
          退出
        </button>
      </div>
    </div>

    <!-- ナビゲーションドロワー -->
    <div
      v-if="showNav"
      class="absolute top-full left-0 right-0 bg-red-900/95 backdrop-blur shadow-xl z-50 border-t border-red-700"
    >
      <div class="grid grid-cols-4 gap-1 p-2">
        <button
          v-for="nav in navItems"
          :key="nav.path"
          :class="[
            'flex flex-col items-center justify-center py-3 rounded-xl text-white font-bold active:scale-95 transition-transform',
            route.path === nav.path
              ? 'bg-white/20'
              : 'hover:bg-white/10',
          ]"
          @click="goTo(nav.path)"
        >
          <span class="text-2xl mb-0.5">{{ nav.icon }}</span>
          <span class="text-xs">{{ nav.label }}</span>
        </button>
      </div>
    </div>

    <!-- オーバーレイ（ナビ展開時に背景タップで閉じる） -->
    <div
      v-if="showNav"
      class="fixed inset-0 z-40"
      @click="showNav = false"
    />
  </header>
</template>
