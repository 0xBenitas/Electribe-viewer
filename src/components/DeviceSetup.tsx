import { useMemo, useState } from 'react';
import {
  DEFAULT_ANSWERS,
  answersComplete,
  buildProfileDraft,
  profileFilename,
  profileJson,
  type SetupAnswers,
} from '../model/deviceSetup.ts';
import { connectedPortNames } from '../midi/bridge.ts';
import { isKnownPortName } from '../core/profiles/registry.ts';

function update<K extends keyof SetupAnswers>(
  setAnswers: React.Dispatch<React.SetStateAction<SetupAnswers>>,
  key: K,
  value: SetupAnswers[K],
) {
  setAnswers((a) => ({ ...a, [key]: value }));
}

const inputCls =
  'rounded-md border border-line bg-bg-3 px-3 py-2 text-sm text-text outline-none focus:border-blue';

export function DeviceSetup() {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<SetupAnswers>(DEFAULT_ANSWERS);

  // MIDI ports that don't match any known profile → candidates to describe.
  const unknownPorts = useMemo(
    () => (open ? connectedPortNames().filter((n) => !isKnownPortName(n)) : []),
    [open],
  );

  const profile = buildProfileDraft(answers);
  const json = profileJson(profile);
  const complete = answersComplete(answers);

  const copy = () => void navigator.clipboard?.writeText(json);
  const download = () => {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = profileFilename(profile);
    a.click();
    URL.revokeObjectURL(url);
  };

  const set = <K extends keyof SetupAnswers>(key: K, value: SetupAnswers[K]) =>
    update(setAnswers, key, value);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-bg-2 p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-text-dim"
      >
        <span>Ajouter une machine · setup guidé</span>
        <span>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            {unknownPorts.length > 0 && (
              <div className="text-xs text-text-dim">
                Détectées non reconnues :
                <div className="mt-1 flex flex-wrap gap-1">
                  {unknownPorts.map((name) => (
                    <button
                      key={name}
                      onClick={() => set('portNameMatch', name)}
                      className="rounded border border-line bg-bg-3 px-2 py-0.5 text-[11px] text-text hover:border-blue"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Field label="Constructeur">
              <input
                className={inputCls}
                value={answers.manufacturer}
                onChange={(e) => set('manufacturer', e.target.value)}
                placeholder="Elektron"
              />
            </Field>
            <Field label="Modèle">
              <input
                className={inputCls}
                value={answers.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder="Digitakt"
              />
            </Field>
            <Field label="Nom de port (Web MIDI)">
              <input
                className={inputCls}
                value={answers.portNameMatch}
                onChange={(e) => set('portNameMatch', e.target.value)}
                placeholder="digitakt"
              />
            </Field>

            <Field label="Canaux">
              <select
                className={inputCls}
                value={answers.channelModel}
                onChange={(e) =>
                  set('channelModel', e.target.value as SetupAnswers['channelModel'])
                }
              >
                <option value="global">Canal global</option>
                <option value="per-part">Un canal par piste</option>
                <option value="multi">Multitimbral</option>
              </select>
            </Field>

            <div className="flex gap-2">
              <Field label="Pistes">
                <input
                  type="number"
                  min={1}
                  className={`${inputCls} w-20`}
                  value={answers.trackCount}
                  onChange={(e) =>
                    set('trackCount', Math.max(1, Number(e.target.value) || 1))
                  }
                />
              </Field>
              <Field label="Libellé">
                <input
                  className={inputCls}
                  value={answers.trackLabel}
                  onChange={(e) => set('trackLabel', e.target.value)}
                  placeholder="tracks"
                />
              </Field>
            </div>

            <div className="flex flex-col gap-1.5 text-sm text-text">
              <Check label="SysEx" checked={answers.sysex} onChange={(v) => set('sysex', v)} />
              <Check label="Peut être horloge maître" checked={answers.clockMaster} onChange={(v) => set('clockMaster', v)} />
              <Check label="Se cale sur horloge externe" checked={answers.clockSlave} onChange={(v) => set('clockSlave', v)} />
              <Check label="Transport (start/stop)" checked={answers.transport} onChange={(v) => set('transport', v)} />
              <Check label="Song Position (SPP)" checked={answers.songPosition} onChange={(v) => set('songPosition', v)} />
              <Check label="Sortie stéréo" checked={answers.stereoOut} onChange={(v) => set('stereoOut', v)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs text-text-dim">
              {profileFilename(profile)}
            </span>
            <pre className="max-h-80 overflow-auto rounded-md border border-line bg-bg-3 p-3 text-[11px] leading-snug text-text">
              {json}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={copy}
                disabled={!complete}
                className="rounded-md border border-line bg-bg-3 px-3 py-1.5 text-xs text-text-dim hover:text-text disabled:opacity-40"
              >
                Copier le JSON
              </button>
              <button
                onClick={download}
                disabled={!complete}
                className="rounded-md border border-blue bg-blue/15 px-3 py-1.5 text-xs text-blue disabled:opacity-40"
              >
                Télécharger
              </button>
            </div>
            <p className="text-[11px] text-text-muted">
              Place le fichier dans <code>device-profiles/</code> et propose une PR.
              Profil <strong>draft</strong> : les CC et la télémétrie s'affinent à
              l'usage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-text-dim">{label}</span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-blue"
      />
      {label}
    </label>
  );
}
