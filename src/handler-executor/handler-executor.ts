import type { EventMap } from '../eventbus/eventbus.types'
import type { Listener } from '../listener-store/listener-store'

/**
 * Result of executing handlers for an event
 * Contains IDs of listeners that should be removed (e.g., once listeners)
 */
export interface HandlerExecutionResult {
  /** Array of listener IDs that should be removed after execution */
  listenersToRemove: symbol[]
}

/**
 * Executes event handlers sequentially in priority order
 * Handles both sync and async handlers, tracks execution statistics
 * @template TEventMap - The event map defining available events
 */
export interface HandlerExecutor<TEventMap extends EventMap> {
  /**
   * Execute all handlers for an event
   * @param event - The event being emitted
   * @param payload - The event payload
   * @param listeners - Array of listeners to execute (should be pre-sorted by priority)
   * @returns Promise with IDs of listeners to remove
   */
  execute<K extends keyof TEventMap>(
    event: K,
    payload: TEventMap[K],
    listeners: Listener[],
  ): Promise<HandlerExecutionResult>
}

/**
 * Creates a handler executor with priority-based FIFO execution
 * Handlers are executed sequentially in priority order (higher priority first)
 * Within the same priority, handlers execute in FIFO order
 *
 * Note: Configuration options (parallel execution) may be added in the future
 * @template TEventMap - The event map defining available events
 * @returns Handler executor instance
 */
export function createHandlerExecutor<TEventMap extends EventMap>(): HandlerExecutor<TEventMap> {
  /**
   * Executes a single handler and tracks stats
   * Returns a Promise only if the handler returns a Promise, otherwise executes synchronously
   */
  function executeHandler<K extends keyof TEventMap>(
    _event: K,
    payload: TEventMap[K],
    listener: Listener,
  ):
    | Promise<{ shouldRemove: boolean; duration: number }>
    | { shouldRemove: boolean; duration: number } {
    const startTime = Date.now()

    try {
      const result = listener.handler(payload)

      // Handle Promise return type
      if (result && typeof result === 'object' && 'then' in result) {
        return result.then(
          () => {
            const duration = Date.now() - startTime
            listener.executionCount++
            listener.totalDuration += duration
            return { shouldRemove: listener.once, duration }
          },
          (_error) => {
            const duration = Date.now() - startTime
            return { shouldRemove: false, duration }
          },
        )
      }

      // Synchronous handler
      const duration = Date.now() - startTime
      listener.executionCount++
      listener.totalDuration += duration

      return { shouldRemove: listener.once, duration }
    } catch (_error) {
      const duration = Date.now() - startTime
      return { shouldRemove: false, duration }
    }
  }

  return {
    async execute<K extends keyof TEventMap>(
      event: K,
      payload: TEventMap[K],
      listeners: Listener[],
    ): Promise<HandlerExecutionResult> {
      const listenersToRemove: symbol[] = []

      // Execute handlers sequentially in priority order (FIFO within same priority)
      for (const listener of listeners) {
        const result = executeHandler(event, payload, listener)

        // Only await if the result is a Promise
        const executionResult = result instanceof Promise ? await result : result

        if (executionResult.shouldRemove) {
          listenersToRemove.push(listener.id)
        }
      }

      return { listenersToRemove }
    },
  }
}
