/** Constructor arguments for the Elementor `HeaderApp` wrapper. */
export interface IHeaderAppArgs {
  autoInit?: boolean
  /** Callback to run before the header is initialized. */
  callbackBefore?: () => Promise<void> | void
  /** Callback to run after the header is initialized. */
  callbackAfter?: () => Promise<void> | void
}
