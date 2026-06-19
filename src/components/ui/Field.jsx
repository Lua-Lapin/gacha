import './Field.css'

// label付きのフォーム行。inputId で label と入力要素を紐付ける。
export default function Field({ label, htmlFor, children }) {
  return (
    <div className="gacha-field">
      <label className="gacha-field__label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  )
}
