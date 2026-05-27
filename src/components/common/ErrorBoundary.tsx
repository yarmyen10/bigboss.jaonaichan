import { Component, ReactNode } from 'react';

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-gray-500">เกิดข้อผิดพลาด กรุณารีเฟรชหน้าใหม่</p>
        </div>
      );
    }
    return this.props.children;
  }
}
