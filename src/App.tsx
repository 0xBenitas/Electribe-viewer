import { useConnectionStore } from './store/connection.ts';
import { BrowserCheck } from './components/BrowserCheck.tsx';
import { PermissionPrompt } from './components/PermissionPrompt.tsx';
import { ConnectionStatus } from './components/ConnectionStatus.tsx';
import { MultiTabGuard } from './components/MultiTabGuard.tsx';

export function App() {
  const state = useConnectionStore((s) => s.state);
  const connect = useConnectionStore((s) => s.connect);

  if (state.status === 'browser-unsupported') {
    return <BrowserCheck />;
  }
  if (state.status === 'permission-denied') {
    return <PermissionPrompt onRetry={() => void connect()} />;
  }

  return (
    <div className="min-h-full">
      <MultiTabGuard />
      <header className="border-b border-line px-6 py-4">
        <h1 className="text-xl font-bold tracking-wide text-blue">
          EMX<span className="text-orange">.</span>PILOT
        </h1>
        <p className="text-xs text-text-muted">
          Companion pour Korg Electribe 2
        </p>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <ConnectionStatus />
      </main>
    </div>
  );
}
