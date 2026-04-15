// デモイベントをFirestoreに登録するスクリプト
// 使い方: node scripts/seedDemoEvent.js

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

initializeApp({ projectId: 'my-pos-app-6a0eb' })
const db = getFirestore()

async function seed() {
  // デモイベント登録
  await db.doc('events/demo-event').set({
    name: 'デモイベント',
    startDate: Timestamp.fromDate(new Date('2026-04-01')),
    endDate: Timestamp.fromDate(new Date('2026-04-30')),
    status: 'active',
    settings: {
      boothName: '',
      currency: 'JPY',
      taxRate: 0.10,
    },
  }, { merge: true })

  console.log('デモイベント登録完了: events/demo-event')

  // 既存ユーザーのeventIdを確認・更新
  const usersSnap = await db.collection('users').get()
  for (const doc of usersSnap.docs) {
    const data = doc.data()
    console.log(`ユーザー: ${data.email || doc.id} - role: ${data.role}, eventId: ${data.eventId}`)
  }
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
