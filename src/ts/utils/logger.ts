/** Scoped console wrapper — the header only ever emits errors/warnings. */
export const logger = {
  error(message: string, ...args: unknown[]): void {
    console.error(`:Header [ERROR] ${message}`, ...args)
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(`:Header [WARN] ${message}`, ...args)
  }
}
