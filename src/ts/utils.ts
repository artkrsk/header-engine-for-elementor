/**
 * Vendored, minimal subset of `@arts/utilities` — inlined so the standalone plugin ships with
 * zero runtime dependencies. Only the surface actually used by the header engine is reproduced,
 * with signatures matching the originals so consuming code stays unchanged.
 */

/** Lenient JSON parse: falls back to a relaxed→canonical rewrite before giving up on `{}`. */
export const JSONParse = (strObj: string): Record<string, unknown> => {
  if (!strObj || typeof strObj !== 'string') {
    return {}
  }
  try {
    return JSON.parse(strObj)
  } catch {
    try {
      return JSON.parse(convertToStandardJSON(strObj))
    } catch {
      return {}
    }
  }
}

function convertToStandardJSON(strObj: string): string {
  if (!strObj) {
    return '{}'
  }
  return strObj
    .replace(/'/g, '"')
    .replace(/(?<=\{|,)(\s*)([a-zA-Z0-9_$]+)(\s*):/g, '$1"$2"$3:')
    .replace(/}"/g, '},"')
    .replace(/]"/g, '],"')
    .replace(/}'/g, '},')
    .replace(/]'/g, '],')
}

/** Recursive object merge (objects deep, arrays concatenated, scalars overwritten). */
export const deepmerge = <T extends object, U extends object>(target: T, source: U): T & U => {
  const output = { ...target } as T & U
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return output
  }
  for (const key of Object.keys(source)) {
    const targetValue = target[key as keyof T]
    const sourceValue = source[key as keyof U]
    if (
      targetValue &&
      sourceValue &&
      typeof targetValue === 'object' &&
      typeof sourceValue === 'object' &&
      !Array.isArray(targetValue) &&
      !Array.isArray(sourceValue)
    ) {
      output[key as keyof (T & U)] = deepmerge(targetValue as any, sourceValue as any) as any
    } else if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      output[key as keyof (T & U)] = [...targetValue, ...sourceValue] as any
    } else if (sourceValue !== undefined) {
      output[key as keyof (T & U)] = sourceValue as any
    }
  }
  return output
}

/** Trailing-edge debounce backed by `window.setTimeout`. */
export const debounce = <T extends (...args: any[]) => any>(fn: T, wait: number): T => {
  let timeout: number | undefined
  return function (this: any, ...args: any[]) {
    clearTimeout(timeout)
    timeout = window.setTimeout(() => fn.apply(this, args), wait)
  } as unknown as T
}

/** Scoped console wrapper — the header only ever emits errors/warnings. */
export const logger = {
  error(message: string, ...args: unknown[]): void {
    console.error(`:Header [ERROR] ${message}`, ...args)
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(`:Header [WARN] ${message}`, ...args)
  }
}

/**
 * Realm-safe replacement for `instanceof HTMLElement`. Elementor's editor preview renders in an
 * iframe, so its DOM nodes belong to a different window and `instanceof` against this realm's
 * `HTMLElement` returns false once the preview re-renders. Element nodes report `nodeType === 1`
 * in every realm.
 */
export const isHTMLElement = (subject: unknown): subject is HTMLElement =>
  !!subject && typeof subject === 'object' && (subject as { nodeType?: number }).nodeType === 1

interface IResizeArgs {
  elements: HTMLElement[]
  callbackResize?: (targets: Element[], entries: ResizeObserverEntry[]) => void
}

/** Thin ResizeObserver wrapper; observes on construction, tears down on `destroy()`. */
export class Resize {
  private instance: ResizeObserver | null = null
  private elements: HTMLElement[]
  private callback?: IResizeArgs['callbackResize']

  constructor({ elements, callbackResize }: IResizeArgs) {
    this.elements = elements
    this.callback = callbackResize
    if (this.elements.length && this.callback) {
      this.init()
    }
  }

  public init(): void {
    if (this.instance || typeof ResizeObserver !== 'function') {
      return
    }
    this.instance = new ResizeObserver((entries) => {
      this.callback?.(
        entries.map((e) => e.target),
        entries
      )
    })
    for (const element of this.elements) {
      if (isHTMLElement(element)) {
        this.instance.observe(element)
      }
    }
  }

  public destroy(): void {
    this.instance?.disconnect()
    this.instance = null
  }
}

/**
 * Resolves the edit-mode flag once `elementorFrontend.elementsHandler` exists (immediately, or
 * after the `elementor/frontend/init` event). Resolves `false` outside a browser/editor.
 */
let elementorInitPromise: Promise<boolean> | null = null

export const elementorEditorLoaded = async (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return false
  }
  if (window.elementorFrontend?.elementsHandler) {
    return window.elementorFrontend?.isEditMode?.() ?? false
  }
  if (elementorInitPromise) {
    return elementorInitPromise
  }
  elementorInitPromise = new Promise<boolean>((resolve) => {
    window.addEventListener('elementor/frontend/init', () => {
      elementorInitPromise = null
      resolve(
        window.elementorFrontend?.elementsHandler
          ? (window.elementorFrontend?.isEditMode?.() ?? false)
          : false
      )
    })
  })
  return elementorInitPromise
}
