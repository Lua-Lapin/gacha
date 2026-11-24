import { AwsClient } from 'aws4fetch'

const REQUIRED = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']
const TIMEOUT_MS = 120_000

// R2 への読み書き。S3互換APIを使う。
export function createR2Storage(env = process.env, fetchImpl = fetch) {
  const missing = REQUIRED.filter((name) => !env[name])
  if (missing.length) {
    throw new Error(`server/.env に R2 の設定がありません: ${missing.join(', ')}`)
  }
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })
  const baseUrl = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/`

  async function send(method, key, init = {}) {
    const req = await client.sign(baseUrl + key, { method, ...init })
    return fetchImpl(req, { signal: AbortSignal.timeout(TIMEOUT_MS) })
  }
  function fail(method, key, res) {
    return new Error(`R2 ${method} ${key} failed: HTTP ${res.status}`)
  }

  return {
    async put(key, body, contentType) {
      const res = await send('PUT', key, { body, headers: { 'content-type': contentType } })
      if (!res.ok) throw fail('PUT', key, res)
    },
    async getJson(key) {
      const res = await send('GET', key)
      if (res.status === 404) return null
      if (!res.ok) throw fail('GET', key, res)
      return res.json()
    },
    async exists(key) {
      const res = await send('HEAD', key)
      if (res.status === 404) return false
      if (!res.ok) throw fail('HEAD', key, res)
      return true
    },
  }
}
