import { createHandlerExecutor } from '../handler-executor/handler-executor'
import { createListenerStore } from '../listener-store/listener-store'
import type {
  ListenerHandler,
  ListenerMap,
  SubscribeOptions,
} from '../listener-store/listener-store.types'
import { createPatternMatcher } from '../pattern-matcher/pattern-matcher'
import type { EventBus, EventBusConfig, EventMap } from './eventbus.types'

export function createEventBus<TEventMap extends EventMap = EventMap>(
  _config?: EventBusConfig<TEventMap>,
): EventBus<TEventMap> {
  const patternMatcher = createPatternMatcher()
  const listenerStore = createListenerStore(patternMatcher)
  const handlerExecutor = createHandlerExecutor<TEventMap>()

  const subscribe = (
    pattern: string,
    handler: ListenerHandler<unknown>,
    options: SubscribeOptions = {},
  ): (() => void) => {
    const listenerId = listenerStore.add(pattern, handler, options)

    return (): void => {
      listenerStore.remove(pattern, listenerId)
    }
  }

  const on = <K extends keyof TEventMap>(
    event: K,
    handler: ListenerHandler<TEventMap[K]>,
    options?: SubscribeOptions,
  ): (() => void) => {
    return subscribe(String(event), handler as ListenerHandler<unknown>, options)
  }

  const onPattern = (
    pattern: string,
    handler: ListenerHandler<unknown>,
    options?: SubscribeOptions,
  ): (() => void) => {
    return subscribe(pattern, handler, options)
  }

  const once = <K extends keyof TEventMap>(
    event: K,
    handler: ListenerHandler<TEventMap[K]>,
    options?: Omit<SubscribeOptions, 'once'>,
  ): (() => void) => {
    return subscribe(String(event), handler as ListenerHandler<unknown>, { ...options, once: true })
  }

  const emit = async <K extends keyof TEventMap>(
    event: K,
    payload: TEventMap[K],
  ): Promise<void> => {
    const eventStr = String(event)

    const matchingListeners = listenerStore.getMatching(eventStr)

    const { listenersToRemove } = await handlerExecutor.execute(event, payload, matchingListeners)

    // Remove once listeners
    for (const listenerId of listenersToRemove) {
      listenerStore.removeById(listenerId)
    }
  }

  const off = (listenerId: symbol): void => {
    listenerStore.removeById(listenerId)
  }

  const offAll = <K extends keyof TEventMap>(event?: K): void => {
    listenerStore.removeAll(event ? String(event) : undefined)
  }

  const getListeners = (event?: string): ListenerMap => {
    return listenerStore.getAll(event)
  }

  const bus: EventBus<TEventMap> = {
    on,
    onPattern,
    once,
    emit,
    off,
    offAll,
    getListeners,
  }

  return bus
}
