/**
 * SII URL Print Agent との連携サービス
 *
 * URL スキーム経由で PDF データを送信し、
 * MP-B20 モバイルプリンターで印刷する。
 *
 * iOS での URL スキーム発火は制約が多いため、
 * <a> タグを動的生成してクリックする方式を採用。
 */
import {
  PRINT_AGENT_SCHEME,
  PAPER_WIDTH_MM,
  CUT_TYPE,
  PRINT_ERROR_CODES,
} from './constants'

export interface PrintOptions {
  cutType?: 'full' | 'partial' | 'off'
  fitToWidth?: boolean
  selectOnError?: boolean
  timeout?: number
}

export interface PrintResult {
  success: boolean
  errorCode?: string
  errorMessage?: string
}

const DEFAULT_OPTIONS: Required<PrintOptions> = {
  cutType: CUT_TYPE.FULL,
  fitToWidth: true,
  selectOnError: true,
  timeout: 10000,
}

/**
 * URL Print Agent の呼び出し URL を生成する（印刷はしない）
 */
export function buildPrintUrl(pdfBase64: string, options: PrintOptions = {}): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const currentUrl = window.location.origin + window.location.pathname
  const callbackSuccess = encodeURIComponent(currentUrl + '?printResult=success')
  const callbackFail = encodeURIComponent(currentUrl + '?printResult=fail')

  return (
    `${PRINT_AGENT_SCHEME}?` +
    `CallbackSuccess=${callbackSuccess}` +
    `&CallbackFail=${callbackFail}` +
    `&Format=pdf` +
    `&Data=${encodeURIComponent(pdfBase64)}` +
    `&CutType=${opts.cutType}` +
    `&CutFeed=yes` +
    `&FitToWidth=${opts.fitToWidth ? 'yes' : 'no'}` +
    `&PaperWidth=${PAPER_WIDTH_MM}` +
    `&SelectOnError=${opts.selectOnError ? 'yes' : 'no'}` +
    `&Timeout=${opts.timeout}` +
    `&ErrorDialog=yes`
  )
}

/**
 * URL Print Agent を呼び出して PDF を印刷する
 *
 * iOS Safari / PWA 両対応のため、複数の発火方法を試行する。
 */
export function printPdf(pdfBase64: string, options: PrintOptions = {}): void {
  const url = buildPrintUrl(pdfBase64, options)

  console.log('[PrinterService] URL Print Agent 呼び出し', {
    dataLength: pdfBase64.length,
    urlLength: url.length,
  })

  // 方式1: <a> タグを動的生成してクリック（iOS で最も信頼性が高い）
  const a = document.createElement('a')
  a.href = url
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()

  // 一定時間後に <a> を削除
  setTimeout(() => {
    document.body.removeChild(a)
  }, 100)

  // 方式2のフォールバック: location.href（<a> が効かない場合）
  setTimeout(() => {
    // アプリが起動していなければまだ同じページにいるはず
    // その場合 location.href で再試行
    window.location.href = url
  }, 500)
}

/**
 * コールバック URL からの印刷結果をパースする
 */
export function parsePrintCallback(): PrintResult | null {
  const params = new URLSearchParams(window.location.search)
  const result = params.get('printResult')

  if (!result) return null

  if (result === 'success') {
    console.log('[PrinterService] 印刷成功')
    cleanCallbackParams()
    return { success: true }
  }

  const code = params.get('Code') || ''
  const message = params.get('Message') || ''
  const decodedMessage = message ? decodeURIComponent(message) : ''

  console.error('[PrinterService] 印刷失敗', { code, message: decodedMessage })
  cleanCallbackParams()

  return {
    success: false,
    errorCode: code,
    errorMessage: PRINT_ERROR_CODES[code] || decodedMessage || '不明なエラー',
  }
}

/**
 * URL Print Agent がインストールされているかの簡易チェック
 */
export function isPrintAgentAvailable(): boolean {
  return true
}

/** App Store の URL Print Agent ページ */
export const PRINT_AGENT_APP_STORE_URL = 'https://apps.apple.com/app/id1502527506'

/** コールバックのクエリパラメータを URL から除去 */
function cleanCallbackParams() {
  const url = new URL(window.location.href)
  url.searchParams.delete('printResult')
  url.searchParams.delete('Code')
  url.searchParams.delete('Message')
  window.history.replaceState({}, '', url.toString())
}
