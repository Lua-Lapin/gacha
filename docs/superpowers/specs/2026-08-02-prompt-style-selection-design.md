# プロンプトスタイル選択 設計

## 目的

ガチャごとに1つ固定だった生成プロンプトを、複数の「スタイル」から選べるようにする。
第一弾として海の生き物ガチャに、既存の「かわいいカード風」に加えて
「アルバムジャケット風」を追加する。ギャラリーではスタイルで絞り込める。

## 前提

- スタイルは人物ではなく **生成ごとの属性**。同じ人物を両スタイルで生成できる。
- プロンプト本文はサーバーが唯一の真実源。クライアントはIDとラベルだけを扱う。

## データモデル

### スタイル定義

`server/prompts/<gacha>.js` が配列をエクスポートする。

```js
export const SEA_STYLES = [
  { id: 'card',   label: 'かわいいカード風', template: SEA_TEMPLATE },
  { id: 'jacket', label: 'ジャケット風',     template: SEA_JACKET_TEMPLATE },
]
```

カクテル・居酒屋も同じ形式の1要素配列にし、全ガチャで構造をそろえる
(`COCKTAIL_STYLES` は `{ id: 'standard', label: 'スタンダード' }`、
`IZAKAYA_STYLES` も同じく `id: 'standard'`)。配列の**先頭が既定スタイル**。
海の既定は `card`（既存の全生成がこれに該当する）。

### `server/prompt.js`

`PROMPT_TEMPLATES` を `GACHA_STYLES = { cocktail, izakaya, sea }` に置き換え、
以下をエクスポートする。

- `listStyles(gachaId)` → `[{ id, label }]`（template は返さない）。未知のガチャは throw。
- `defaultStyleId(gachaId)` → 配列先頭の id。
- `buildPrompt(gachaId, title, styleId)` → styleId 省略時は既定を使う。
  **未知の styleId は throw**（黙って既定にフォールバックしない）。
  プレースホルダ置換は現行どおり `{カクテル名}` / `{役職名}` の両方。

### DB

`generations` に `style_id TEXT` を追加する。既存の `published` 追加と同じ
`PRAGMA table_info` 判定パターンを使い、カラム追加直後に一度だけバックフィルする。

既定スタイルIDは JS 側の `defaultStyleId(gachaId)` から取得し、ガチャごとに
次を実行する。SQL に既定IDをハードコードしない。

```sql
UPDATE generations SET style_id = ?
WHERE style_id IS NULL
  AND person_id IN (SELECT id FROM people WHERE gacha_id = ?)
```

`prompt = 'card'` の行（クライアント描画カード）も埋まるが、`buildManifest` が
従来どおり除外するのでギャラリーには影響しない。

`insertGeneration` は `styleId` を受け取って保存する。成功・失敗どちらの記録にも残す。
`listSuccessfulGenerations` は `g.style_id AS styleId` を返す。

## API

- `GET /api/styles?gacha=<id>` → `[{ id, label }]`。未知のガチャは 400。
- `POST /api/generate` に `styleId`（任意）を追加。省略時はそのガチャの既定。
  未知の styleId は 400 を返し、生成もDB記録も行わない。
- `buildManifest` の各エントリに `styleId` を追加。ラベルはギャラリー側が持つ。

## フロント（生成画面）

`src/components/GeneratePage.jsx`

- 人物セレクトの直下、アバター入力の上に「スタイル」セレクトを追加。
- 人物を選ぶと、その人の `gacha_id` で `fetchStyles` を呼び、既定を初期選択にする。
- **スタイルが1件だけのガチャではセレクトを描画しない**（選択肢のないUIを出さない）。
  ただし内部では取得済みの既定IDを保持し、送信は常に行う（分岐を減らすため）。
- ジョブのラベルにスタイル名を併記する: `ゆか（怒りのタツノオトシゴ）— ジャケット風`。
  同一人物を両スタイルで回したときに区別できるようにするため。
- 生成後もスタイル選択は保持する（連続生成の想定）。

`src/lib/api.js`

- `generate(personId, file, styleId)` — styleId があれば FormData に付ける。
- `fetchStyles(gachaId)` を新設。

## ギャラリー

`gallery/main.js`

- ガチャタブは現状維持。その下に、**選択中のガチャに複数スタイルが存在するときだけ**
  スタイルのサブタブを描画する（「すべて」＋各スタイル、件数付き）。
  「すべて」タブ選択時はスタイルサブタブを出さない。
- ガチャタブを切り替えたらスタイル選択は `all` にリセットする。
- ラベルは `GACHA_LABELS` と同じ方針でギャラリー側に定義する
  (`STYLE_LABELS = { card: 'かわいいカード風', jacket: 'ジャケット風' }`)。
  React 側の `src/data/` は参照しない。未知IDは id をそのまま表示。
- hash は `#sea`（従来） / `#sea:jacket`（新）。`resolveInitialTab` を
  `{ gachaId, styleId }` を返す形に拡張する。未知のスタイルIDは `all` にフォールバック。
- `styleId` を持たないエントリは、スタイル絞り込み時には表示しない
  （マイグレーションで通常は発生しないが、防御的に）。

## 新プロンプト（`SEA_JACKET_TEMPLATE`）

役職名は `{役職名}` プレースホルダで埋め込む。全文:

```
添付されたアバター画像を主人公として使用し、役職名「{役職名}」をテーマにした、正方形の音楽アルバムジャケット風イラストを制作してください。

役職名は「形容詞＋海の生き物」で構成されています。
役職名を単に文字として載せるだけではなく、形容詞が表す感情・空気感・時間帯・光・色彩と、海の生き物が持つ形状・動き・生息環境・透明感を組み合わせ、ひとつの印象的な世界観として視覚化してください。

【アバターの扱い】
・添付アバターの髪型、髪色、眼鏡、顔立ち、アクセサリーなど、本人だと分かる特徴を維持する
・元衣装をそのまま複製する必要はなく、役職の世界観に合わせて洗練された衣装へアレンジする
・アバターを画面の中心から少し外した位置に大きく配置し、上半身を主体にした印象的な構図にする
・カメラ目線ではなく、少し上方や遠くを見つめる自然な視線にする
・表情は役職名の形容詞に合わせ、静かで物語性のある表情にする

【ビジュアル表現】
・おしゃれなインディーズ音楽、ドリームポップ、アンビエント、エレクトロニカのジャケット写真のような仕上がり
・幻想的で透明感があり、静謐で少し儚い雰囲気
・水中、深海、海面下、泡、光の屈折、浮遊物などを活用する
・海の生き物は背景の飾りではなく、役職の象徴としてアバターの周囲に自然に配置する
・前景・中景・背景を作り、奥行きのある映画的な構図にする
・柔らかな逆光、淡いリムライト、揺らぐ水面光、微細な粒子
・青、藍、紫、白を基調にしつつ、役職名に応じてアクセントカラーを加える
・繊細なアニメイラスト、高密度な描き込み、上品な陰影、美しい髪の流れ
・過度に派手なゲームイラストではなく、アートディレクションされた作品として仕上げる

【文字デザイン】
画像内に役職名「{役職名}」を日本語で配置してください。
・細身で上品な明朝体、または繊細なセリフ書体
・左上または余白のある位置に小さめに配置
・白または淡い色
・必要に応じて細い罫線、小さな記号、控えめな英字サブタイトルを添える
・文字を主張させすぎず、ジャケット全体のデザインに溶け込ませる
・文字化け、誤字、不自然な日本語を避ける

【仕上げ】
・1:1の正方形
・アルバムジャケットとして成立する完成度
・サムネイル表示でも人物とテーマが伝わる構図
・洗練されていて、幻想的、詩的、静かで印象に残る作品
・背景込みの完成された一枚絵
・写真風ではなく、繊細で美麗なアニメイラスト

役職名「{役職名}」から連想される情景を自由に解釈し、既存作品の模倣ではない、オリジナルのジャケットデザインにしてください。
```

## テスト

既存の構成（vitest、`*.test.js` をモジュール隣接に配置）に従う。

- `server/prompt.test.js` — `listStyles` / `defaultStyleId` / styleId 指定の
  `buildPrompt` / 未知 styleId で throw / 未知 gachaId で throw。
- `server/db.test.js` — `style_id` カラム追加、既存行のガチャ別バックフィル、
  `insertGeneration` の styleId 保存、`listSuccessfulGenerations` の styleId 返却。
- `server/index.test.js` — `GET /api/styles`、`POST /api/generate` の styleId 受け渡し、
  未知 styleId で 400（generateImage が呼ばれないこと）、manifest への styleId 反映。
- `server/manifest.test.js` — エントリに styleId が入ること。
- `src/components/GeneratePage.test.jsx` — 単一スタイル時にセレクト非表示、
  複数時に選択値が `generate` に渡ること、ジョブラベルにスタイル名が出ること。
- `gallery/render.test.js` — スタイルサブタブの描画条件、スタイル絞り込み、
  `#sea:jacket` の hash 解決と未知IDのフォールバック。

## スコープ外

- カクテル・居酒屋への2つ目のスタイル追加（仕組みだけ用意する）
- 生成画面側でのスタイル絞り込み（ギャラリーのみ）
- 既存生成画像の再生成やスタイル変更
