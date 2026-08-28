import { JSONParse } from '@ts/utils'
import { describe, expect, it } from 'vitest'

describe('JSONParse', () => {
  it('passes valid JSON through unchanged', () => {
    expect(JSONParse('{"sticky": {"enabled": true}, "n": 2}')).toEqual({
      sticky: { enabled: true },
      n: 2
    })
  })

  it('recovers a relaxed object literal via the canonical rewrite', () => {
    expect(JSONParse("{sticky: {enabled: true}, mode: 'flow'}")).toEqual({
      sticky: { enabled: true },
      mode: 'flow'
    })
  })

  it('returns an empty object for unrecoverable garbage instead of throwing', () => {
    expect(JSONParse('{"unterminated": ')).toEqual({})
  })

  it('returns an empty object for non-string input', () => {
    expect(JSONParse(undefined as unknown as string)).toEqual({})
  })
})
