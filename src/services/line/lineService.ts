/**
 * LINE Messaging API 連携サービス
 *
 * LINE公式アカウントのMessaging APIを使って
 * お客様にプッシュ通知を送る。
 *
 * 前提:
 * - LINE公式アカウント開設済み
 * - Messaging APIチャネル作成済み
 * - チャネルアクセストークン取得済み
 *
 * 注意:
 * - クライアントサイドから直接LINE APIを叩くとトークンが露出する
 * - 本番運用ではFirebase Cloud Functions等のサーバー経由が推奨
 * - 開発/テスト段階ではCORS proxy経由で動作確認可能
 */

const LINE_API_BASE = 'https://api.line.me/v2/bot'

export interface LineNotifyParams {
  channelAccessToken: string
  userId: string  // LINEユーザーID（友だち追加時に取得）
  message: string
}

/**
 * LINEプッシュメッセージを送信
 *
 * 本番ではCloud Function経由で呼び出す想定。
 * この関数はメッセージ構造の定義とAPI呼び出しのテンプレート。
 */
export async function sendPushMessage(params: LineNotifyParams): Promise<boolean> {
  try {
    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.channelAccessToken}`,
      },
      body: JSON.stringify({
        to: params.userId,
        messages: [{ type: 'text', text: params.message }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[LINE] プッシュ送信エラー:', res.status, err)
      return false
    }
    console.log('[LINE] プッシュ送信成功:', params.userId)
    return true
  } catch (e) {
    console.error('[LINE] 通信エラー:', e)
    return false
  }
}

/**
 * 注文完成時の通知メッセージを生成
 */
export function buildReadyMessage(orderNumber: number, shopName: string): string {
  const num = String(orderNumber).padStart(3, '0')
  return `🔔 #${num} の注文ができました！\n\n${shopName}の受け取りカウンターまでお越しください。`
}

/**
 * 注文受付時の確認メッセージを生成
 */
export function buildAcceptMessage(orderNumber: number, shopName: string, items: string[]): string {
  const num = String(orderNumber).padStart(3, '0')
  const itemList = items.map(i => `・${i}`).join('\n')
  return `✅ ご注文を受け付けました\n\n番号: #${num}\n${itemList}\n\n${shopName}\nできあがりましたらお知らせします。`
}

/**
 * Webhook受信時のイベント型定義
 * LINE Platform → Cloud Function → この型で処理
 */
export interface LineWebhookEvent {
  type: 'message' | 'follow' | 'unfollow' | 'postback'
  replyToken?: string
  source: {
    type: 'user' | 'group' | 'room'
    userId?: string
  }
  message?: {
    type: string
    text?: string
  }
}

/**
 * Webhookイベントからユーザーの番号札リクエストを解析
 * お客様が「3」と送信 → 番号3に紐づける
 */
export function parseNumberRequest(event: LineWebhookEvent): number | null {
  if (event.type !== 'message' || event.message?.type !== 'text') return null
  const text = (event.message.text || '').trim()
  const num = parseInt(text, 10)
  if (isNaN(num) || num < 1 || num > 99) return null
  return num
}
