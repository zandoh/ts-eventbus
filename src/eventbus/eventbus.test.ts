import { describe, expect, it } from 'vitest'
import { createEventBus } from './eventbus'

interface TestEvents extends Record<string, unknown> {
  'test:event': { message: string }
  'test:number': { value: number }
  'user:login': { id: string }
  'user:logout': { id: string }
}

describe('EventBus', () => {
  describe('basic subscription', () => {
    it('should subscribe and emit events', async () => {
      const bus = createEventBus<TestEvents>()
      let received: TestEvents['test:event'] | null = null

      const handler = (payload: TestEvents['test:event']) => {
        received = payload
      }
      bus.on('test:event', handler)

      await bus.emit('test:event', { message: 'hello' })

      expect(received).toEqual({ message: 'hello' })
    })

    it('should handle multiple handlers for same event', async () => {
      const bus = createEventBus<TestEvents>()
      const received: string[] = []

      const handler1 = () => {
        received.push('handler1')
      }
      const handler2 = () => {
        received.push('handler2')
      }

      bus.on('test:event', handler1)
      bus.on('test:event', handler2)

      await bus.emit('test:event', { message: 'test' })

      expect(received).toEqual(['handler1', 'handler2'])
    })

    it('should unsubscribe correctly', async () => {
      const bus = createEventBus<TestEvents>()
      let count = 0

      const handler = () => {
        count++
      }
      const unsubscribe = bus.on('test:event', handler)

      await bus.emit('test:event', { message: 'test' })
      expect(count).toBe(1)

      unsubscribe()

      await bus.emit('test:event', { message: 'test' })
      expect(count).toBe(1) // Should still be 1
    })
  })

  describe('wildcard patterns', () => {
    it('should match wildcard patterns', async () => {
      const bus = createEventBus<TestEvents>()
      const received: string[] = []

      const wildcardHandler = () => {
        received.push('wildcard')
      }
      bus.onPattern('user:*', wildcardHandler)

      await bus.emit('user:login', { id: '123' })
      await bus.emit('user:logout', { id: '123' })

      expect(received).toEqual(['wildcard', 'wildcard'])
    })

    it('should match global wildcard', async () => {
      const bus = createEventBus<TestEvents>()
      let count = 0

      const globalHandler = () => {
        count++
      }
      bus.onPattern('*', globalHandler)

      await bus.emit('test:event', { message: 'test' })
      await bus.emit('user:login', { id: '123' })
      await bus.emit('user:logout', { id: '123' })

      expect(count).toBe(3)
    })
  })

  describe('priority', () => {
    it('should execute handlers in priority order', async () => {
      const bus = createEventBus<TestEvents>()
      const order: number[] = []

      const handler1 = () => {
        order.push(1)
      }
      const handler10 = () => {
        order.push(10)
      }
      const handler5 = () => {
        order.push(5)
      }

      bus.on('test:event', handler1, { priority: 1 })
      bus.on('test:event', handler10, { priority: 10 })
      bus.on('test:event', handler5, { priority: 5 })

      await bus.emit('test:event', { message: 'test' })

      expect(order).toEqual([10, 5, 1])
    })
  })

  describe('once listener', () => {
    it('should execute once listener only once', async () => {
      const bus = createEventBus<TestEvents>()
      let count = 0

      const onceHandler = () => {
        count++
      }
      bus.once('test:event', onceHandler)

      await bus.emit('test:event', { message: 'test1' })
      await bus.emit('test:event', { message: 'test2' })

      expect(count).toBe(1)
    })
  })

  describe('offAll', () => {
    it('should remove all listeners for an event', async () => {
      const bus = createEventBus<TestEvents>()
      let count = 0

      const incrementHandler = () => {
        count++
      }

      bus.on('test:event', incrementHandler)
      bus.on('test:event', incrementHandler)

      await bus.emit('test:event', { message: 'test' })
      expect(count).toBe(2)

      bus.offAll('test:event')

      await bus.emit('test:event', { message: 'test' })
      expect(count).toBe(2) // Should still be 2
    })

    it('should remove all listeners when no event specified', async () => {
      const bus = createEventBus<TestEvents>()
      let count = 0

      const incrementHandler = () => {
        count++
      }

      bus.on('test:event', incrementHandler)
      bus.on('user:login', incrementHandler)

      bus.offAll()

      await bus.emit('test:event', { message: 'test' })
      await bus.emit('user:login', { id: '123' })

      expect(count).toBe(0)
    })
  })

  describe('getListeners', () => {
    it('should return all listeners', () => {
      const bus = createEventBus<TestEvents>()

      const noopHandler = () => {}
      bus.on('test:event', noopHandler)
      bus.on('user:login', noopHandler, { priority: 5 })

      const listeners = bus.getListeners()

      expect(listeners.size).toBe(2)
      expect(listeners.has('test:event')).toBe(true)
      expect(listeners.has('user:login')).toBe(true)

      const userListeners = listeners.get('user:login')
      expect(userListeners).toBeDefined()
      expect(userListeners?.[0]?.priority).toBe(5)
    })

    it('should return listeners for specific event', () => {
      const bus = createEventBus<TestEvents>()

      const noopHandler = () => {}
      bus.on('test:event', noopHandler)
      bus.on('user:login', noopHandler)
      bus.onPattern('user:*', noopHandler)

      const listeners = bus.getListeners('user:login')

      expect(listeners.size).toBe(2) // 'user:login' and 'user:*'
      expect(listeners.has('user:login')).toBe(true)
      expect(listeners.has('user:*')).toBe(true)
      expect(listeners.has('test:event')).toBe(false)
    })
  })

  describe('async handlers', () => {
    it('should handle async handlers', async () => {
      const bus = createEventBus<TestEvents>()
      let received: TestEvents['test:event'] | null = null

      const asyncHandler = async (payload: TestEvents['test:event']) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        received = payload
      }
      bus.on('test:event', asyncHandler)

      await bus.emit('test:event', { message: 'async test' })

      expect(received).toEqual({ message: 'async test' })
    })

    it('should handle sync handlers', async () => {
      const bus = createEventBus<TestEvents>()
      let executed = false

      const syncHandler = () => {
        executed = true
      }
      bus.on('test:event', syncHandler)

      await bus.emit('test:event', { message: 'void test' })

      expect(executed).toBe(true)
    })
  })

  describe('sequential execution', () => {
    it('should execute handlers sequentially in FIFO order', async () => {
      const bus = createEventBus<TestEvents>()
      const order: number[] = []

      const handler1 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        order.push(1)
      }
      const handler2 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        order.push(2)
      }
      const handler3 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
        order.push(3)
      }

      bus.on('test:event', handler1)
      bus.on('test:event', handler2)
      bus.on('test:event', handler3)

      await bus.emit('test:event', { message: 'test' })

      // Handlers execute sequentially in FIFO order (priority 0 by default)
      expect(order).toEqual([1, 2, 3])
    })

    it('should respect priority order', async () => {
      const bus = createEventBus<TestEvents>()
      const order: number[] = []

      const handler1 = () => {
        order.push(1)
      }
      const handler10 = () => {
        order.push(10)
      }
      const handler5 = () => {
        order.push(5)
      }

      bus.on('test:event', handler1, { priority: 1 })
      bus.on('test:event', handler10, { priority: 10 })
      bus.on('test:event', handler5, { priority: 5 })

      await bus.emit('test:event', { message: 'test' })

      expect(order).toEqual([10, 5, 1])
    })
  })
})
