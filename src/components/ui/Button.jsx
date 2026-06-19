import './Button.css'

// variant: 'primary' | 'secondary'
export default function Button({ variant = 'primary', className = '', ...props }) {
  return <button className={`gacha-btn gacha-btn--${variant} ${className}`} {...props} />
}
