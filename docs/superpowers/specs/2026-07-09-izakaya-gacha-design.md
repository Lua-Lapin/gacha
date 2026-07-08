# 居酒屋役職ガチャ 追加設計

## 目的

既存の「カクテル役職ガチャ」に加え、**「形容詞＋居酒屋の定番メニュー」** を役職名とする第2のガチャを追加する。仕上がりの雰囲気は「レトロポップ・ディスコ・漫画ポスター風」で、ハイライトは巨大変形アイテム＋派手なタイトルロゴ。

既存カクテルガチャは共存させ、影響を最小限にとどめる。**既存の people / generations データは絶対に失わない**。

## スコープ

含む:
- 複数ガチャに対応する軽い抽象化（フロント / DB / プロンプト）
- 居酒屋ガチャ用のデータ（形容詞流用 + 居酒屋メニュー 約40件 + 意味・ネタ・材料）
- 居酒屋用の画像生成プロンプト（今回提示された長文をそのまま使用）
- 一覧に「居酒屋役職ガチャ」を追加

含まない:
- カクテルガチャの見た目・演出変更
- ガチャ管理画面（新規ガチャを UI から追加する機能等）
- 認証・課金・多言語

## 現状の把握

- `src/data/gachas.js` は id/title/banner/endsAt のみ。実装はカクテル前提。
- `src/lib/draw.js` は `adjectives + cocktails` からランダム抽選し `cocktailInfo` を返す。
- `src/App.jsx` は `usedCocktails` を保持し、`fetchPeople()` 全件から集計。
- `server/db.js` の people テーブルは `cocktail` 列で役職キーを保存。
- `server/prompt.js` は `PROMPT_TEMPLATE` 単一。`buildPrompt(title)` は `{カクテル名}` を置換。
- `POST /api/results` は `{name, adjective, cocktail, title, color}` を必須。
- `POST /api/generate` は person.title だけを参照してプロンプト生成。

## アーキテクチャ

「ガチャ」を **1つのデータ定義オブジェクト** として一本化する（フロント側）。

```js
// src/data/gachas.js
{
  id: 'cocktail' | 'izakaya',
  title: '...ガチャ',
  banner: <imported asset>,
  endsAt: 'ISO 8601',
  words: { adjectives: string[], topics: string[] },  // topics は元 cocktails
  itemInfo: Record<string, { meaning, note, ingredients }>,
  topicLabel: 'カクテル' | '役職',  // UI ラベル差し替え用（任意）
}
```

サーバー側はガチャ ID を軸に **プロンプトテンプレート** を選ぶだけの軽い切り替え。people 行に `gacha_id` を持たせ、抽出・除外・画像生成のいずれもガチャ単位で正しく動作させる。

## データモデル / DB マイグレーション

**people テーブル 最終形**:

| 列 | 型 | 備考 |
|---|---|---|
| id | INTEGER PK | 変更なし |
| name | TEXT NOT NULL | 変更なし |
| adjective | TEXT NOT NULL | 変更なし |
| **topic** | TEXT NOT NULL | **旧 `cocktail` からリネーム** |
| title | TEXT NOT NULL | 変更なし |
| color | TEXT NOT NULL | 変更なし |
| **gacha_id** | TEXT NOT NULL DEFAULT 'cocktail' | **新規追加** |
| created_at | TEXT NOT NULL | 変更なし |

**マイグレーション手順（`createDb` 内で idempotent に実行）**:

1. **バックアップは事前に手動で実施済み**（`data/gacha.db.backup-YYYYMMDD-HHMMSS`）。以降のマイグレーションは `data/gacha.db` に対して直接行う。
2. `PRAGMA table_info(people)` で列を検査。
3. `gacha_id` が無ければ `ALTER TABLE people ADD COLUMN gacha_id TEXT NOT NULL DEFAULT 'cocktail'`（既存行は全てカクテル扱いになる）。
4. `topic` 列が無く、かつ `cocktail` 列があるなら `ALTER TABLE people RENAME COLUMN cocktail TO topic`（SQLite 3.25+）。
5. `topic` も `cocktail` も無い場合はエラー（想定外）。
6. `generations` テーブルは変更なし（person 経由でガチャ判定できる）。

上記手順は SQLite の ALTER TABLE 制約下でも安全に動く。better-sqlite3 の同梱 SQLite は 3.25+ を満たしているため RENAME COLUMN が使える。

**データ保全チェック**:
- `createDb` の起動時に `SELECT COUNT(*) FROM people` を実行し、マイグレーション前後で値が変わらないことを（テストで）確認する。

## API 変更

**`GET /api/people?gacha=<id>`**:
- 未指定なら全ガチャ横断（既存互換）
- 指定時は該当ガチャの people だけ返す
- 返却行の列名は `topic`（旧 `cocktail`）に変わる

**`POST /api/results`**:
- 必須: `name, adjective, topic, title, color, gachaId`
- **破壊的変更**: 旧 `cocktail` フィールドは受け付けない。フロントは即座に更新する。

**`POST /api/generate`**:
- リクエストは既存通り `{personId, avatar}`。サーバーは person.gacha_id を見てプロンプトテンプレを選ぶ。

**`POST /api/cards` / `GET /api/pending` / `POST /api/publish`**:
- 変更なし。

## プロンプトテンプレート

`server/prompt.js` を以下に変更:

```js
export const PROMPT_TEMPLATES = {
  cocktail: `...既存の PROMPT_TEMPLATE そのまま...`,
  izakaya: `添付画像のアバターを元に、1:1のSNSアイコン用イラストを作成してください。
... （提示された本文をそのまま埋め込む） ...
役職名：
「{役職名}」
...`,
}

export function buildPrompt(gachaId, title) {
  const tpl = PROMPT_TEMPLATES[gachaId]
  if (!tpl) throw new Error(`unknown gacha: ${gachaId}`)
  return tpl.replaceAll('{カクテル名}', title).replaceAll('{役職名}', title)
}
```

- 既存の `PROMPT_TEMPLATE` export は削除し、呼び出し元（`server/index.js`）を `buildPrompt(person.gacha_id, person.title)` に更新。
- 既存カクテル prompt は文字は一切変更しない。

## フロント側の変更点

**`src/data/gachas.js`**:
- 2 ガチャを定義。`cocktail` は既存 cocktails.js / words.js を参照して `words`/`itemInfo` を構成。`izakaya` は新規 `izakaya.js` を参照。

**`src/data/izakaya.js`（新規）**:
- `izakayaTopics: string[]`（メニュー約40件）
- `izakayaMenuInfo: Record<string, {meaning, note, ingredients}>`
- 具体内容は別 PR / 別 commit で提示してユーザーレビューを受ける

**`src/lib/draw.js`**:
- `drawTitle(gacha, excludeTopics = [])` に変更。`gacha.words.adjectives` / `gacha.words.topics` から抽選、`gacha.itemInfo[topic]` を info として返す。
- 戻り値: `{ adjective, topic, title, info, gachaId: gacha.id }`（`cocktail` キー廃止）

**`src/lib/api.js`**:
- `fetchPeople(gachaId?)` に対応（`?gacha=<id>` を付与）
- `saveResult` は `topic`/`gachaId` を送るように更新

**`src/App.jsx`**:
- `selectedGacha` は id で保持（現状通り）。`gachas.find(g => g.id === selectedGacha)` でオブジェクト取得。
- `usedCocktails` → `usedTopics` にリネーム。`gacha.words.topics` の長さと比較して枯渇判定。
- `drawTitle(gacha, usedTopics)` に変更。
- `saveResult` で `topic`/`gachaId` を渡す。
- `fetchPeople(selectedGacha)` にする。

**`src/components/ResultDisplay.jsx` / `SaveResult.jsx`**:
- 現状の UI テキストを確認し、「カクテル」直書きがあれば汎用ラベル or `gacha.topicLabel` に置換。過度に汎用化はしない（カクテルガチャ内では「カクテル」ラベルが自然）。

**バナー画像**:
- ユーザー確認 → 「既に入ってるデータが消えないように」との指示は主眼が DB。バナーは仮のプレースホルダ画像（例: 単色に「居酒屋役職ガチャ」の日本語をベタ書きした簡易 PNG）を用意する。実装時にサンプル画像を追加し、後日差し替え可能。ファイル名は `src/assets/izakaya-banner.png`。

## テスト戦略（TDD）

**サーバー**:
- `server/db.test.js`
  - **既存**: cocktail 列前提のテストは topic に更新
  - **新規**: 「既存 cocktail 列だけの DB を開いた時に gacha_id が追加され、既存行の gacha_id が 'cocktail' になる」マイグレーションテスト
  - **新規**: 「cocktail 列が topic にリネームされ、既存行の値が保持されている」テスト
  - **新規**: `listPeople({ gachaId })` フィルタテスト
- `server/prompt.test.js`
  - `buildPrompt('cocktail', title)` が既存出力と一致
  - `buildPrompt('izakaya', title)` に `{役職名}` が正しく埋まる
  - 未知の gachaId で例外
- `server/index.test.js`
  - `/api/people?gacha=izakaya` フィルタ
  - `/api/results` が `topic`/`gachaId` を受け付ける
  - `/api/generate` が person.gacha_id に応じたプロンプトを選ぶ

**フロント**:
- `src/lib/draw.test.js` — `drawTitle(gacha, exclude)` の抽選 & 除外
- `src/lib/api.test.js` — `fetchPeople(gachaId)` のクエリ付与、`saveResult` の payload
- `src/components/GachaList.test.jsx` — 2 ガチャの表示（既存テストが1件前提なら更新）

## リスク & 緩和策

| リスク | 影響 | 緩和策 |
|---|---|---|
| マイグレーション失敗で既存データ喪失 | 致命 | 事前バックアップ済み。マイグレーションは ALTER TABLE のみで INSERT/UPDATE/DELETE を伴わない。テストで前後の COUNT を確認 |
| SQLite RENAME COLUMN 非対応環境 | 中 | better-sqlite3 同梱 SQLite は 3.25+ を満たすため対応済み。念のため package.json で最低バージョンを README に明記 |
| `POST /api/results` の破壊的変更でフロント/サーバー間に不整合 | 中 | 同一 PR/コミットで両方を更新。E2E 相当のテストを追加 |
| `usedTopics` の集計が全ガチャ横断のままだと別ガチャの topic を除外してしまう | 高（機能不全） | `fetchPeople(gachaId)` にガチャ ID を必ず渡す。フロントで `selectedGacha` が null の間は `fetchPeople` を呼ばない |
| バナー画像未確定 | 低 | 仮 PNG で先行実装、後日差し替え |

## 段階的ロールアウト

1. マイグレーション + テストのみを先にマージ（既存 API/フロントは破壊せず）
2. サーバー API を破壊的変更（`topic`/`gachaId`）＋ フロントを同時更新
3. 居酒屋ガチャの words/prompt/banner を追加
4. `gachas.js` に 2件目を登録して一覧に露出

## 完了条件

- カクテルガチャの動作が現状通り（DB、抽選、生成、公開）
- 居酒屋ガチャで、抽選 → 役職確定 → 名前保存 → アバターアップロード → 画像生成 → gallery 反映がエンドツーエンドで動く
- 既存 people / generations 行が失われていない（`SELECT COUNT(*)` で確認）
- 全テストが green
