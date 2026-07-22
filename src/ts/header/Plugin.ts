import type { IPluginArgs, IResolvedConfig, IResolvedHeaderOptions } from '../interfaces'

export abstract class Plugin {
  protected container: HTMLElement
  protected bar: HTMLElement
  protected options: IResolvedHeaderOptions
  protected config: IResolvedConfig
  protected initialized: boolean = false

  constructor(args: IPluginArgs) {
    this.container = args.container
    this.bar = args.bar
    this.options = args.options
    this.config = args.config
  }

  public init(): void {
    if (this.initialized) {
      return
    }

    this.onInit()

    this.initialized = true
  }

  public destroy(revert: boolean = false): void {
    if (!this.initialized) {
      return
    }

    this.onDestroy(revert)

    this.initialized = false
  }

  public update(force: boolean = false): void {
    if (!this.initialized && !force) {
      return
    }

    this.onUpdate()
  }

  protected onInit(): void {}

  protected onUpdate(): void {}

  protected onDestroy(_revert: boolean): void {}
}
