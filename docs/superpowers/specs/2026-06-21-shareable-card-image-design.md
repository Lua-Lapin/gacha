# シェア用カード画像（PNG化）設計

作成日: 2026-06-21

## 概要

名前を入れて保存した時点で、結果カード（役職タイトル＋カクテル言葉/ひとこと/材料）を
1枚のPNG画像にして表示し、シェア（SNS共有・コピー）できるようにする。

スクリーンショットにある結果カードの「形」をそのまま画像化することがゴール。
アバター画像（②のAI生成）の合成は今回のスコープ外（アップロードが必要なため後日対応）。

## 要件

- 名前入力→保存の成功後に、カード画像をプレビュー表示する
- 「シェア」操作でPNGを共有できる（Web Share API）。非対応環境ではダウンロードにフォールバック
- 画像の中身はテキストカードのみ（タイトル＋カクテル言葉/ひとこと/材料）。アバターは含めない
- 既存のカードデザイン・テーマCSSを再利用し、デザイン変更に追従しやすくする

## アプローチ

DOMキャプチャ方式（`html-to-image`）。既存カードと同じ見た目の静止カードDOMを
PNGへ変換する。Canvas手描き（二重メンテになる）やサーバーサイド生成（過剰）は採用しない。

## コンポーネント構成

### `src/components/ShareableCard.jsx`（新規）
- PNG化専用の静止カード。`ResultDisplay` と同じ見た目だが confetti アニメーションなし
- 固定サイズ（600×800px 目安）で、画像として崩れないレイアウト
- props: `{ title, info: { meaning, note, ingredients } }`
- 役割: 「シェア画像の型」。画面表示用ではなくキャプチャ対象

### `src/components/CardShare.jsx`（新規）
- 保存成功後に表示されるUI
- `ShareableCard` をプレビューとしてレンダリングし、参照（ref）を持つ
- 「シェア」ボタンを持ち、押下で `captureCardPng` → `shareImage` を実行
- 状態: idle / capturing / error。エラー時はメッセージ表示（カードは残す）

### `src/lib/cardImage.js`（新規）
- `html-to-image` をラップした純粋関数 `captureCardPng(element): Promise<Blob>`
- キャプチャ前に `document.fonts.ready` を待ち、フォント崩れを防ぐ
- テストしやすい単位に分離

### `src/lib/share.js`（新規）
- `shareImage(blob, { filename, title }): Promise<void>`
- `navigator.canShare`/`navigator.share` が使えてファイル共有可能なら共有
- 非対応時は `<a download>` 相当のダウンロードにフォールバック

## データの流れ

1. `SaveResult` で名前入力 → 保存（既存の `onSave`）
2. 保存成功後、結果データ（title, meaning, note, ingredients）を `CardShare` に渡す
3. ユーザーが「シェア」押下 → `captureCardPng(cardRef)` でPNG Blob生成
4. `shareImage(blob)` で共有 or ダウンロード

## エラー処理

- フォント未読み込み対策: キャプチャ前に `document.fonts.ready` を await
- `html-to-image` 失敗時: エラーメッセージを表示、カード自体は残す
- Web Share 非対応 / ファイル共有不可: 自動でダウンロードにフォールバック

## テスト

- `cardImage.test.js`: `html-to-image` をモックし、`document.fonts.ready` 待ち・Blob返却を検証
- `share.test.js`: `navigator.share` ありの共有経路と、非対応時のダウンロードフォールバック分岐
- `CardShare.test.jsx`: 保存後に表示され、ボタン押下でキャプチャ関数が呼ばれること（Testing Library）

## スコープ外

- アバター画像（②のAI生成）の合成
- サーバーサイドでの画像生成・保存
