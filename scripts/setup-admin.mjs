/**
 * 管理者ユーザーをFirebase Authに作成し、Firestoreにプロフィールを書き込む
 * 使い方: node scripts/setup-admin.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = 'my-pos-app-6a0eb'

// Firebase Admin SDK (Application Default Credentials)
initializeApp({ projectId: PROJECT_ID })

const auth = getAuth()
const db = getFirestore()

const EVENT_ID = 'breakfast-event-2026'

const users = [
  { email: 'admin@pos.local', password: 'admin1234', displayName: '管理者', role: 'admin' },
  { email: 'cashier@pos.local', password: 'cashier1234', displayName: 'レジ担当', role: 'cashier' },
  { email: 'kitchen@pos.local', password: 'kitchen1234', displayName: '厨房担当', role: 'kitchen' },
  { email: 'handover@pos.local', password: 'handover1234', displayName: '受渡し担当', role: 'handover' },
]

for (const u of users) {
  try {
    // 既存ユーザーがいれば取得、いなければ作成
    let userRecord
    try {
      userRecord = await auth.getUserByEmail(u.email)
      console.log(`既存: ${u.email} (${userRecord.uid})`)
    } catch {
      userRecord = await auth.createUser({
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      })
      console.log(`作成: ${u.email} (${userRecord.uid})`)
    }

    // Firestoreにユーザープロフィール書き込み
    await db.doc(`users/${userRecord.uid}`).set({
      displayName: u.displayName,
      role: u.role,
      eventId: EVENT_ID,
    }, { merge: true })
    console.log(`  → Firestoreプロフィール設定完了 (role: ${u.role}, eventId: ${EVENT_ID})`)
  } catch (e) {
    console.error(`エラー (${u.email}):`, e.message)
  }
}

console.log('\n=== ログイン情報 ===')
for (const u of users) {
  console.log(`${u.displayName}: ${u.email} / ${u.password}`)
}
console.log(`\nイベントID: ${EVENT_ID}`)
