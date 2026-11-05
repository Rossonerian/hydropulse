import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import '../styles/ops/inspector.css';

/**
 * Catches render errors in a subtree so a crash never leaves a blank screen.
 * `resetKeys` clears the error when any key changes (for example the selection).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the failure visible in the console for debugging.
    console.error(`[${this.props.label || 'ErrorBoundary'}]`, error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (!this.state.error) return;
    const a = prev.resetKeys || [];
    const b = this.props.resetKeys || [];
    if (a.length !== b.length || a.some((v, i) => v !== b[i])) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className='error-fallback' role='alert'>
        <AlertTriangle size={20} aria-hidden='true' />
        <h3>{this.props.title || 'Something went wrong'}</h3>
        <p>{error?.message || 'This part of the screen failed to draw.'}</p>
        <div className='error-fallback__actions'>
          <button type='button' className='btn btn--primary' onClick={() => window.location.reload()}>
            Reload
          </button>
          <button type='button' className='btn' onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}
