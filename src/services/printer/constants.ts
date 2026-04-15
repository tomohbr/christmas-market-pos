/** SII URL Print Agent 定数 */

// URLスキーム
export const PRINT_AGENT_SCHEME = 'siiprintagent://1.0/print'

// MP-B20 用紙幅（mm）
export const PAPER_WIDTH_MM = 58

// レシート用紙の印字可能幅（mm）- 58mm用紙は実質48mm印字
export const PRINTABLE_WIDTH_MM = 48

// PDF上のレシート幅（pt）- 58mm ≒ 164pt
export const RECEIPT_WIDTH_PT = 164

// 1行あたりの全角文字数目安（58mm幅）
export const CHARS_PER_LINE = 16

// 1行あたりの半角文字数目安
export const HALF_CHARS_PER_LINE = 32

// デフォルトフォントサイズ（pt）
export const FONT_SIZE = {
  TITLE: 12,
  NORMAL: 8,
  SMALL: 7,
  LARGE: 14,
} as const

// カットタイプ
export const CUT_TYPE = {
  FULL: 'full',
  PARTIAL: 'partial',
  OFF: 'off',
} as const

// URL Print Agent エラーコード
export const PRINT_ERROR_CODES: Record<string, string> = {
  '-10': 'プリンターとの通信に失敗しました',
  '-20': '権限の取得に失敗しました',
  '-30': 'タイムアウトしました',
  '-40': 'プリンターが応答しません（電源・接続を確認）',
}
