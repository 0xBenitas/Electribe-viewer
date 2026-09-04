import { ninjamTarget } from '../core/transport/ninjam.ts';

/** `host:port` du serveur NINJAM affiché partout (inliné au build, cf. DEPLOY.md). */
export const NINJAM_HOST =
  (import.meta.env.VITE_NINJAM_HOST as string | undefined) ?? 'localhost';

/** ninjamTarget ajoute le port par défaut s'il manque. */
export const NINJAM_TARGET = ninjamTarget(NINJAM_HOST);
