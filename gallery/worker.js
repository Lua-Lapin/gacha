import { cardPageHtml } from './cardPage.js'

// ビルド済みのビューワー（dist）に無いパスだけがここに来る。
// R2 バケットは非公開で、読み出せるのは下の2種類のキーだけ。
const IMAGE_PATH = /^\/images\/\d+\.png$/
const CARD_PATH = /^\/card\/(\d+)(?:\.html)?$/

function notFound() {
  return new Response('Not Found', { status: 404, headers: { 'cache-control': 'no-store' } })
}

async function serveObject(request, env, key, contentType, cacheControl) {
  const object = request.method === 'HEAD'
    ? await env.BUCKET.head(key)
    : await env.BUCKET.get(key, { onlyIf: request.headers })
  if (!object) return notFound()
  const headers = {
    'content-type': contentType,
    'cache-control': cacheControl,
    etag: object.httpEtag,
    'x-content-type-options': 'nosniff',
  }
  if (request.method === 'HEAD') return new Response(null, { headers })
  // 条件付きリクエストに一致したときは body の無いオブジェクトが返る
  if (!object.body) return new Response(null, { status: 304, headers })
  return new Response(object.body, { headers })
}

async function serveCard(request, env, id, origin) {
  const object = await env.BUCKET.get('manifest.json')
  if (!object) return notFound()
  const entry = (await object.json()).find((e) => e.id === id)
  if (!entry) return notFound()
  return new Response(request.method === 'HEAD' ? null : cardPageHtml(entry, `${origin}/`), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  })
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
    }
    const { pathname, origin } = new URL(request.url)
    if (pathname === '/manifest.json') {
      return serveObject(request, env, 'manifest.json', 'application/json', 'no-store')
    }
    if (IMAGE_PATH.test(pathname)) {
      return serveObject(request, env, pathname.slice(1), 'image/png', 'public, max-age=31536000, immutable')
    }
    const card = pathname.match(CARD_PATH)
    if (card) return serveCard(request, env, Number(card[1]), origin)
    return notFound()
  },
}
