import { useState } from 'react';
import { useConnectionStore } from './store/connection.ts';
import { connectMidi } from './midi/bridge.ts';
import { useLocalMachine, localMachineActions } from './model/localMachine.ts';
import { useClockDriver } from './model/useClock.ts';
import {
  useSessionSync,
  type SessionConnectConfig,
} from './net/useSessionSync.ts';
import { usePeerMachines } from './net/sync.ts';
import { BrowserCheck } from './components/BrowserCheck.tsx';
import { PermissionPrompt } from './components/PermissionPrompt.tsx';
import { ConnectionStatus } from './components/ConnectionStatus.tsx';
import { MultiTabGuard } from './components/MultiTabGuard.tsx';
import { SessionBar } from './components/SessionBar.tsx';
import { TransportBar } from './components/TransportBar.tsx';
import { AudioPanel } from './components/AudioPanel.tsx';
import { CueDeck } from './components/CueDeck.tsx';
import { MachinePanel } from './components/MachinePanel.tsx';
import { PresetLibrary } from './components/PresetLibrary.tsx';
import { DeviceSetup } from './components/DeviceSetup.tsx';
import { SysexLab } from './components/SysexLab.tsx';

export function App() {
  const state = useConnectionStore((s) => s.state);
  const [sessionConfig, setSessionConfig] =
    useState<SessionConnectConfig | null>(null);

  const listenOnly = sessionConfig?.listenOnly ?? false;
  const localMachine = useLocalMachine();
  useClockDriver();
  useSessionSync(sessionConfig, localMachine);
  const peerMachines = usePeerMachines();

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
          JAMBOREE
        </h1>
        <p className="text-xs text-text-muted">
          Jam collaboratif à distance · machines hardware
        </p>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
        {!listenOnly && <ConnectionStatus />}
        <SessionBar
          connected={sessionConfig !== null}
          onConnect={setSessionConfig}
          onDisconnect={() => setSessionConfig(null)}
        />
        <TransportBar />
        <AudioPanel />
        <CueDeck />
        {!listenOnly && (
          <MachinePanel machine={localMachine} actions={localMachineActions} />
        )}
        {peerMachines.map((machine) => (
          <MachinePanel key={machine.id} machine={machine} />
        ))}
        {!listenOnly && (
          <>
            <PresetLibrary />
            <DeviceSetup />
            <SysexLab />
          </>
        )}
      </main>
    </div>
  );
}
