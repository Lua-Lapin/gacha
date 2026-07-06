import { adjectives, cocktails } from '../data/words.js'
import { cocktailInfo } from '../data/cocktails.js'

export const CAPSULE_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function drawTitle(excludeCocktails = []) {
  const excluded = new Set(excludeCocktails)
  const available = cocktails.filter((c) => !excluded.has(c))
  if (available.length === 0) return null

  const adjective = pick(adjectives)
  const cocktail = pick(available)
  return { adjective, cocktail, title: adjective + cocktail, info: cocktailInfo[cocktail] }
}

export function pickCapsuleColor() {
  return pick(CAPSULE_COLORS)
}
