import { useEffect, useRef, useState } from 'react'
import ShareableCard from './ShareableCard.jsx'
import { captureCardPng } from '../lib/cardImage.js'
import './CardShare.css'

// 保存後にカードPNGを生成してギャラリー(ビューワー)へ自動登録するだけのコンポーネント。
// シェアはビューワー側で行うため、ここに表示用プレビューやシェアボタンは持たない。
export default function CardShare({ title, info, personId, onRegister }) {
  const cardRef = useRef(null)
  // registering | done | error
  const [registerStatus, setRegisterStatus] = useState('idle')
  const registeredRef = useRef(false)

  // 保存直後にカードPNGを生成し、ギャラリーへ自動登録する（1回だけ）。
  useEffect(() => {
    if (!personId || !onRegister || registeredRef.current) return
    registeredRef.current = true
    ;(async () => {
      setRegisterStatus('registering')
      try {
        const blob = await captureCardPng(cardRef.current)
        await onRegister(personId, blob)
        setRegisterStatus('done')
      } catch {
        setRegisterStatus('error')
      }
    })()
  }, [personId, onRegister])

  return (
    <div className="card-share">
      {/* PNG化のためだけに画面外でレンダリングする（表示はしない） */}
      <div className="card-share__capture" aria-hidden="true">
        <ShareableCard ref={cardRef} title={title} info={info} />
      </div>
      {registerStatus === 'registering' && <p className="card-share__msg">ギャラリーに登録中…</p>}
      {registerStatus === 'done' && <p className="card-share__msg">ギャラリーに登録しました ✓</p>}
      {registerStatus === 'error' && <p className="card-share__error">ギャラリー登録に失敗しました</p>}
    </div>
  )
}
