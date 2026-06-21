interface PermissionPromptProps {
  onRetry: () => void;
}

export function PermissionPrompt({ onRetry }: PermissionPromptProps) {
  return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="mb-3 text-2xl font-bold text-red">Accès MIDI refusé</h1>
      <p className="mb-4 text-text-dim">
        JAMBOREE a besoin de l'autorisation MIDI (avec SysEx) pour parler à
        ta machine. Autorise l'accès puis réessaie.
      </p>
      <button
        onClick={onRetry}
        className="rounded-md border border-line-bright bg-bg-3 px-4 py-2 text-text hover:border-blue"
      >
        Réessayer
      </button>
    </div>
  );
}
