import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDemoStore } from '@/stores/demo'
import type { UserRole } from '@/types'

// パスからデモ用ロールを判定
const pathToRole: Record<string, UserRole> = {
  '/order': 'cashier',
  '/kitchen': 'kitchen',
  '/handover': 'handover',
  '/admin': 'admin',
  '/organizer': 'organizer',
}

const router = createRouter({
  history: createWebHistory(),
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
      path: '/order',
      name: 'order',
      component: () => import('@/views/OrderView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'cashier'] as UserRole[] },
    },
    {
      path: '/kitchen',
      name: 'kitchen',
      component: () => import('@/views/KitchenView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'kitchen'] as UserRole[] },
    },
    {
      path: '/handover',
      name: 'handover',
      component: () => import('@/views/HandoverView.vue'),
      meta: { requiresAuth: true, roles: ['admin', 'handover', 'kitchen'] as UserRole[] },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true, roles: ['admin'] as UserRole[] },
    },
    {
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

  // 未ログインで認証必要ページにアクセスした場合、
  // デモデータがlocalStorageにあればデモモードで自動ログインする
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    const role = pathToRole[to.path]
    const hasDemo = localStorage.getItem('gluhwein_demo_orders') !== null
      || localStorage.getItem('gluhwein_demo_autologin') !== null

    if (role && hasDemo) {
      demoStore.enableDemoMode()
      authStore.loginAsDemo(role)
      // 自動ログインフラグを消す
      localStorage.removeItem('gluhwein_demo_autologin')
      return // そのまま進む
    }

    return { name: 'login' }
  }

  const allowedRoles = to.meta.roles as UserRole[] | undefined
  if (allowedRoles && authStore.user && !allowedRoles.includes(authStore.user.role)) {
    return { name: 'login' }
  }
})

export default router
