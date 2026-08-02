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
