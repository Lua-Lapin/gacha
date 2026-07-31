# 海の生き物ガチャ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3つ目のガチャ「海の生き物役職ガチャ」（2026年8月末まで）を追加し、既存2ガチャを期間終了で一覧から外す。

**Architecture:** ガチャ定義は `src/data/gachas.js` の配列に1件追加するだけで済む構造が既にある。専用の形容詞50個と海の生き物50種は新規ファイル `src/data/sea.js` に置き、`itemInfo` の3行目を `ingredients` から汎用的な `details` へ改名してラベルをガチャごとに持たせる。終了判定は `endsAt` を使う純粋関数を `src/lib/deadline.js` に足し、一覧を描画する直前でフィルタする。肥大化するプロンプトテンプレートは `server/prompts/` に切り出す。

**Tech Stack:** React 19 / Vite 8 / Vitest 4 / Express（既存構成のまま、新規依存なし）

**Spec:** `docs/superpowers/specs/2026-08-01-sea-creature-gacha-design.md`

**Branch:** `feat/sea-creature-gacha`（作業開始時にこのブランチにいることを確認する）

---

## File Structure

**新規:**
- `src/data/sea.js` — 海ガチャ専用の形容詞50個と生き物50種の情報
- `src/data/sea.test.js` — 件数・重複・必須フィールドの検証
- `server/prompts/cocktail.js` / `izakaya.js` / `sea.js` — プロンプトテンプレート本文

**変更:**
- `src/data/cocktails.js` / `src/data/izakaya.js` — `ingredients` → `details`
- `src/data/gachas.js` — `detailLabel` 追加、海ガチャ登録、締切変更
- `src/components/ResultDisplay.jsx` / `.css` — `details` と `detailLabel` 対応
- `src/lib/deadline.js` — `isActive` 追加
- `src/App.jsx` — 終了ガチャのフィルタ、`detailLabel` の受け渡し
- `server/prompt.js` — テンプレート本文を `server/prompts/` から import する形へ
- `gallery/main.js` — `GACHA_LABELS` に `sea` を追加
- 追従するテスト: `src/components/ResultDisplay.test.jsx` / `src/App.test.jsx` / `src/lib/draw.test.js` / `src/lib/deadline.test.js` / `server/prompt.test.js`

**責務の分離:** テンプレート本文（長大な文字列）と、テンプレートを選んで置換するロジック（`buildPrompt`）を別ファイルに分ける。`prompt.js` の公開インターフェース（`PROMPT_TEMPLATES` / `buildPrompt`）は変えないので、`server/index.js` と既存テストは無変更で通る。

---

## Task 1: 海の生き物データ

**Files:**
- Create: `src/data/sea.js`
- Test: `src/data/sea.test.js`

- [ ] **Step 1: Write the failing test**

`src/data/sea.test.js` を新規作成する。

```javascript
import { describe, it, expect } from 'vitest'
import { seaAdjectives, seaCreatureInfo } from './sea.js'

describe('seaAdjectives', () => {
  it('has exactly 50 adjectives', () => {
    expect(seaAdjectives).toHaveLength(50)
  })

  it('has no duplicates', () => {
    expect(new Set(seaAdjectives).size).toBe(seaAdjectives.length)
  })

  it('has no empty entries', () => {
    expect(seaAdjectives.every((a) => typeof a === 'string' && a.length > 0)).toBe(true)
  })
})

describe('seaCreatureInfo', () => {
  const names = Object.keys(seaCreatureInfo)

  it('has exactly 50 creatures', () => {
    expect(names).toHaveLength(50)
  })

  it('gives every creature a meaning, a note and details', () => {
    for (const name of names) {
      const info = seaCreatureInfo[name]
      expect(typeof info.meaning, name).toBe('string')
      expect(info.meaning.length, name).toBeGreaterThan(0)
      expect(typeof info.note, name).toBe('string')
      expect(info.note.length, name).toBeGreaterThan(0)
      expect(Array.isArray(info.details), name).toBe(true)
      expect(info.details.length, name).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/sea.test.js`
Expected: FAIL（`Failed to resolve import "./sea.js"`）

- [ ] **Step 3: Write the data file**

`src/data/sea.js` を新規作成する。内容は以下のとおり（そのまま使う）。

```javascript
// 海の生き物ガチャ専用の語彙。
// 形容詞は「海の世界観の新規語」と「既存 words.js からの流用」を混ぜている。
// 流用分は、表情やポーズに落としやすい定番語を選んでいる。
export const seaAdjectives = [
  // 海の世界観の新規語（30）
  'ゆらゆらした',
  '潮まみれの',
  '深海育ちの',
  '波に乗った',
  '泡だらけの',
  'ぷかぷか浮かぶ',
  '潮の香りがする',
  '海底で拾った',
  '流されがちな',
  '満潮の',
  '干潮の',
  '渦を巻く',
  '岩陰に隠れた',
  'きらきら光る',
  'ひんやりした',
  'ぬるま湯育ちの',
  '砂に潜った',
  '藻まみれの',
  '沖に出たがる',
  '浅瀬が好きな',
  '月夜に浮かぶ',
  '群れからはぐれた',
  '珊瑚に住みつく',
  'しょっぱい',
  '底なしの',
  '打ち上げられた',
  '呼吸が長い',
  '潜りっぱなしの',
  '波間を漂う',
  '貝殻を集める',
  // 既存 words.js からの流用（20）
  '眠そうな',
  'やかましい',
  'のんきな',
  '落ち着いた',
  '陽気な',
  '不敵な',
  'まじめな',
  'さわやかな',
  '気まずい',
  'せっかちな',
  '物静かな',
  '圧が強い',
  '妙に詳しい',
  'すぐ謝る',
  'やたら元気な',
  '夢見がちな',
  'ご機嫌な',
  '渋い',
  '風格のある',
  'ふてぶてしい',
]

// 海の生き物情報。cocktails.js / izakaya.js と対称の形。
// meaning: その生き物の「海の生き物言葉」的な一言
// note: ガチャ世界観の一行ネタ
// details: 絵の手がかりになる特徴（画像生成の識別性を上げるため見た目の語を選ぶ）
export const seaCreatureInfo = {
  'クラゲ': { meaning: 'ただよう癒し', note: '流れに逆らわず場をやわらげる', details: ['透明', 'ふわふわ', '発光'] },
  'シャチ': { meaning: '海の統率者', note: '群れを率いてきっちり仕留める', details: ['白黒', '大きな背びれ', '群れ'] },
  'イルカ': { meaning: '人なつこい司会', note: '誰とでもすぐ打ち解ける', details: ['すべすべ', 'ジャンプ', '笑ったような口元'] },
  'ジンベエザメ': { meaning: '大きな包容力', note: '大きいのに誰も脅かさない', details: ['巨体', '水玉模様', '大きな口'] },
  'シュモクザメ': { meaning: '視野の広い監視役', note: '横に広い視界で全部見ている', details: ['T字の頭', '左右に離れた目', '鋭い背びれ'] },
  'マンボウ': { meaning: 'マイペースの極み', note: '漂っているだけで場が和む', details: ['丸い体', 'ちぎれた尾', '日光浴'] },
  'タツノオトシゴ': { meaning: '律儀な世話役', note: '尻尾を絡めたら離さない', details: ['巻いた尾', '筒状の口', '直立'] },
  'カクレクマノミ': { meaning: '住みこみの相棒', note: '決めた場所から動かない', details: ['オレンジ', '白い帯', 'イソギンチャク'] },
  'チンアナゴ': { meaning: '顔だけ出す観察者', note: '危なくなるとすぐ引っ込む', details: ['砂から顔', '細長い', '点模様'] },
  'ラッコ': { meaning: '道具を使う器用者', note: '手を繋いで流されない', details: ['石を持つ', 'あお向け', 'ふさふさ'] },
  'アザラシ': { meaning: 'まるい安心感', note: 'ごろごろしているだけで許される', details: ['まるい体', '短いひれ', 'うるんだ目'] },
  'セイウチ': { meaning: '重鎮の風格', note: '動かないのに誰も逆らえない', details: ['長い牙', 'ひげ', '分厚い体'] },
  'ペンギン': { meaning: '直立の生真面目', note: '列を崩さず歩く', details: ['白黒', 'よちよち歩き', '短い羽'] },
  'ウミガメ': { meaning: '長生きの語り部', note: '同じ浜へ必ず帰ってくる', details: ['甲羅', '大きなひれ', 'ゆったり'] },
  'タコ': { meaning: '八方に手が回る', note: '手が多い分だけ仕事を抱える', details: ['8本の腕', '吸盤', '壺'] },
  'イカ': { meaning: '墨を吐いて撤退', note: '不利になると煙に巻く', details: ['三角のひれ', '10本の足', '墨'] },
  'ホタルイカ': { meaning: '夜光の小粒', note: '小さいのに一番目立つ', details: ['青い発光', '小さい', '群れ'] },
  'メンダコ': { meaning: '耳つきの深海アイドル', note: '深海にいるのにやたら可愛い', details: ['耳のようなひれ', 'まんまる', 'ピンク'] },
  'ヒトデ': { meaning: '五方に伸びる', note: 'どこから見ても正面', details: ['五本腕', '星形', '岩肌'] },
  'ウニ': { meaning: 'とげの防御力', note: '触れると痛いが中身は上等', details: ['全身のとげ', '球形', '岩の間'] },
  'ヤドカリ': { meaning: '住み替えの達人', note: '手頃な居場所を渡り歩く', details: ['借りた貝殻', 'はさみ', '引っ込む'] },
  'カニ': { meaning: '横歩きの現場主義', note: '正面から行かず横から詰める', details: ['横歩き', '大きなはさみ', '甲羅'] },
  'タカアシガニ': { meaning: '足の長い長老', note: '手足が長すぎて場所を取る', details: ['異様に長い脚', '巨大', '深海'] },
  'エビ': { meaning: '腰の低い働き者', note: '曲がった腰で場を支える', details: ['曲がった体', '長いひげ', '跳ねる'] },
  'カブトガニ': { meaning: '生きた化石', note: '古いやり方を守り続ける', details: ['兜型の甲羅', '細い尾', '浅瀬'] },
  'シャコ': { meaning: '一撃必殺の拳', note: '見た目より打撃が重い', details: ['極彩色', '強力な前脚', '複眼'] },
  'ホタテ': { meaning: '開いて閉じる二枚看板', note: '開くときだけ全部見せる', details: ['扇形の貝', 'たくさんの目', '跳ねて泳ぐ'] },
  'オウムガイ': { meaning: '渦巻きの記録係', note: '過去を巻き込んで大きくなる', details: ['渦巻きの殻', '触手', '縞模様'] },
  'ウミウシ': { meaning: '極彩色の変わり者', note: '毒も色も遠慮なく出す', details: ['鮮やかな色', '触角', 'ひらひら'] },
  'クリオネ': { meaning: '氷の天使', note: '可憐な見た目で油断させる', details: ['透明な体', '翼状のひれ', '小さい'] },
  'イソギンチャク': { meaning: '受け入れの器', note: '来た相手を包んで離さない', details: ['ゆれる触手', '筒状', '岩に固着'] },
  'サンゴ': { meaning: '積み上げる建築家', note: '何世代もかけて土台を作る', details: ['枝分かれ', '鮮やかな色', '群体'] },
  'マンタ': { meaning: '悠然の滑空', note: '羽ばたかずに海を渡る', details: ['大きな胸びれ', '白い腹', 'ゆっくり旋回'] },
  'ダンゴウオ': { meaning: 'まんまるの新人', note: '小さくて丸くて動きが下手', details: ['まんまる', '吸盤', '鮮やかな赤'] },
  'ジュゴン': { meaning: '草食の穏やか者', note: '争わず海草だけ食べる', details: ['丸い体', '大きな尾', '海草'] },
  'シロイルカ': { meaning: '愛嬌の塊', note: '丸い額で表情がころころ変わる', details: ['真っ白', '丸い額', '表情豊か'] },
  'マッコウクジラ': { meaning: '深く潜る思索家', note: '長く潜って戻ってこない', details: ['四角い頭', '巨体', '深海'] },
  'ザトウクジラ': { meaning: '海の歌い手', note: '延々と歌い続ける', details: ['長い胸びれ', 'こぶ', 'ジャンプ'] },
  'トビウオ': { meaning: '飛んで逃げる', note: '逃げ足がとにかく速い', details: ['翼のような胸びれ', '水面を滑空', '細身'] },
  'タチウオ': { meaning: '銀の一本気', note: 'まっすぐ立って譲らない', details: ['銀色', '細長い', '立ち泳ぎ'] },
  'フグ': { meaning: '膨らむ威嚇', note: '怒ると倍に膨らむ', details: ['膨らんだ体', '小さなひれ', 'とがった口'] },
  'ハリセンボン': { meaning: '全身の警戒心', note: '警戒するととげが立つ', details: ['無数のとげ', '大きな目', '丸い体'] },
  'ミノカサゴ': { meaning: '華やかな危険', note: '綺麗なものには毒がある', details: ['広がるひれ', '縞模様', 'ゆらめく'] },
  'マグロ': { meaning: '止まらない働き者', note: '止まると死ぬと思っている', details: ['紡錘形', '高速遊泳', '青い背'] },
  'カジキ': { meaning: '一点突破', note: '突き進むことしか考えていない', details: ['長い吻', '大きな背びれ', '高速'] },
  'タイ': { meaning: 'めでたい看板', note: 'いるだけで場が格上げされる', details: ['赤い体', '立派な尾', '祝いの席'] },
  'ヒラメ': { meaning: '底で待つ', note: '目立たず好機だけ待つ', details: ['平たい体', '片側に寄った目', '砂に潜る'] },
  'サケ': { meaning: '故郷に帰る', note: '苦労してでも元の場所へ戻る', details: ['銀色', '川をのぼる', '斑点'] },
  'シーラカンス': { meaning: '変わらない古参', note: '何億年もやり方を変えない', details: ['太いひれ', '青い体', '深海'] },
  'リュウグウノツカイ': { meaning: '深海の使者', note: '現れると何かが起こる', details: ['銀の帯状の体', '赤い背びれ', '長大'] },
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/sea.test.js`
Expected: PASS（6ケース）

- [ ] **Step 5: Commit**

```bash
git add src/data/sea.js src/data/sea.test.js
git commit -m "feat: add sea creature gacha vocabulary"
```

---

## Task 2: `ingredients` を `details` へ改名

**Files:**
- Modify: `src/data/cocktails.js`, `src/data/izakaya.js`
- Modify: `src/components/ResultDisplay.jsx`, `src/components/ResultDisplay.css`
- Modify: `src/data/gachas.js`（冒頭コメントと `detailLabel` 追加）
- Test: `src/components/ResultDisplay.test.jsx`, `src/App.test.jsx`, `src/lib/draw.test.js`

- [ ] **Step 1: Write the failing test**

`src/components/ResultDisplay.test.jsx` のフィクスチャの `ingredients` を `details` に変え、ラベルが prop で変わることを確かめるテストを足す。既存の2ケースのフィクスチャも同様に `details` へ変更する。

```javascript
  it('labels the details line with the given detailLabel', () => {
    render(
      <ResultDisplay
        title="ゆらゆらしたクラゲ"
        info={{ meaning: 'ただよう癒し', note: 'x', details: ['透明', '発光'] }}
        itemLabel="海の生き物"
        itemEmoji="🐙"
        detailLabel="特徴"
      />
    )
    expect(screen.getByText('特徴：透明 / 発光')).toBeTruthy()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ResultDisplay.test.jsx`
Expected: FAIL（`info.ingredients` が undefined で `.join` に失敗、または「特徴：」が見つからない）

- [ ] **Step 3: Rename the data keys**

`src/data/cocktails.js` と `src/data/izakaya.js` の全エントリで `ingredients:` を `details:` に置換する。値は変更しない。

```bash
sed -i '' 's/ingredients:/details:/g' src/data/cocktails.js src/data/izakaya.js
```

置換後、`grep -c 'details:' src/data/cocktails.js src/data/izakaya.js` で件数が置換前の `ingredients:` の件数と一致することを確認する。

- [ ] **Step 4: Update ResultDisplay**

`src/components/ResultDisplay.jsx` を次に置き換える。

```jsx
import './ResultDisplay.css'

export default function ResultDisplay({ title, info, itemLabel = 'カクテル', itemEmoji = '🍸', detailLabel = '材料' }) {
  return (
    <div className="result">
      <p className="result-title">{title}</p>

      {info && (
        <div className="cocktail-info">
          <p className="cocktail-meaning">{itemEmoji} {itemLabel}言葉：「{info.meaning}」</p>
          <p className="cocktail-note">ひとこと：{info.note}</p>
          <p className="cocktail-details">
            {detailLabel}：{info.details.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
}
```

`src/components/ResultDisplay.css` の `.cocktail-ingredients` を `.cocktail-details` に改名する。

- [ ] **Step 5: Update gachas.js**

`src/data/gachas.js` 冒頭コメントの `meaning/note/ingredients` を `meaning/note/details` に直し、`detailLabel` の説明を1行足す。既存2ガチャに `detailLabel: '材料'` を追加する。

```javascript
// itemInfo: 役職ごとの meaning/note/details
// itemLabel: UI で「◯◯言葉」の◯◯部分に使う（例: 'カクテル' / '役職'）
// detailLabel: UI で details 行の見出しに使う（例: '材料' / '特徴'）
```

- [ ] **Step 6: Update the remaining test fixtures**

`src/App.test.jsx:97` と `src/lib/draw.test.js:62-63` の `ingredients` を `details` に変える。`draw.test.js` は全ガチャの `itemInfo` を走査しているので、Task 1 で足した `sea.js` がまだ `gachas.js` に登録されていなくてもこの時点では通る。

- [ ] **Step 7: Run tests**

Run: `npx vitest run src && npm run lint`
Expected: PASS。`grep -rn "ingredients" src` の結果が0件であることも確認する。

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "refactor: rename itemInfo ingredients to details with a per-gacha label"
```

---

## Task 3: プロンプトの分割と海テンプレート

**Files:**
- Create: `server/prompts/cocktail.js`, `server/prompts/izakaya.js`, `server/prompts/sea.js`
- Modify: `server/prompt.js`
- Test: `server/prompt.test.js`

- [ ] **Step 1: Write the failing test**

`server/prompt.test.js` に追加する。

```javascript
  it('builds the sea prompt with the title filled in', () => {
    const out = buildPrompt('sea', 'ゆらゆらしたクラゲ')
    expect(out).toContain('ゆらゆらしたクラゲ')
    expect(out).toContain('役職名は「形容詞＋海の生き物」という構成です。')
  })

  it('leaves no unreplaced placeholder in the sea prompt', () => {
    const out = buildPrompt('sea', 'ゆらゆらしたクラゲ')
    expect(out).not.toContain('{')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/prompt.test.js`
Expected: FAIL（`unknown gacha: sea`）

- [ ] **Step 3: Move the existing templates**

`server/prompts/cocktail.js` を新規作成し、`server/prompt.js` の `COCKTAIL_TEMPLATE` の**本文をそのまま**移す。

```javascript
export const COCKTAIL_TEMPLATE = `添付したアバターを元に、正方形のカクテルアイコン風イラストを作成してください。
（以下、現在の server/prompt.js にある COCKTAIL_TEMPLATE の本文をそのままコピーする）`
```

同様に `server/prompts/izakaya.js` に `IZAKAYA_TEMPLATE` を移す。**本文は1文字も変えない**（改行・句読点・全角記号を含む）。手で打ち直さず、現行ファイルから切り取って貼ること。既存の `server/prompt.test.js` が本文の一部を検証しているので、変わっていればテストが落ちる。

- [ ] **Step 4: Create the sea template**

`server/prompts/sea.js` を新規作成する。内容は以下のとおり。

```javascript
export const SEA_TEMPLATE = `添付されたアバター画像を人物の参照資料として使用し、役職名「{役職名}」をテーマにした、1:1の正方形キャラクターイラストを作成してください。

役職名は「形容詞＋海の生き物」という構成です。

【最重要：アバター本人の再現】

添付画像の人物を、別人や別キャラクターに置き換えないでください。

髪型、前髪、髪色、目の形と色、顔立ち、年齢感、性別表現、主要な衣装、アクセサリー、本人らしい雰囲気を優先して維持してください。

衣装の細かな布目、縫い目、複雑な柄は簡略化して構いませんが、本人だと分かるシルエット、配色、主要なデザインは残してください。

原画をそのまま写実的に描き写すのではなく、作例のような、かわいい日本のセミデフォルメアニメイラストにしてください。

極端なちびキャラにはせず、3.5〜4.5頭身程度の自然なセミデフォルメ体型にしてください。頭部を大きくしすぎず、顔を幼く丸くしすぎず、手足も極端に短くしないでください。

【役職名の表現】

役職名の前半にあたる形容詞の意味が、表情、姿勢、視線、手の動き、小物のいずれかから、文字を読まなくても一目で伝わるようにしてください。

形容詞に合ったポーズや演出を自然に取り入れてください。

例：
・眠そう：半分閉じた目、あくび、力の抜けた姿勢
・やかましい：大きく開いた口、メガホン、勢いのあるポーズ
・のんびり屋：穏やかな微笑み、ゆったり座る、頬杖、温かい飲み物
・気まぐれ：視線をそらす、自由な姿勢、気分屋らしい表情

役職名の後半にあたる海の生き物は、アバターの背後または頭上に、ひと目で種類が分かる大きなモチーフとして配置してください。

表現方法は、以下のいずれかにしてください。

・背後の大型マスコット
・頭上に浮かぶ象徴的なシルエット
・大きなフード
・顔を隠さない帽子

海の生き物は、体形、ヒレ、尾びれ、触手、模様など、識別に必要な特徴を明快に描いてください。

人物を海の生き物そのものに変身させたり、人体と海洋生物を融合させたりしないでください。最後まで人型のアバターとして描いてください。

海洋生物モチーフで、顔、前髪、目、アクセサリーを隠さないでください。

【構図】

・1:1の正方形
・正面または軽い斜め向き
・アバターを中央に大きく配置
・3.5〜4.5頭身程度
・顔を画面中央付近に配置
・上半身、座り姿、または簡略化した全身
・両手の位置が自然に分かるポーズ
・大型の海洋生物モチーフは頭上または背後
・キャラクターの周囲に適度な余白を残す
・左右の装飾量をある程度そろえる
・泡、海藻、貝殻、小さな海洋生物などを3〜6個程度配置
・外周に、角丸で緩やかに波打つ手描き風フレームを付ける
・画面下部に横長のリボン型バナーを配置する
・バナーは画面下端から高さ20％以内に収める
・バナーで顔、手、主要な衣装を隠さない

【絵柄】

かわいい日本のアニメイラストを基調にした、上品なセミデフォルメ表現にしてください。

・3.5〜4.5頭身
・頭身を低くしすぎない
・顔や身体を幼く丸くしすぎない
・目は大きめで透明感を持たせるが、極端な巨大目にはしない
・小さく自然な鼻と口
・手足は簡略化しつつ、自然な長さと関節を保つ
・太すぎない、滑らかで整った輪郭線
・細密すぎる線や写実的な描き込みは避ける
・セル塗りを基調に、柔らかなグラデーションを加える
・影は柔らかく、1〜2段階程度
・髪、目、泡に控えめな透明感と光沢を加える
・プロフィールカード、絵本、グッズイラストのような仕上がり
・かわいく、明るく、親しみやすく、少し繊細な印象

極端に頭が大きいSDキャラクターや、丸く単純化しすぎたマスコット風の人物表現にはしないでください。

【配色・背景】

以下の色を基調にしてください。

・ラベンダー
・薄紫
・淡い水色
・白
・クリーム色

添付アバターの髪色や衣装が暗い場合も、その色とデザインは維持してください。

背景と装飾を淡い色にし、人物が埋もれないように全体を軽やかにまとめてください。

背景は白またはクリーム色を広く残し、淡いラベンダーや水色のフレーム、泡、海藻などを配置してください。

情報量を増やしすぎず、以下の3層が明確に分かれる構成にしてください。

1. 中央のアバター
2. 頭上または背後の大型海洋生物モチーフ
3. 外周の泡、海藻、小さな装飾

【バナーの文字】

画面下部のリボン型バナーに、次の役職名だけを日本語で正確に記載してください。

「{役職名}」

・一行で配置
・中央揃え
・太く読みやすい丸ゴシック風
・濃い紫色の文字
・白または薄紫のバナー
・文字数に合わせて自然に縮小
・誤字、脱字、言い換え、重複、余計な記号を入れない
・バナー以外には文字を入れない

【避ける表現】

極端なSDキャラクター、2〜3頭身、巨大すぎる頭、幼児体型、短すぎる手足、5頭身以上の写実的な人体比率、別人化、過度に丸い顔、極端に大きな目、写実的な顔や身体、厚塗り、油彩風、強い水彩のにじみ、暗い照明、映画的なライティング、複雑な遠近法、過剰な装飾、小物の密集、衣服の細密すぎる柄、海洋生物と人体の融合、顔を覆う帽子やマスコット、不自然な関節、手や指の増加、性的な表現、ロゴ、署名、透かし、バナー以外の文字、意味不明な文字。`
```

- [ ] **Step 5: Rewrite prompt.js**

`server/prompt.js` を次に置き換える。

```javascript
import { COCKTAIL_TEMPLATE } from './prompts/cocktail.js'
import { IZAKAYA_TEMPLATE } from './prompts/izakaya.js'
import { SEA_TEMPLATE } from './prompts/sea.js'

export const PROMPT_TEMPLATES = {
  cocktail: COCKTAIL_TEMPLATE,
  izakaya: IZAKAYA_TEMPLATE,
  sea: SEA_TEMPLATE,
}

export function buildPrompt(gachaId, title) {
  const tpl = PROMPT_TEMPLATES[gachaId]
  if (!tpl) throw new Error(`unknown gacha: ${gachaId}`)
  return tpl.replaceAll('{カクテル名}', title).replaceAll('{役職名}', title)
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run server && npm run lint`
Expected: PASS。既存のカクテル/居酒屋のテンプレートテストが通ることで、移動時に本文が変わっていないことが確認できる。

- [ ] **Step 7: Commit**

```bash
git add -A server
git commit -m "feat: add the sea gacha prompt and split templates into files"
```

---

## Task 4: ガチャの登録・バナー・ギャラリーのラベル

**Files:**
- Modify: `src/data/gachas.js`
- Modify: `src/App.jsx`（`detailLabel` の受け渡し）
- Create: `src/assets/sea-banner.png`（仮画像。ユーザーが後で差し替える）
- Modify: `gallery/main.js`
- Test: `gallery/render.test.js`, `src/lib/draw.test.js`

- [ ] **Step 1: Place a placeholder banner**

`src/assets/sea-banner.png` が既に存在するなら**何もしない**（ユーザーが用意した本番画像を上書きしないこと）。存在しない場合のみ、ビルドを通すための単色PNGを生成する。

```bash
test -f src/assets/sea-banner.png || node --input-type=module -e "
import {writeFileSync} from 'node:fs';
// 1x1 の淡い水色PNG（仮画像。ユーザーが後で差し替える）
const b64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP4z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
writeFileSync('src/assets/sea-banner.png', Buffer.from(b64,'base64'));
console.log('placeholder written');
"
```

- [ ] **Step 2: Register the gacha**

`src/data/gachas.js` に import と配列エントリを足す。

```javascript
import seaBanner from '../assets/sea-banner.png'
import { seaAdjectives, seaCreatureInfo } from './sea.js'
```

配列の末尾に追加する。

```javascript
  {
    id: 'sea',
    title: '海の生き物役職ガチャ',
    banner: seaBanner,
    endsAt: '2026-08-31T23:59:00+09:00',
    words: { adjectives: seaAdjectives, topics: Object.keys(seaCreatureInfo) },
    itemInfo: seaCreatureInfo,
    itemLabel: '海の生き物',
    itemEmoji: '🐙',
    detailLabel: '特徴',
  },
```

- [ ] **Step 3: Pass detailLabel through App.jsx**

`src/App.jsx` の `<ResultDisplay ...>` に `detailLabel={selectedGachaObj.detailLabel}` を足す。`itemLabel` / `itemEmoji` を渡している箇所のすぐ隣に置く。

- [ ] **Step 4: Add the gallery tab label**

`gallery/main.js` の `GACHA_LABELS` に1行足す。

```javascript
const GACHA_LABELS = {
  cocktail: '🍸 カクテル',
  izakaya: '🍶 居酒屋',
  sea: '🐙 海の生き物',
}
```

`gallery/render.test.js` の `buildTabs` のテストに、`sea` のエントリがラベル `🐙 海の生き物` になることを確かめるケースを足す。

```javascript
  it('labels the sea gacha', () => {
    const tabs = buildTabs([{ id: 1, name: 'n', title: 't', image: 'i', createdAt: '', gachaId: 'sea' }])
    expect(tabs[1]).toEqual({ id: 'sea', label: '🐙 海の生き物', count: 1 })
  })
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run lint`
Expected: PASS。`src/lib/draw.test.js` が全ガチャを走査するので、`sea` の `itemInfo` が正しい形であることもここで検証される。

この時点では終了フィルタがまだ無いため、一覧には3ガチャすべてが並ぶ。既存の `App.test.jsx` はカクテルをクリックしたままで通る。フィルタと `App.test.jsx` の海ガチャへの移行は Task 5 で行う。

- [ ] **Step 6: Commit**

```bash
git add -A src gallery
git commit -m "feat: register the sea creature gacha"
```

---

## Task 5: 終了したガチャを一覧から外す

**このタスクは Task 4 の後でなければならない。** `src/App.test.jsx` の6つのテストが「カクテル役職ガチャ」をクリックして画面を進めており、フィルタを入れるとカクテルが一覧から消えて全部落ちる。海ガチャが登録済みになって初めて、それらのテストの移行先ができる。

**Files:**
- Modify: `src/lib/deadline.js`
- Modify: `src/App.jsx`
- Modify: `src/data/gachas.js`（居酒屋の締切）
- Test: `src/lib/deadline.test.js`, `src/App.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/lib/deadline.test.js` に追加する（既存の `formatDeadline` の describe はそのまま残す）。import 行に `isActive` を足すこと。

```javascript
describe('isActive', () => {
  const endsAt = '2026-08-31T23:59:00+09:00'

  it('is active before the deadline', () => {
    expect(isActive(endsAt, new Date('2026-08-31T14:58:00Z'))).toBe(true)
  })

  it('is not active after the deadline', () => {
    expect(isActive(endsAt, new Date('2026-08-31T15:00:00Z'))).toBe(false)
  })

  it('is not active exactly at the deadline', () => {
    expect(isActive(endsAt, new Date('2026-08-31T14:59:00Z'))).toBe(false)
  })
})
```

（`2026-08-31T23:59:00+09:00` は UTC で `2026-08-31T14:59:00Z`。）

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/deadline.test.js`
Expected: FAIL（`isActive is not a function`）

- [ ] **Step 3: Implement isActive**

`src/lib/deadline.js` に追加する。

```javascript
// endsAt を過ぎたガチャは一覧に出さない。now はテストから差し替えられるようにする。
export function isActive(endsAt, now = new Date()) {
  return new Date(endsAt) > now
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/deadline.test.js`
Expected: PASS

- [ ] **Step 5: Migrate App.test.jsx to the sea gacha**

これを**フィルタ実装より先に**やる。`src/App.test.jsx` は既に `beforeEach(() => vi.useFakeTimers())` を持っているので、そこに固定時刻を足す。海ガチャの期間内かつカクテル・居酒屋の期間外である日付を選ぶ。

```javascript
beforeEach(() => {
  vi.useFakeTimers()
  // 海ガチャの公開期間中に固定する。実時間に依存すると 2026-09-01 以降にテストが壊れる。
  vi.setSystemTime(new Date('2026-08-15T12:00:00+09:00'))
})
```

続いて次の3点を機械的に置換する。

1. `const cocktailTopics = getGachaById('cocktail').words.topics` → `const seaTopics = getGachaById('sea').words.topics`（参照している1箇所も `seaTopics` に変更）
2. `screen.getByText('カクテル役職ガチャ')` の6箇所すべて → `screen.getByText('海の生き物役職ガチャ')`
3. 「使用済み topic をfetchし、抽選から除外する」テストの中身を海ガチャに合わせる
   - `fetchPeopleMock.mockResolvedValueOnce([{ topic: 'モヒート' }, { topic: 'マティーニ' }])` → `[{ topic: 'クラゲ' }, { topic: 'シャチ' }]`
   - `expect(fetchPeopleMock).toHaveBeenCalledWith('cocktail')` → `('sea')`
   - `expect(excluded).toEqual(expect.arrayContaining(['モヒート', 'マティーニ']))` → `(['クラゲ', 'シャチ'])`
4. 「保存すると…除外される」テストの `drawTitle.mockReturnValueOnce({...})` を海ガチャの値にする

```javascript
    drawTitle.mockReturnValueOnce({
      adjective: 'ゆらゆらした', topic: 'クラゲ', title: 'ゆらゆらしたクラゲ',
      info: { meaning: 'ただよう癒し', note: 'x', details: ['透明'] },
      gachaId: 'sea',
    })
```

このテスト内で後続の assertion が `'モヒート'` を参照している場合は `'クラゲ'` に合わせる。

Run: `npx vitest run src/App.test.jsx`
Expected: PASS（フィルタ実装前でも、海ガチャは一覧に出ているので通る）

- [ ] **Step 6: Filter the list in App.jsx**

`src/App.jsx` に `import { isActive } from './lib/deadline.js'` を足し、`GachaList` に渡す配列を絞る。

```jsx
<GachaList gachas={gachas.filter((g) => isActive(g.endsAt))} onSelect={...} />
```

`onSelect` などの他の props は既存のまま変えない。

- [ ] **Step 7: Test that ended gachas are hidden**

`src/App.test.jsx` の「App ナビゲーション」の describe に追加する。

```javascript
  it('hides gachas whose deadline has passed', () => {
    render(<App />)
    // カクテル(6/30締切)と居酒屋(7/31締切)は固定時刻 8/15 時点で終了している
    expect(screen.queryByText('カクテル役職ガチャ')).toBeNull()
    expect(screen.queryByText('居酒屋役職ガチャ')).toBeNull()
    expect(screen.getByText('海の生き物役職ガチャ')).toBeInTheDocument()
  })
```

- [ ] **Step 8: Change the izakaya deadline**

`src/data/gachas.js` の居酒屋の `endsAt` を `'2026-12-31T23:59:00+09:00'` から `'2026-07-31T23:59:00+09:00'` に変える。

- [ ] **Step 9: Run tests**

Run: `npm test && npm run lint`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add -A src
git commit -m "feat: hide gachas past their deadline"
```

---

## Task 6: 最終確認

- [ ] **Step 1: 全テストと lint**

Run: `npm test && npm run lint`
Expected: 全 PASS、lint エラー0

- [ ] **Step 2: ビルドが通ることを確認する**

Run: `npm run build`
Expected: 成功（`src/assets/sea-banner.png` の import が解決できること）

- [ ] **Step 3: ブラウザで確認する**

`.claude/launch.json` の `dev` エントリ（アプリ本体）で preview_start し、次を確認する。

- ガチャ一覧に **「海の生き物役職ガチャ」だけ**が出ている（カクテルと居酒屋は消えている）
- 締切表示が「8月31日 23:59」になっている
- 海ガチャを引くと役職名が「形容詞＋海の生き物」になり、結果画面が「🐙 海の生き物言葉：「〜」」「ひとこと：〜」「**特徴**：〜」の3行で出る
- read_console_messages にエラーが無い
- computer `screenshot` を撮って目視確認する

- [ ] **Step 4: プロンプトの最終目視**

```bash
node --input-type=module -e "import {buildPrompt} from './server/prompt.js'; const p=buildPrompt('sea','ゆらゆらしたクラゲ'); console.log(p.slice(0,300)); console.log('---'); console.log('placeholders left:', (p.match(/\{[^}]*\}/g)||[]).length)"
```

Expected: 冒頭に役職名が入っており、`placeholders left: 0`

- [ ] **Step 5: 差分の総括**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

---

## やらないこと

- バナー画像の生成（ユーザーが別途用意する。実装では仮画像のみ置く）
- 終了したガチャを `gachas` 配列から削除すること
- 終了ガチャへの直接アクセス経路を塞ぐこと
- `buildPrompt` のシグネチャ変更
- 既存2テンプレートの本文変更（移動のみ）
