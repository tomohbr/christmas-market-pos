<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import { eventService } from '@/services/eventService'
import type { UserRole, EventInfo } from '@/types'

const router = useRouter()
const authStore = useAuthStore()
const demoStore = useDemoStore()

const email = ref('')
const password = ref('')
const isSubmitting = ref(false)

// ログインフェーズ: select → credentials → eventSelect
const loginMode = ref<'select' | 'shop' | 'organizer'>('select')
const loginPhase = ref<'credentials' | 'eventSelect'>('credentials')
const events = ref<EventInfo[]>([])
const loadingEvents = ref(false)

const roleRoutes: Record<UserRole, string> = {
  admin: '/admin',
  cashier: '/order',
  kitchen: '/kitchen',
  handover: '/handover',
  organizer: '/organizer',
}

async function handleLogin() {
  if (!email.value || !password.value) return
  isSubmitting.value = true
  await authStore.login(email.value, password.value)
  isSubmitting.value = false
  if (authStore.isLoggedIn) {
    // イベント一覧を取得して選択画面へ
    loadingEvents.value = true
    try {
      events.value = await eventService.listEvents()
    } catch {
      events.value = []
    }
    loadingEvents.value = false

    if (events.value.length === 0) {
      // イベントがなければ初期イベントを自動作成して遷移
      try {
        await eventService.createEvent('default-event', {
          name: 'デモイベント',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 86400000),
          status: 'active',
          settings: { boothName: '', currency: 'JPY', taxRate: 0.10 },
        })
        authStore.setEventId('default-event')
      } catch { /* ignore */ }
      router.push(roleRoutes[authStore.user!.role])
    } else if (events.value.length === 1) {
      // 1つだけなら自動選択
      selectEvent(events.value[0])
    } else {
      // 複数あれば選択画面を表示
      loginPhase.value = 'eventSelect'
    }
  }
}

function selectEvent(event: EventInfo) {
  authStore.setEventId(event.id)
  localStorage.setItem('gluhwein_last_event', event.id)
  router.push(roleRoutes[authStore.user!.role])
}

function loginDemo(role: UserRole) {
  demoStore.enableDemoMode()
  authStore.loginAsDemo(role)
  router.push(roleRoutes[role])
}

function openInNewTab(role: UserRole) {
  demoStore.enableDemoMode()
  localStorage.setItem('gluhwein_demo_autologin', role)
  window.open(window.location.origin + roleRoutes[role], '_blank')
}

// 店舗スタッフ用ロール
const shopRoles: { role: UserRole; label: string; icon: string; color: string }[] = [
  { role: 'cashier', label: 'レジ担当', icon: '🏪', color: 'bg-blue-600 hover:bg-blue-700' },
  { role: 'kitchen', label: '厨房担当', icon: '🍳', color: 'bg-orange-600 hover:bg-orange-700' },
  { role: 'handover', label: '受渡し担当', icon: '📦', color: 'bg-green-600 hover:bg-green-700' },
  { role: 'admin', label: '店舗管理者', icon: '⚙️', color: 'bg-gray-700 hover:bg-gray-800' },
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-red-900 via-red-800 to-green-900 flex flex-col items-center justify-center p-4">
    <!-- ロゴ -->
    <div class="text-center mb-8">
      <div class="text-6xl mb-3">🍽️</div>
      <h1 class="text-3xl font-black text-white tracking-tight">イベントPOS</h1>
      <p class="text-red-200 mt-1">注文管理システム</p>
    </div>

    <!-- ===== イベント選択画面 ===== -->
    <template v-if="loginPhase === 'eventSelect'">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4 text-center">イベントを選択</h2>
        <div v-if="loadingEvents" class="text-center py-8 text-gray-500">読み込み中...</div>
        <div v-else class="space-y-3">
          <button
            v-for="event in events"
            :key="event.id"
            class="btn-touch w-full rounded-xl text-left px-5 py-4 border-2 transition-colors"
            :class="event.status === 'active' ? 'border-green-400 bg-green-50 hover:bg-green-100' : event.status === 'upcoming' ? 'border-blue-400 bg-blue-50 hover:bg-blue-100' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'"
            @click="selectEvent(event)"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="font-bold text-gray-800">{{ event.name }}</div>
                <div class="text-xs text-gray-500 mt-1">
                  {{ event.startDate.toLocaleDateString('ja-JP') }} 〜 {{ event.endDate.toLocaleDateString('ja-JP') }}
                </div>
              </div>
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-full font-bold',
                  event.status === 'active' ? 'bg-green-500 text-white' : event.status === 'upcoming' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white',
                ]"
              >
                {{ event.status === 'active' ? '開催中' : event.status === 'upcoming' ? '開催前' : '終了' }}
              </span>
            </div>
          </button>
        </div>
        <button
          class="btn-touch w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-sm"
          @click="authStore.logout(); loginPhase = 'credentials'; loginMode = 'select'"
        >
          ログアウト
        </button>
      </div>
    </template>

    <!-- ===== 認証画面 ===== -->
    <template v-if="loginPhase === 'credentials'">
      <!-- ===== 選択画面 ===== -->
      <template v-if="loginMode === 'select'">
        <div class="w-full max-w-sm space-y-4">
          <button
            class="btn-touch w-full bg-white hover:bg-gray-50 text-gray-800 rounded-2xl shadow-2xl text-lg py-5 flex items-center justify-center gap-3"
            @click="loginMode = 'shop'"
          >
            <span class="text-2xl">🏪</span>
            <span class="font-bold">店舗管理者ログイン</span>
          </button>
          <button
            class="btn-touch w-full bg-yellow-500 hover:bg-yellow-600 text-white rounded-2xl shadow-2xl text-lg py-5 flex items-center justify-center gap-3"
            @click="loginMode = 'organizer'"
          >
            <span class="text-2xl">👑</span>
            <span class="font-bold">主催者ログイン</span>
          </button>
        </div>
      </template>

      <!-- ===== 店舗管理者ログイン ===== -->
      <template v-if="loginMode === 'shop'">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-800">🏪 店舗ログイン</h2>
            <button
              class="text-sm text-gray-500 hover:text-gray-700"
              @click="loginMode = 'select'"
            >
              ← 戻る
            </button>
          </div>
          <form @submit.prevent="handleLogin" class="space-y-3">
            <input
              v-model="email"
              type="email"
              placeholder="メールアドレス"
              class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
            />
            <input
              v-model="password"
              type="password"
              placeholder="パスワード"
              class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
            />
            <p v-if="authStore.error" class="text-red-500 text-sm font-medium">
              {{ authStore.error }}
            </p>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="btn-touch w-full bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {{ isSubmitting ? 'ログイン中...' : 'ログイン' }}
            </button>
          </form>
        </div>

        <!-- デモモード（店舗） -->
        <div class="bg-white/10 backdrop-blur rounded-2xl w-full max-w-sm p-5">
          <p class="text-white text-center text-sm mb-3 font-medium">
            デモモード（Firebase不要）
          </p>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <button
              v-for="d in shopRoles"
              :key="d.role"
              :class="['btn-touch text-white rounded-xl text-base px-2', d.color]"
              @click="loginDemo(d.role)"
            >
              <span class="mr-1">{{ d.icon }}</span>
              {{ d.label }}
            </button>
          </div>

          <div class="border-t border-white/20 pt-3">
            <p class="text-white/70 text-center text-xs mb-2">
              別タブで開く（複数端末シミュレーション）
            </p>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="d in shopRoles"
                :key="'tab-' + d.role"
                class="btn-touch bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm px-2 min-h-[40px]"
                @click="openInNewTab(d.role)"
              >
                🔗 {{ d.label }}
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 主催者ログイン ===== -->
      <template v-if="loginMode === 'organizer'">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 mb-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-gray-800">👑 主催者ログイン</h2>
            <button
              class="text-sm text-gray-500 hover:text-gray-700"
              @click="loginMode = 'select'"
            >
              ← 戻る
            </button>
          </div>
          <form @submit.prevent="handleLogin" class="space-y-3">
            <input
              v-model="email"
              type="email"
              placeholder="メールアドレス"
              class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
            />
            <input
              v-model="password"
              type="password"
              placeholder="パスワード"
              class="w-full min-h-[48px] px-4 border-2 border-gray-200 rounded-xl text-lg focus:border-red-500 focus:outline-none"
            />
            <p v-if="authStore.error" class="text-red-500 text-sm font-medium">
              {{ authStore.error }}
            </p>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="btn-touch w-full bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl"
            >
              {{ isSubmitting ? 'ログイン中...' : 'ログイン' }}
            </button>
          </form>
        </div>

        <!-- デモモード（主催者） -->
        <div class="bg-white/10 backdrop-blur rounded-2xl w-full max-w-sm p-5">
          <p class="text-white text-center text-sm mb-3 font-medium">
            デモモード
          </p>
          <button
            class="btn-touch w-full bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl text-base"
            @click="loginDemo('organizer')"
          >
            👑 主催者としてログイン
          </button>
          <button
            class="btn-touch w-full bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm mt-2 min-h-[40px]"
            @click="openInNewTab('organizer')"
          >
            🔗 別タブで主催者画面を開く
          </button>
        </div>
      </template>
    </template>
  </div>
</template>
