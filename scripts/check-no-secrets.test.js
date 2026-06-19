import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'

function runCheck(files) {
  try {
    execFileSync('bash', ['scripts/check-no-secrets.sh'], {
      input: files.join('\n'),
      encoding: 'utf8',
    })
    return 0
  } catch (e) {
    return e.status
  }
}

describe('check-no-secrets.sh', () => {
  it('passes when no secret files present', () => {
    expect(runCheck(['src/App.jsx', 'gallery/main.js'])).toBe(0)
  })

  it('fails when a .env file is present', () => {
    expect(runCheck(['server/.env'])).toBe(1)
  })

  it('fails when a .db file is present', () => {
    expect(runCheck(['data/gacha.db'])).toBe(1)
  })

  it('fails when a .sqlite file is present', () => {
    expect(runCheck(['foo.sqlite'])).toBe(1)
  })
})
