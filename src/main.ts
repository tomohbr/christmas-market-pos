import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './style.css'
import { useAuthStore } from './stores/auth'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Firebase の認証状態を復元してから router を起動する
// これがないとページリロード時に authStore.user が null のままになり、
// ルーターのロールガードも route 判定も素通りしてしまう
const authStore = useAuthStore()
authStore.initAuth().finally(() => {
  app.mount('#app')
})
