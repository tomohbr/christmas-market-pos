# SII MP-B20 レシート印刷 設計書

## 1. なぜ URL Print Agent を使うのか

iPhone Safari / PWA から Bluetooth デバイスへ直接通信する手段は存在しない。
Web Bluetooth API は iOS Safari で未サポート（2026年4月時点）。

SII URL Print Agent は iOS ネイティブアプリで、カスタムURLスキーム経由で
Web アプリから呼び出せる唯一の公式印刷手段。

| 方式 | iOS対応 | 実装コスト | 備考 |
|------|---------|-----------|------|
| Web Bluetooth API | x | - | iOS Safari 未サポート |
| ネイティブアプリ化 | o | 非常に高い | 既存Webアプリの全面書き換え |
| URL Print Agent | o | 低い | SII公式、URLスキームのみ |

## 2. 印刷アーキテクチャ

```
[Vue Webアプリ]
    |
    | 1. 注文データから PDF を生成（jsPDF）
    | 2. PDF を Base64 エンコード
    | 3. URLスキームで URL Print Agent を呼び出し
    v
[SII URL Print Agent (iOS App)]
    |
    | 4. Bluetooth で印刷データ送信
    v
[SII MP-B20 プリンター]
    |
    | 5. 印刷完了後、コールバックURLでWebアプリに戻る
    v
[Vue Webアプリ（コールバック処理）]
```

## 3. URLスキーム仕様

```
siiprintagent://1.0/print?
  CallbackSuccess=<エンコード済みURL>
  &CallbackFail=<エンコード済みURL>
  &Format=pdf
  &Data=<Base64エンコード済みPDF>
  &CutType=full
  &CutFeed=yes
  &FitToWidth=yes
  &PaperWidth=58
```

## 4. 主要パラメータ

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| Format | `pdf` | 固定（PDFのみ対応） |
| PaperWidth | `58` | MP-B20 は 58mm幅 |
| CutType | `full` | フルカット |
| FitToWidth | `yes` | 用紙幅に合わせて拡縮 |
| SelectOnError | `yes` | 通信エラー時にプリンター選択表示 |

## 5. エラーコード

| Code | 意味 |
|------|------|
| -10 | プリンターとの通信失敗 |
| -20 | 権限取得失敗 |
| -30 | タイムアウト |
| -40 | プリンター無応答（電源・接続確認） |

## 6. 制約

- iOS に SII URL Print Agent アプリのインストールが必須
- PDF 形式のみ対応（ESC/POS 直接送信不可）
- URL の長さ制限あり（レシートは簡潔に）
- 印刷中は URL Print Agent アプリに画面遷移する
- コールバックで Web アプリに戻る

## 7. 想定リスク

| リスク | 対策 |
|--------|------|
| URL Print Agent 未インストール | ガード処理 + インストール案内表示 |
| Base64 データが長すぎる | レシートを簡潔に、画像を避ける |
| PDF の日本語文字化け | jsPDF にフォント埋め込み不要（FitToWidth利用） |
| PWA スタンドアロンモードでの挙動差 | URLスキーム発火テスト必須 |
| Bluetooth ペアリング切れ | Agent 側で SelectOnError=yes |

## 8. 段階的実装手順

### Phase 1: テスト印刷
- 固定文字列 "TEST PRINT" のみ
- AdminView に「テスト印刷」ボタン追加
- 成功/失敗のログとUI表示

### Phase 2: 共通化
- printer service（URLスキーム呼び出し）
- receipt formatter（PDF生成）
- composable（Vue連携）

### Phase 3: 注文レシート印刷
- 注文データからレシートPDF生成
- OrderView 確定時に自動印刷オプション
- KitchenOrderCard に再印刷ボタン

### Phase 4: 拡張
- QRコード対応
- 複数プリンター対応
- 印刷履歴
