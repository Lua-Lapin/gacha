import { useRef, useState } from 'react'
import Button from './ui/Button.jsx'
import ShareableCard from './ShareableCard.jsx'
import { captureCardPng } from '../lib/cardImage.js'
import { shareImage } from '../lib/share.js'
import './CardShare.css'

export default function CardShare({ title, info }) {
  const cardRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | capturing | error
  const [error, setError] = useState('')

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
    </div>
  )
}
