import './Card.css'

export default function Card({ className = '', ...props }) {
  return <div className={`gacha-card ${className}`} {...props} />
}
