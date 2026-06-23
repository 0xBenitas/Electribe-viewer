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
import type { Machine } from './model/machine.ts';
import { BrowserCheck } from './components/BrowserCheck.tsx';
import { PermissionPrompt } from './components/PermissionPrompt.tsx';
import { ConnectionStatus } from './components/ConnectionStatus.tsx';
import { MultiTabGuard } from './components/MultiTabGuard.tsx';
import { CockpitHeader } from './components/CockpitHeader.tsx';
import { SessionBar } from './components/SessionBar.tsx';
import { LobbyBrowser } from './components/LobbyBrowser.tsx';
import { TransportBar } from './components/TransportBar.tsx';
import { NowBanner } from './components/NowBanner.tsx';
import { LighthouseHero } from './components/LighthouseHero.tsx';
import { LighthouseOverlay } from './components/LighthouseOverlay.tsx';
import { CueDeck } from './components/CueDeck.tsx';
import { PartGrid } from './components/PartGrid.tsx';
import { PartDetail } from './components/PartDetail.tsx';
import { ParamPanel } from './components/ParamPanel.tsx';
import { Presence } from './components/Presence.tsx';
import { MachinePanel } from './components/MachinePanel.tsx';
import { AudioPanel } from './components/AudioPanel.tsx';
import { PresetLibrary } from './components/PresetLibrary.tsx';
import { DeviceSetup } from './components/DeviceSetup.tsx';
import { SysexLab } from './components/SysexLab.tsx';
import { oscByRaw } from './data/oscillators.ts';

/** Part in focus → the hero/fullscreen label (Bastien's choice: name + measure). */
function heroOf(machine: Machine | null) {
  if (!machine || machine.parts.length === 0) return undefined;
  const p =
    machine.parts.find((x) => x.id === machine.selectedPartId) ??
    machine.parts[0]!;
  const osc = p.oscType !== null ? oscByRaw(p.oscType) : null;
  return {
    name: p.customName ?? osc?.name ?? `Part ${String(p.id).padStart(2, '0')}`,
    kind: osc?.category ?? machine.model,
    color: p.color,
  };
}

export function App() {
  const state = useConnectionStore((s) => s.state);
  const [sessionConfig, setSessionConfig] =
    useState<SessionConnectConfig | null>(null);
  const [lighthouse, setLighthouse] = useState(false);

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

  // The cockpit centres on one machine: the local one when playing, else the
  // first peer when listening only. Any other machine renders read-only below.
  const focus = !listenOnly ? localMachine : (peerMachines[0] ?? null);
  const others = !listenOnly ? peerMachines : peerMachines.slice(1);
  const hero = heroOf(focus);
  const selectedPart =
    focus?.parts.find((p) => p.id === focus.selectedPartId) ?? focus?.parts[0];
  const focusActions = focus?.editable ? localMachineActions : undefined;

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <MultiTabGuard />

      {/* psyché fog — the trippy energy lives in the chrome (DESIGN.md) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[-12%] top-[-12%] z-0 h-[620px]"
      >
        <div
          className="animate-fog absolute left-[4%] top-[-120px] size-[440px] rounded-full opacity-25 blur-[64px]"
          style={{ background: 'radial-gradient(circle,#ff6b35,transparent 64%)' }}
        />
        <div
          className="animate-fog absolute right-[8%] top-[-70px] size-[480px] rounded-full opacity-20 blur-[74px] [animation-direction:reverse]"
          style={{ background: 'radial-gradient(circle,#da77f2,transparent 64%)' }}
        />
        <div
          className="animate-fog absolute left-[44%] top-[60px] size-[380px] rounded-full opacity-[.16] blur-[70px]"
          style={{ background: 'radial-gradient(circle,#63e6be,transparent 64%)' }}
        />
      </div>

      {lighthouse && (
        <LighthouseOverlay
          onClose={() => setLighthouse(false)}
          name={hero?.name}
          kind={hero?.kind}
          color={hero?.color}
        />
      )}

      <div className="relative z-[1] mx-auto flex max-w-6xl flex-col gap-[18px] px-6 pb-[72px] pt-6">
        <CockpitHeader room={sessionConfig?.room ?? null} />

        {!listenOnly && <ConnectionStatus />}
        {sessionConfig === null ? (
          <LobbyBrowser onConnect={setSessionConfig} />
        ) : (
          <SessionBar
            room={sessionConfig.room}
            server={sessionConfig.url}
            onDisconnect={() => setSessionConfig(null)}
          />
        )}

        <TransportBar onFullscreen={() => setLighthouse(true)} />
        <NowBanner />

        <div className="grid items-start gap-[18px] lg:grid-cols-[1.35fr_1fr]">
          <LighthouseHero
            machine={focus}
            onFullscreen={() => setLighthouse(true)}
          />
          <CueDeck />
        </div>

        {focus && focus.richEditor ? (
          <>
            <PartGrid
              parts={focus.parts}
              selectedPartId={focus.selectedPartId}
              activePartId={focus.activePartId}
              onSelect={focusActions?.selectPart}
            />
            <div className="grid items-start gap-[18px] lg:grid-cols-[1.35fr_1fr]">
              <div className="flex flex-col gap-[18px]">
                {selectedPart && (
                  <PartDetail
                    part={selectedPart}
                    hydrated={focus.pattern !== null}
                    editable={focus.editable}
                    onRename={focusActions?.rename}
                  />
                )}
                <ParamPanel
                  parts={focus.parts}
                  activePartId={focus.activePartId}
                  selectedPartId={focus.selectedPartId}
                  editable={focus.editable}
                  onSetParam={focusActions?.setParam}
                />
              </div>
              <Presence />
            </div>
          </>
        ) : (
          <div className="grid items-start gap-[18px] lg:grid-cols-[1.35fr_1fr]">
            <NoMachine machine={focus} />
            <Presence />
          </div>
        )}

        {/* Other machines in the session, read-only */}
        {others.map((m) => (
          <MachinePanel key={m.id} machine={m} />
        ))}

        {/* Atelier — secondary tools (capability-driven, tucked away) */}
        {!listenOnly && (
          <details className="card-acid bg-bg-2 p-4">
            <summary className="cursor-pointer select-none font-display text-base font-bold text-text">
              Atelier · outils
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <AudioPanel />
              <PresetLibrary />
              <DeviceSetup />
              <SysexLab />
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function NoMachine({ machine }: { machine: Machine | null }) {
  return (
    <section className="card-acid flex flex-col gap-2 bg-bg-2 p-5 text-sm">
      <span className="font-display text-base font-bold text-text">Machines</span>
      <p className="text-text-dim">
        {machine
          ? 'Édition détaillée non disponible pour ce profil — la machine suit le tempo, la présence, les repères et l’audio.'
          : 'Connecte ta machine (USB) ou rejoins une session pour voir les machines.'}
      </p>
    </section>
  );
}
