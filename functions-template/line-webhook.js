/**
 * Firebase Cloud Functions テンプレート: LINE Webhook
 *
 * このファイルは LINE 連携を有効にする際にデプロイする。
 * firebase init functions → このファイルを index.js にコピー
 *
 * 環境変数:
 *   LINE_CHANNEL_ACCESS_TOKEN: チャネルアクセストークン
 *   LINE_CHANNEL_SECRET: チャネルシークレット
 *
 * 設定コマンド例:
 *   firebase functions:config:set line.token="YOUR_TOKEN" line.secret="YOUR_SECRET"
 */

// const functions = require('firebase-functions');
// const admin = require('firebase-admin');
// const crypto = require('crypto');
// admin.initializeApp();

/*
// LINE Webhookエンドポイント
// LINE Developers Console で Webhook URL に設定:
// https://YOUR_PROJECT.cloudfunctions.net/lineWebhook
exports.lineWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 署名検証
  const secret = functions.config().line.secret;
  const signature = req.headers['x-line-signature'];
  const hash = crypto.createHmac('SHA256', secret).update(req.rawBody).digest('base64');
  if (hash !== signature) return res.status(403).send('Invalid signature');

  const events = req.body.events || [];
  for (const event of events) {
    if (event.type === 'follow') {
      // 友だち追加時: ユーザーIDを保存
      const userId = event.source.userId;
      console.log('新しい友だち:', userId);
      // Firestoreにユーザー登録（後で番号札と紐づけ）
      // await admin.firestore().collection('lineUsers').doc(userId).set({ createdAt: new Date() });

      // ウェルカムメッセージ
      await replyMessage(event.replyToken, [
        { type: 'text', text: 'ご注文ありがとうございます！\n番号札の番号を送信してください。\n（例: 3）' }
      ]);
    }

    if (event.type === 'message' && event.message.type === 'text') {
      const text = event.message.text.trim();
      const num = parseInt(text, 10);

      if (!isNaN(num) && num >= 1 && num <= 99) {
        // 番号を紐づけ
        const userId = event.source.userId;
        // await admin.firestore().collection('lineOrders').doc(String(num)).set({ lineUserId: userId, createdAt: new Date() });

        await replyMessage(event.replyToken, [
          { type: 'text', text: `#${String(num).padStart(3, '0')} を登録しました。\nできあがり次第お知らせします！` }
        ]);
      }
    }
  }

  res.status(200).send('OK');
});

// Firestoreの注文ステータスが calling に変わったらLINE通知
exports.notifyOrderCalling = functions.firestore
  .document('events/{eventId}/orders/{orderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== 'calling' && after.status === 'calling') {
      const orderNumber = after.orderNumber;
      // lineOrdersから紐づけされたLINEユーザーを検索
      // const doc = await admin.firestore().collection('lineOrders').doc(String(orderNumber)).get();
      // if (doc.exists) {
      //   await pushMessage(doc.data().lineUserId, `🔔 #${String(orderNumber).padStart(3, '0')} のご注文ができました！\nカウンターへお越しください。`);
      // }
    }
  });

async function replyMessage(replyToken, messages) {
  const token = functions.config().line.token;
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ replyToken, messages }),
  });
}

async function pushMessage(userId, text) {
  const token = functions.config().line.token;
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
  });
}
*/
