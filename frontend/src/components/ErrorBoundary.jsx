import { Component } from 'react';

// Keeps one broken panel from blanking the whole control room.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error(`[${this.props.label || 'panel'}]`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-boundary" role="alert">
        <p>Something went wrong in the {this.props.label || 'panel'}.</p>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => this.setState({ failed: false })}>
          Try again
        </button>
      </div>
    );
  }
}
