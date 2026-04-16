import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import type { UserRole } from '@/types'

// ロールごとのホーム画面
const roleHome: Record<UserRole, string> = {
  admin: '/admin',
  organizer: '/organizer',
  cashier: '/order',
  kitchen: '/kitchen',
  handover: '/handover',
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      // 店舗レジ画面: 店舗管理者 + レジ担当
      path: '/order',
      name: 'order',
      component: () => import('@/views/OrderView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'cashier'] as UserRole[] },
    },
    {
      // 厨房画面: 店舗管理者 + 厨房担当
      path: '/kitchen',
      name: 'kitchen',
      component: () => import('@/views/KitchenView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'kitchen'] as UserRole[] },
    },
    {
      // 受渡し画面: 店舗管理者 + 受渡し担当
      path: '/handover',
      name: 'handover',
      component: () => import('@/views/HandoverView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'handover'] as UserRole[] },
    },
    {
      // 店舗管理者専用（商品マスタ・売上集計）
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['admin'] as UserRole[] },
    },
    {
      // 主催者専用
      path: '/organizer',
      name: 'organizer',
      component: () => import('@/views/OrganizerView.vue'),
      meta: { requiresAuth: true, roles: ['organizer'] as UserRole[] },
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()
  const demoStore = useDemoStore()

  // 新規タブのデモ自動ログイン: 明示的にフラグが立っているときのみ許可
  // （localStorage にデモ商品が残っているだけでは発動しない）
  const autoLoginRole = localStorage.getItem('gluhwein_demo_autologin') as UserRole | null
  if (to.meta.requiresAuth && !authStore.isLoggedIn && autoLoginRole) {
    demoStore.enableDemoMode()
    authStore.loginAsDemo(autoLoginRole)
    localStorage.removeItem('gluhwein_demo_autologin')
    // 要求されたロールとパスが噛み合っていれば通す、そうでなければそのロールのホームへ
    const allowed = to.meta.roles as UserRole[] | undefined
    if (allowed && !allowed.includes(autoLoginRole)) {
      return roleHome[autoLoginRole]
    }
    return
  }

  // 未ログイン → ログイン画面へ
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return { name: 'login' }
  }

  // ロール違反 → 自分のホーム画面へリダイレクト（loginにループしないように）
  const allowedRoles = to.meta.roles as UserRole[] | undefined
  if (allowedRoles && authStore.user && !allowedRoles.includes(authStore.user.role)) {
    return roleHome[authStore.user.role] || { name: 'login' }
  }
})

export default router
