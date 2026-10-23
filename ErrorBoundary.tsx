import { Component } from 'react'
import type { ReactNode } from 'react'
import { reportError } from './errorReporter'

type State = { failed: boolean }

// Catches a crash while a screen is drawing, reports it, and shows a recovery screen instead of a blank page.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportError('react', error, info.componentStack || undefined)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Something went wrong</p>
        <p style={{ fontSize: '13.5px', opacity: 0.7, marginBottom: '18px', maxWidth: 320, lineHeight: 1.5 }}>
          We have been told about the problem. Please reload the page to continue.
        </p>
        <button
          onClick={() => location.reload()}
          style={{ padding: '12px 22px', borderRadius: '12px', border: 'none', background: '#16A34A', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
        >
          Reload
        </button>
      </div>
    )
  }
}
