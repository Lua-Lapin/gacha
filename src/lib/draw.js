import { adjectives, cocktails } from '../data/words.js'
import { cocktailInfo } from '../data/cocktails.js'

export const CAPSULE_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function drawTitle() {
  const adjective = pick(adjectives)
  const cocktail = pick(cocktails)
  return { adjective, cocktail, title: adjective + cocktail, info: cocktailInfo[cocktail] }
}

export function pickCapsuleColor() {
  return pick(CAPSULE_COLORS)
}
