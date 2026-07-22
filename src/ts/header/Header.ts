import type {
  IConfig,
  IHeaderOptions,
  IResolvedConfig,
  IResolvedHeaderOptions
} from '../interfaces'
import { JSONParse, logger } from '../utils'
import { resolveConfig } from './config'
import { HeightObserver } from './HeightObserver'
import { resolveHeaderOptions } from './options'
import { Sticky } from './Sticky'

export class Header {
  private container: HTMLElement
  private bar: HTMLElement
  private options: IResolvedHeaderOptions
  private config: IResolvedConfig
  private sticky: Sticky | null = null
  private heightObserver: HeightObserver | null = null
  private initialized = false

  constructor(
    containerElement: HTMLElement,
    barElement: HTMLElement,
    {
      options,
      config
    }: {
      options?: IHeaderOptions
      config?: IConfig
    } = {}
  ) {
    // Missing elements are reported but not thrown: `init()` no-ops so a partial page (e.g. the
    // Elementor editor mid-edit) degrades silently instead of crashing the bundle.
    if (!containerElement) {
      logger.error('containerElement is required')
    }
    if (!barElement) {
      logger.error('barElement is required')
    }
    this.container = containerElement
    this.bar = barElement

    const inlineOptions = containerElement ? this.getOptionsFromAttribute() : undefined
    this.options = resolveHeaderOptions(inlineOptions ?? options)
    this.config = resolveConfig(config)
  }

  /** Inline `data-arts-header-options` JSON takes precedence over constructor options. */
  private getOptionsFromAttribute(): IHeaderOptions | undefined {
    const optionsAttr = this.container.getAttribute('data-arts-header-options')

    if (!optionsAttr) {
      return undefined
    }

    return JSONParse(optionsAttr) as IHeaderOptions
  }

  public get isInitialized(): boolean {
    return this.initialized
  }

  public async init(): Promise<void> {
    if (this.initialized || !this.container || !this.bar) {
      return
    }

    const pluginArgs = {
      container: this.container,
      bar: this.bar,
      options: this.options,
      config: this.config
    }

    if (this.options.sticky.enabled) {
      this.sticky = new Sticky(pluginArgs)
      this.sticky.init()
    }

    if (this.options.heightObserver.enabled) {
      this.heightObserver = new HeightObserver(pluginArgs)
      this.heightObserver.init()
    }

    if (this.sticky) {
      this.sticky.onStickyChange = (isSticking) => {
        this.heightObserver?.handleStickyChange(isSticking)
      }
    }

    this.initialized = true
  }

  /** Re-read bar height and re-arm observers on all plugins (call after layout changes). */
  public refresh(): void {
    this.sticky?.update()
    this.heightObserver?.update()
  }

  /** Hide/show the whole header (drives the same state as hide-over zones). */
  public toggleHidden(hidden: boolean): void {
    this.sticky?.setHidden(hidden)
  }

  /** Freeze/unfreeze the sticky/reveal state (drives the same state as lock-over zones). */
  public lockSticky(locked: boolean): void {
    this.sticky?.setLocked(locked)
  }

  /** Re-scan the DOM for hide-over / lock-over zones. */
  public refreshZones(): void {
    this.sticky?.refreshZones()
  }

  public get isSticking(): boolean {
    return this.sticky?.isSticking ?? false
  }

  public get isHidden(): boolean {
    return this.sticky?.isHidden ?? false
  }

  public get isLocked(): boolean {
    return this.sticky?.isLocked ?? false
  }

  public async destroy(revert: boolean = false): Promise<void> {
    if (!this.initialized) {
      return
    }

    this.sticky?.destroy(revert)
    this.heightObserver?.destroy(revert)

    this.initialized = false
  }
}
