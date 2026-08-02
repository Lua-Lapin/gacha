import './Button.css'

// variant: 'primary' | 'secondary'
// as: 描画する要素名。'a' を渡すとリンクとして同じ見た目で描画する。
//   ・as="a" のとき disabled は効果がない（<a disabled> は無効なマークアップで、
//     クリック・フォーカスを防げず、.gacha-btn:disabled も一致しない）。
//   ・as="a" を使う場合は href を必ず指定すること。href がない <a> はリンクの
//     role を持たず、キーボードフォーカスも当たらない。
export default function Button({ as: Tag = 'button', variant = 'primary', className = '', ...props }) {
  return (
    <Tag
      className={`gacha-btn gacha-btn--${variant} ${className}`}
      {...props}
      type={Tag === 'button' ? props.type ?? 'button' : undefined}
    />
  )
}
