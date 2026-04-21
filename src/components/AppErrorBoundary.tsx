import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "Ocurrió un error inesperado.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App runtime error", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-lg rounded-3xl border bg-card p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sistema comercial</p>
          <h1 className="mt-3 text-2xl font-semibold text-foreground">La pantalla encontró un error</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Evitamos que la aplicación quede en blanco para que puedas recuperarte rápido.
          </p>
          {this.state.errorMessage ? (
            <div className="mt-4 rounded-2xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              {this.state.errorMessage}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={this.handleReset}>Intentar de nuevo</Button>
            <Button variant="outline" onClick={this.handleReload}>Recargar</Button>
          </div>
        </div>
      </div>
    );
  }
}
