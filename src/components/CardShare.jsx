import { useEffect, useRef, useState } from 'react'
import Button from './ui/Button.jsx'
import ShareableCard from './ShareableCard.jsx'
import { captureCardPng } from '../lib/cardImage.js'
import { shareImage } from '../lib/share.js'
import './CardShare.css'

export default function CardShare({ title, info, personId, onRegister }) {
  const cardRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | capturing | error
  const [error, setError] = useState('')
  // registering | done | error。ギャラリー(ビューワー)への自動登録の状態。
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

  async function handleShare() {
    if (!cardRef.current) return
    setStatus('capturing')
    setError('')
    try {
      const blob = await captureCardPng(cardRef.current)
      await shareImage(blob, { filename: `${title}.png`, title })
      setStatus('idle')
    } catch (e) {
      setError(String(e.message || e))
      setStatus('error')
    }
  }

  return (
    <div className="card-share">
      <div className="card-share__preview">
        <ShareableCard ref={cardRef} title={title} info={info} />
      </div>
      <Button onClick={handleShare} disabled={status === 'capturing'}>
        {status === 'capturing' ? '作成中…' : 'シェア'}
      </Button>
      {status === 'error' && <p className="card-share__error">{error}</p>}
      {registerStatus === 'registering' && <p className="card-share__msg">ギャラリーに登録中…</p>}
      {registerStatus === 'done' && <p className="card-share__msg">ギャラリーに登録しました ✓</p>}
      {registerStatus === 'error' && <p className="card-share__error">ギャラリー登録に失敗しました</p>}
    </div>
  )
}
