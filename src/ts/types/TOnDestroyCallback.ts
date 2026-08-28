/** Editor-handler hook: tear down one container's instance (or all when no container given). */
export type TOnDestroyCallback = (container?: HTMLElement | null, revert?: boolean) => Promise<void>
