/** Editor-handler hook: tear the live header down. */
export type TOnDestroyCallback = (revert?: boolean) => Promise<void>
