/**
 * 印刷機能の Vue Composable
 */
import { ref, onMounted } from 'vue'
import { printPdf, parsePrintCallback } from '@/services/printer'
import type { PrintResult } from '@/services/printer'
import {
  buildTestReceiptPdf,
  buildOrderReceiptPdf,
  buildFormalReceiptPdf,
  buildManualReceiptPdf,
  shopInfoToReceiptConfig,
} from '@/utils/receipt'
import type { ManualReceiptParams } from '@/utils/receipt'
import { useSettingsStore } from '@/stores/settings'
import type { Order } from '@/types'

export function usePrint() {
  const statusMessage = ref('')
  const lastResult = ref<PrintResult | null>(null)

  function getConfig() {
    const s = useSettingsStore()
    return shopInfoToReceiptConfig(s.settings.shopInfo, s.logoDataUri)
  }

  onMounted(() => {
    const result = parsePrintCallback()
    if (result) {
      lastResult.value = result
      statusMessage.value = result.success
        ? '印刷が完了しました'
        : `印刷エラー: ${result.errorMessage}`
    }
  })

  function send(base64: string) {
    statusMessage.value = 'URL Print Agent を起動中...'
    try { printPdf(base64) } catch (e) {
      statusMessage.value = `エラー: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  async function testPrint() {
    try { send(await buildTestReceiptPdf(getConfig())) }
    catch (e) { statusMessage.value = `エラー: ${e}` }
  }

  async function printReceipt(order: Order) {
    try { send(await buildOrderReceiptPdf(order, getConfig())) }
    catch (e) { statusMessage.value = `エラー: ${e}` }
  }

  async function printFormalReceipt(order: Order, buyerName?: string) {
    try { send(await buildFormalReceiptPdf(order, getConfig(), buyerName)) }
    catch (e) { statusMessage.value = `エラー: ${e}` }
  }

  async function printManualReceipt(params: ManualReceiptParams, buyerName?: string) {
    try { send(await buildManualReceiptPdf(params, getConfig(), buyerName)) }
    catch (e) { statusMessage.value = `エラー: ${e}` }
  }

  // 後方互換
  async function printOrder(order: Order) { await printReceipt(order) }

  function clearStatus() { statusMessage.value = ''; lastResult.value = null }

  return {
    statusMessage, lastResult,
    testPrint, printReceipt, printFormalReceipt, printManualReceipt, printOrder,
    clearStatus,
  }
}
