// @vitest-environment happy-dom
import { dispatchHeaderEvent, offHeaderEvent, onHeaderEvent } from '@ts/events/headerEvents'
import type { IHeaderEventDetail } from '@ts/interfaces'
import { describe, expect, it, vi } from 'vitest'

describe('header events', () => {
  it('dispatches a document CustomEvent carrying the value and the header element', () => {
    const header = document.createElement('div')
    const seen: IHeaderEventDetail[] = []
    const listener = (event: CustomEvent<IHeaderEventDetail>): void => {
      seen.push(event.detail)
    }
    onHeaderEvent('arts/header/sticky', listener)
    dispatchHeaderEvent('arts/header/sticky', { value: true, header })
    offHeaderEvent('arts/header/sticky', listener)
    expect(seen).toEqual([{ value: true, header }])
  })

  it('round-trips subscribe/unsubscribe — nothing arrives after off', () => {
    const spy = vi.fn()
    onHeaderEvent('arts/header/hidden', spy)
    offHeaderEvent('arts/header/hidden', spy)
    dispatchHeaderEvent('arts/header/hidden', {
      value: true,
      header: document.createElement('div')
    })
    expect(spy).not.toHaveBeenCalled()
  })
})
