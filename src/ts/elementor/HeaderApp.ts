import { defaultConfig } from '../constants'
import { Header } from '../header/Header'
import type { IHeaderAppArgs } from '../interfaces'
import type { TAppState } from '../types'
import { logger } from '../utils'
import { attachContainerHandler } from './ContainerHandler'

export class HeaderApp {
  private state: TAppState = 'idle'
  private editorHandlerAttached = false

  private callbackBefore?: IHeaderAppArgs['callbackBefore']
  private callbackAfter?: IHeaderAppArgs['callbackAfter']

  public artsHeader?: Header

  constructor(args: IHeaderAppArgs = {}) {
    const { callbackBefore, callbackAfter } = args

    this.callbackBefore = callbackBefore
    this.callbackAfter = callbackAfter
  }

  /**
   * Factory method to create and initialize an instance
   * @param args Configuration options
   */
  public static async create(args: IHeaderAppArgs = {}): Promise<HeaderApp> {
    const instance = new HeaderApp(args)
    const { autoInit = true } = args

    if (autoInit) {
      await instance.init()
    }
    return instance
  }

  /**
   * Initialize plugin with the provided options
   * @returns True if initialization was successful
   */
  public async init(): Promise<boolean> {
    if (this.isInState('initializing')) {
      return true
    }

    this.state = 'initializing'

    try {
      await this.load()
      return true
    } finally {
      this.state = 'idle'
    }
  }

  /**
   * Cleanly stops and destroys the arts header instance
   *
   * @param revert Restore the DOM the header mutated (sticky/revealing classes,
   *               toggled attributes) and dispatch the accompanying state events.
   *               Defaults to `false`: the header keeps its current visual state,
   *               which is what AJAX page transitions want while they swap the
   *               page underneath a persistent header.
   * @returns True if destruction was successful
   */
  public async destroy(revert: boolean = false): Promise<boolean> {
    if (this.isInState('destroying')) {
      return true
    }

    this.state = 'destroying'

    try {
      if (this.artsHeader) {
        await this.artsHeader.destroy(revert)
      }

      return true
    } finally {
      this.state = 'idle'
    }
  }

  /**
   * Main method to start the arts header functionality
   */
  private async load(
    elements: { container?: HTMLElement | null; bar?: HTMLElement | null } = {}
  ): Promise<any> {
    if (this.isInState('running')) {
      return
    }
    this.state = 'running'

    try {
      await this.executeBeforeCallback()

      // If artsHeader is already initialized, destroy it first
      if (this.artsHeader?.isInitialized) {
        await this.artsHeader.destroy()
      }

      const containerElement = elements.container
        ? elements.container
        : document.querySelector<HTMLElement>(defaultConfig.selectors.container)

      const barElement = elements.bar
        ? elements.bar
        : containerElement
          ? containerElement.querySelector<HTMLElement>(defaultConfig.selectors.bar)
          : null

      if (containerElement && barElement) {
        this.artsHeader = new Header(containerElement, barElement)
        await this.artsHeader.init()
      }

      await this.executeAfterCallback()
    } catch (error) {
      logger.error('Error during arts header initialization:', error)
      throw error
    } finally {
      this.state = 'idle'
    }
  }

  /** Registers the editor container handler once (editor mode only). */
  public loadElementorEditorHandler(): void {
    if (this.editorHandlerAttached) {
      return
    }

    attachContainerHandler(this.load.bind(this), this.destroy.bind(this))
    this.editorHandlerAttached = true
  }

  private async executeBeforeCallback(): Promise<void> {
    if (typeof this.callbackBefore === 'function') {
      await this.callbackBefore()
    }
  }

  private async executeAfterCallback(): Promise<void> {
    if (typeof this.callbackAfter === 'function') {
      await this.callbackAfter()
    }
  }

  private isInState(checkState: TAppState): boolean {
    return this.state === checkState
  }
}
