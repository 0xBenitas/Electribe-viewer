import { useEffect, useMemo, useState } from 'react';
import { usePartsStore } from '../store/parts.ts';
import { useCurrentPatternStore } from '../store/currentPattern.ts';
import { usePresetsStore } from '../store/presets.ts';
import { sendParam } from '../midi/bridge.ts';
import {
  ccRecallPlan,
  partToSound,
  autoCategory,
  SYSEX_ONLY_PARAMS,
} from '../midi/presets.ts';
import { oscByRaw } from '../data/oscillators.ts';
import { PRESET_CATEGORIES, type PresetCategory, type Preset } from '../db/types.ts';

export function PresetLibrary() {
  const selectedPartId = usePartsStore((s) => s.selectedPartId);
  const activePartId = usePartsStore((s) => s.activePartId);
  const partMeta = usePartsStore((s) =>
    s.parts.find((p) => p.id === s.selectedPartId),
  );
  const part = useCurrentPatternStore(
    (s) => s.pattern?.parts[selectedPartId - 1] ?? null,
  );

  const presets = usePresetsStore((s) => s.presets);
  const save = usePresetsStore((s) => s.save);
  const remove = usePresetsStore((s) => s.remove);

  const suggestedName =
    partMeta?.customName ??
    (part ? (oscByRaw(part.oscType)?.name ?? `Part ${selectedPartId}`) : '');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PresetCategory>('Other');
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<'all' | PresetCategory>('all');
  const [status, setStatus] = useState<string | null>(null);

  // Resync les valeurs par défaut du formulaire quand on change de part.
  useEffect(() => {
    setName('');
    setCategory(part ? autoCategory(part.oscType) : 'Other');
  }, [selectedPartId, part]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return presets.filter(
      (p) =>
        (catFilter === 'all' || p.category === catFilter) &&
        (q === '' ||
          p.name.toLowerCase().includes(q) ||
          (p.oscName ?? '').toLowerCase().includes(q)),
    );
  }, [presets, query, catFilter]);

  const onSave = () => {
    if (!part) return;
    const now = Date.now();
    const preset: Preset = {
      id: crypto.randomUUID(),
      name: (name.trim() || suggestedName || `Part ${selectedPartId}`).slice(0, 32),
      category,
      tags: [],
      params: partToSound(part),
      oscName: oscByRaw(part.oscType)?.name,
      createdAt: now,
      updatedAt: now,
    };
    void save(preset);
    setName('');
    setStatus(`Preset « ${preset.name} » sauvé.`);
  };

  const onRecall = (preset: Preset) => {
    if (activePartId === null) {
      setStatus('Part actif inconnu — tourne un knob sur la machine (ADR-001).');
      return;
    }
    const plan = ccRecallPlan(preset.params);
    for (const step of plan) sendParam(step.param, step.value);
    setStatus(
      `« ${preset.name} » : ${plan.length} params live appliqués au part ${activePartId}. ` +
        `${SYSEX_ONLY_PARAMS.length} params (oscillateur, filtre, IFX…) nécessitent un Pattern Write — à venir (Phase 5b).`,
    );
  };

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-line bg-bg-2 p-4">
      <h2 className="text-sm font-bold text-text">Bibliothèque de presets</h2>

      {/* Save current part */}
      <div className="flex flex-col gap-2 rounded-md border border-line bg-bg-3 p-3">
        <span className="text-xs text-text-dim">
          Sauver le son du part {String(selectedPartId).padStart(2, '0')}
        </span>
        {part ? (
          <>
            <div className="flex gap-2">
              <input
                value={name}
                placeholder={suggestedName}
                maxLength={32}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-blue"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PresetCategory)}
                className="rounded-md border border-line bg-bg px-2 py-2 text-sm text-text outline-none focus:border-blue"
              >
                {PRESET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onSave}
              className="rounded-md border border-line-bright bg-bg px-4 py-2 text-sm text-text hover:border-blue"
            >
              Sauver le preset
            </button>
          </>
        ) : (
          <p className="text-xs text-text-muted">
            Connecte la machine pour capturer l'état du part.
          </p>
        )}
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <input
          value={query}
          placeholder="Rechercher…"
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-line bg-bg-3 px-3 py-2 text-sm text-text outline-none focus:border-blue"
        />
        <select
          value={catFilter}
          onChange={(e) =>
            setCatFilter(e.target.value as 'all' | PresetCategory)
          }
          className="rounded-md border border-line bg-bg-3 px-2 py-2 text-sm text-text outline-none focus:border-blue"
        >
          <option value="all">Toutes</option>
          {PRESET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {status && <p className="text-xs text-yellow">{status}</p>}

      {/* List */}
      <ul className="flex flex-col gap-1">
        {filtered.length === 0 && (
          <li className="text-xs text-text-muted">
            {presets.length === 0
              ? 'Aucun preset — sauve le son d’un part ci-dessus.'
              : 'Aucun preset ne correspond au filtre.'}
          </li>
        )}
        {filtered.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-md border border-line bg-bg-3 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-text">{p.name}</div>
              <div className="truncate text-[10px] uppercase tracking-wide text-text-muted">
                {p.category}
                {p.oscName ? ` · ${p.oscName}` : ''}
              </div>
            </div>
            <button
              onClick={() => onRecall(p)}
              title="Appliquer les params live au part actif"
              className="rounded border border-line-bright px-2 py-1 text-xs text-text hover:border-blue"
            >
              Recall
            </button>
            <button
              onClick={() => void remove(p.id)}
              title="Supprimer"
              className="rounded border border-line px-2 py-1 text-xs text-text-dim hover:border-red hover:text-red"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
