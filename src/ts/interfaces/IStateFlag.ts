/**
 * A memoized boolean state flag bound to one container class. `set` toggles the class (an empty
 * configured class string opts that write out) and reports whether the value actually changed —
 * side effects and events sequence off that report in the orchestrator. `reset` forgets the value
 * WITHOUT touching the DOM, for the destroy path that keeps the current visual state.
 */
export interface IStateFlag {
  readonly value: boolean
  set(next: boolean): boolean
  reset(): void
}
