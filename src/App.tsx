import { useConnectionStore } from './store/connection.ts';
import { connectMidi } from './midi/bridge.ts';
import { useLocalMachine, localMachineActions } from './model/localMachine.ts';
import { BrowserCheck } from './components/BrowserCheck.tsx';
import { PermissionPrompt } from './components/PermissionPrompt.tsx';
import { ConnectionStatus } from './components/ConnectionStatus.tsx';
import { MultiTabGuard } from './components/MultiTabGuard.tsx';
import { MachinePanel } from './components/MachinePanel.tsx';
import { PresetLibrary } from './components/PresetLibrary.tsx';
import { SysexLab } from './components/SysexLab.tsx';

export function App() {
  const state = useConnectionStore((s) => s.state);
  const localMachine = useLocalMachine();

  if (state.status === 'browser-unsupported') {
    return <BrowserCheck />;
  }
  if (state.status === 'permission-denied') {
    return <PermissionPrompt onRetry={() => void connectMidi()} />;
  }

  return (
    <div className="min-h-full">
      <MultiTabGuard />
      <header className="border-b border-line px-6 py-4">
        <h1 className="text-xl font-bold tracking-wide text-blue">
          EMX<span className="text-orange">.</span>PILOT
        </h1>
        <p className="text-xs text-text-muted">Companion pour Korg Electribe 2</p>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        <ConnectionStatus />
        <MachinePanel machine={localMachine} actions={localMachineActions} />
        <PresetLibrary />
        <SysexLab />
      </main>
    </div>
  );
}
