// @vitest-environment happy-dom
import { isIgnored } from '@ts/utils'
import { afterEach, describe, expect, it } from 'vitest'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('isIgnored', () => {
  it('is true for the stamped element itself and anything inside its subtree', () => {
    const stamped = document.createElement('div')
    stamped.setAttribute('data-arts-header-ignore', '')
    const inner = document.createElement('span')
    const deep = document.createElement('b')
    inner.appendChild(deep)
    stamped.appendChild(inner)
    document.body.appendChild(stamped)
    expect(isIgnored(stamped)).toBe(true)
    expect(isIgnored(inner)).toBe(true)
    expect(isIgnored(deep)).toBe(true)
  })

  it('is false outside the stamped subtree, siblings and ancestors included', () => {
    const outer = document.createElement('main')
    const stamped = document.createElement('div')
    stamped.setAttribute('data-arts-header-ignore', '')
    const sibling = document.createElement('div')
    outer.append(stamped, sibling)
    document.body.appendChild(outer)
    expect(isIgnored(sibling)).toBe(false)
    expect(isIgnored(outer)).toBe(false)
  })

  it('keys on presence only, so any attribute value stamps the subtree', () => {
    const stamped = document.createElement('div')
    stamped.setAttribute('data-arts-header-ignore', 'false')
    const child = document.createElement('i')
    stamped.appendChild(child)
    document.body.appendChild(stamped)
    expect(isIgnored(child)).toBe(true)
  })
})
