import { useEffect, useState } from 'react';
import copy from '../copy/guide.json';
import { NINJAM_TARGET } from '../lib/ninjamHost.ts';
import { buildShareLink } from '../lib/sessionPrefs.ts';

// Le mode d'emploi : rôles, étapes, pièges, liens. Même contenu sur l'accueil
// (GuideSection, repliable) et en session (GuideOverlay, avec les liens de la
// session en tête). Tout le texte vit dans src/copy/guide.json.

interface Ctx {
  /** Session en cours (ajoute le bloc « Cette session » avec ses liens). */
  room?: string;
  server?: string;
}

const COLLAPSED_KEY = 'jamboree.guide.collapsed';

function origin(): string {
  return typeof location !== 'undefined' ? location.origin : '';
}

function CopyChip({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const doCopy = () => {
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <span className="mt-1 flex flex-wrap items-center gap-2">
      <code className="break-all rounded-md border border-line bg-bg-3 px-2.5 py-1 font-mono text-xs text-text">
        {value}
      </code>
      <button
        type="button"
        onClick={doCopy}
        className="rounded-md border border-line bg-bg-3 px-2.5 py-1 text-xs text-text-dim hover:text-text"
      >
        {copied ? copy.copied : copy.copy}
      </button>
    </span>
  );
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-blue underline underline-offset-2 hover:text-blue-bright"
    >
      {label} ↗
    </a>
  );
}

export function GuideContent({ room, server }: Ctx) {
  const listen = `${origin()}/ecouter.html${room ? `?room=${encodeURIComponent(room)}` : ''}`;
  const share = room ? buildShareLink(room, server ?? '') : null;
  const chip = (code: string) => (code === 'ninjam' ? NINJAM_TARGET : listen);

  return (
    <div className="flex flex-col gap-5 text-sm text-text-dim">
      <p className="text-text">{copy.tagline}</p>

      {share && (
        <section className="flex flex-col gap-2 rounded-md border-2 border-green/60 bg-bg-3 p-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-green">
            {copy.session.title} « {room} »
          </h3>
          <div className="text-xs">
            {copy.session.share}
            <CopyChip value={share} />
          </div>
          <div className="text-xs">
            {copy.session.listen}
            <CopyChip value={listen} />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim">
          {copy.rolesTitle}
        </h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {copy.roles.map((r) => (
            <div
              key={r.title}
              className="flex flex-col gap-1 rounded-md border-2 border-black bg-bg-3 p-3"
              style={{ boxShadow: '2px 2px 0 #000' }}
            >
              <span className="font-display text-base font-bold text-text">{r.title}</span>
              <span className="text-[11px] uppercase tracking-[0.1em] text-text-dim">{r.who}</span>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {r.needs.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {copy.sections.map((s, i) => (
        <section key={s.title} className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-dim">
            {i + 1}. {s.title}
          </h3>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-xs">
            {s.steps.map((step) => (
              <li key={step.text}>
                {step.text}
                {'link' in step && step.link && (
                  <>
                    {' '}
                    <ExtLink href={step.link.href} label={step.link.label} />
                  </>
                )}
                {'code' in step && step.code && <CopyChip value={chip(step.code)} />}
              </li>
            ))}
          </ol>
        </section>
      ))}

      <section className="flex flex-col gap-2 rounded-md border border-yellow/40 bg-bg-3 p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-yellow">
          {copy.pitfalls.title}
        </h3>
        <ul className="flex list-disc flex-col gap-1 pl-4 text-xs">
          {copy.pitfalls.items.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-bold uppercase tracking-wider text-text-dim">{copy.links.title}</span>
        {copy.links.items.map((l) => (
          <ExtLink key={l.href} href={l.href} label={l.label} />
        ))}
      </section>
    </div>
  );
}

/** Sur l'accueil : carte repliable, ouverte par défaut, état mémorisé. */
export function GuideSection() {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) !== '1';
    } catch {
      return true;
    }
  });
  return (
    <details
      id="mode-demploi"
      open={open}
      onToggle={(e) => {
        const o = e.currentTarget.open;
        setOpen(o);
        try {
          localStorage.setItem(COLLAPSED_KEY, o ? '0' : '1');
        } catch {
          /* stockage indisponible : on n'insiste pas */
        }
      }}
      className="card-acid bg-bg-2 p-5"
    >
      <summary className="cursor-pointer select-none font-display text-lg font-extrabold tracking-tight text-text">
        {copy.title}
        <span className="ml-3 text-[10px] font-normal uppercase tracking-[0.16em] text-text-dim">
          rôles · son · machine · cues · écoute
        </span>
      </summary>
      <div className="mt-4">
        <GuideContent />
      </div>
    </details>
  );
}

/** En session : le même contenu par-dessus le cockpit, avec les liens de la session. */
export function GuideOverlay({ onClose, room, server }: Ctx & { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card-acid mx-auto my-6 max-w-3xl bg-bg-2 p-5"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-text">
            {copy.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-acid bg-bg-3 px-3 py-1.5 text-xs text-text-dim"
            style={{ borderWidth: '2px', boxShadow: '2px 2px 0 #000' }}
          >
            {copy.close}
          </button>
        </div>
        <div className="mt-4">
          <GuideContent room={room} server={server} />
        </div>
      </div>
    </div>
  );
}
