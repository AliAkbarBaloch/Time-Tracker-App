import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TimerProvider } from './TimerContext'
import { useTimer } from './useTimer'

vi.mock('../api/taskApi', () => ({
  getActiveTask: vi.fn(() => Promise.resolve({ status: 204 })),
  startTask: vi.fn(),
  stopTask: vi.fn(),
}))

function TimerConsumer() {
  const { activeTask, elapsed } = useTimer()
  return (
    <div>
      <span data-testid="task">{activeTask ? activeTask.description : 'none'}</span>
      <span data-testid="elapsed">{elapsed}</span>
    </div>
  )
}

describe('TimerContext SSE', () => {
  let capturedEs = null
  let OriginalEventSource

  beforeEach(() => {
    OriginalEventSource = global.EventSource
    capturedEs = null
    global.EventSource = class extends OriginalEventSource {
      constructor(...args) {
        super(...args)
        capturedEs = this
      }
    }
    localStorage.setItem('tt_token', 'test-token')
  })

  afterEach(() => {
    global.EventSource = OriginalEventSource
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('creates an EventSource connection when a token is present', () => {
    render(<TimerProvider><TimerConsumer /></TimerProvider>)
    expect(capturedEs).not.toBeNull()
  })

  it('handles timer-started event and updates active task', async () => {
    render(<TimerProvider><TimerConsumer /></TimerProvider>)
    const task = { id: 1, description: 'Working', startTime: new Date().toISOString(), totalPreviousSeconds: 0 }
    await act(async () => {
      capturedEs._listeners['timer-started']({ data: JSON.stringify(task) })
    })
    expect(screen.getByTestId('task')).toHaveTextContent('Working')
  })

  it('handles timer-stopped event and clears active task', async () => {
    render(<TimerProvider><TimerConsumer /></TimerProvider>)
    const task = { id: 1, description: 'Working', startTime: new Date().toISOString(), totalPreviousSeconds: 0 }
    await act(async () => {
      capturedEs._listeners['timer-started']({ data: JSON.stringify(task) })
    })
    await act(async () => {
      capturedEs._listeners['timer-stopped']()
    })
    expect(screen.getByTestId('task')).toHaveTextContent('none')
  })

  it('ignores malformed timer-started data without crashing', async () => {
    render(<TimerProvider><TimerConsumer /></TimerProvider>)
    await act(async () => {
      capturedEs._listeners['timer-started']({ data: 'not-json' })
    })
    expect(screen.getByTestId('task')).toHaveTextContent('none')
  })

  it('closes the EventSource on SSE error without throwing', async () => {
    render(<TimerProvider><TimerConsumer /></TimerProvider>)
    const closeSpy = vi.spyOn(capturedEs, 'close')
    await act(async () => {
      capturedEs.onerror?.()
    })
    expect(closeSpy).toHaveBeenCalled()
  })
})
