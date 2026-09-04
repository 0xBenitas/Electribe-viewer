# Première jam à deux — audit de préparation (2026-09-04)

> Jamboree n'a encore jamais servi à une vraie jam à deux. Cet audit dit ce qui est
> prêt côté serveur, ce qui n'a jamais été validé, et le déroulé exact de la
> première session. Rien ne manque dans le code pour la faire : il manque un
> client NINJAM (Jamtaba) sur le PC de l'hôte, et un pote.

## Verdict

- **Serveur : prêt.** Les 4 services tournent depuis 22 h sans redémarrage ni
  erreur ; tout est joignable depuis l'extérieur (vérifs ci-dessous).
- **Machine : validée.** Web MIDI + EMX2 dialoguent (le panneau SysEx a parlé à la
  machine le 04/09).
- **Jamais validé : l'audio NINJAM bout en bout** (recette Phase 0 de `DEPLOY.md`)
  et la réplication cockpit entre deux personnes réelles. C'est l'étape suivante,
  et elle ne se fait qu'à deux.

## Audit serveur (04/09/2026, depuis le VPS et depuis l'extérieur)

| Composant | Vérification | Résultat |
|---|---|---|
| DNS | `jamboreeeeeeee.duckdns.org` → `89.167.31.144` = IP du VPS | ✅ |
| TLS (Caddy) | certificat valide, expire le 19/11/2026 (renouvellement auto) | ✅ |
| Cockpit | `https://…/` 200, bundle `index-D-Td_xPT.js`, salon de lobbies rendu, **0 erreur console** (Chromium headless), IndexedDB v3 ouverte | ✅ |
| Relais de session | `wss://…/ws` : handshake WebSocket 101 | ✅ |
| NINJAM (`jamboree-ninjam`) | port 2049 ouvert au monde (UFW), le serveur répond par un AUTH CHALLENGE, anonymes acceptés, 120 BPM / 16 BPI par défaut, 10 utilisateurs max ; joignable depuis 4 pays (check-host.net, 04/09 soir) ; **port de secours 2050** (même serveur) ajouté le 04/09 car 2049 = port NFS, souvent filtré côté client | ✅ |
| NINJAM : usage réel | logs : uniquement des scanners (username vide) | ⬜ jamais utilisé |
| Mixeur radio (`jamboree-ninjamcast`) | 1 connexion établie sur la room ; les erreurs dans ses logs datent du 06/08 (avant le redémarrage du 03/09) | ✅ |
| Icecast `/live` | `https://…/live` 200 `audio/mpeg`, 137 Ko reçus en 5 s (silence encodé tant que personne ne joue) | ✅ |
| Page d'écoute | `https://…/ecouter.html` 200 | ✅ |
| Conteneurs | `jamboree-ws`, `-ninjam`, `-icecast`, `-ninjamcast` : up 22 h, 0 restart, 0 erreur sur 24 h | ✅ |
| Build `ninjamsrv` | compilé et en service depuis juin (item « à valider » de `DEPLOY.md` clos) | ✅ |

## Ce qui n'a jamais été validé (à faire à deux)

1. **Audio** : tu joues, le pote t'entend dans Jamtaba (avec un intervalle de
   retard, c'est le principe de NINJAM) ; et l'inverse.
2. **Cockpit** : le pote voit ta machine (réplication), tu vois la sienne, un cue
   envoyé (touches 1 à 5) s'allume chez lui calé à la mesure.
3. **Écoute web** : `/live` avec du vrai son sur un téléphone via le lien d'écoute.
4. **Clock EMX2** : le BPM affiché dans le cockpit suit la machine (`0xF8`,
   `MIDI_FINDINGS.md` §clock, cases encore vides).

## 04/09 soir : le son passe dans le navigateur (ADR-007)

Jamtaba n'est plus nécessaire. Dans la session, panneau **SON** : choisir
l'entrée de la carte son, « Jouer : activer mon son ». L'hôte règle la grille
(BPM × temps par intervalle). Chacun entend les autres avec un intervalle de
retard (principe NINJAM), calé sur la même grille. Auditeurs : « Écouter » puis
« Écouter la jam » (Chrome/Edge). Jamtaba reste en mode expert (guide, dernière
section). ⚠️ `/live` et `ecouter.html` n'entendent pas ce son (ils écoutent le
mixeur NINJAM) : à traiter.

## Le mode d'emploi est dans l'app

Depuis le 04/09, l'accueil de <https://jamboreeeeeeee.duckdns.org> affiche une carte
« Mode d'emploi » (rôles, son via Jamtaba avec l'adresse du serveur à copier,
machine, cues, écoute, pièges, liens) et le bandeau de session a un bouton
« ? Mode d'emploi » qui l'ouvre par-dessus le cockpit avec les liens de la
session (lien musiciens + lien d'écoute) à lire aux potes. Texte dans
`src/copy/guide.json`, composant `src/components/Guide.tsx`.

## Ce qu'il te faut (toi = hôte)

- PC sous Windows, **Chrome ou Edge** (Web MIDI ; Safari et Firefox = écoute seule),
  EMX2 branché en USB.
- **Jamtaba 2**, le client NINJAM gratuit : <https://github.com/elieserdejesus/JamTaba/releases>
  (installeur Windows). Alternative si tu as REAPER : le plugin ReaNINJAM inclus.
- **Le son de l'EMX2 doit entrer dans le PC.** L'USB de l'EMX2 ne transporte que
  le MIDI. Il faut la sortie ligne de la machine vers une entrée de ta carte son,
  et choisir cette entrée dans Jamtaba. Casque conseillé (pas de réinjection).

## Ce qu'il faut au pote

- **Musicien** : même chose que toi (Chrome, Jamtaba, sa machine dans sa carte son).
  Sans machine, Jamtaba seul suffit pour entendre et parler.
- **Auditeur** : rien à installer. Il ouvre le lien d'écoute sur son téléphone.

## Déroulé de la première session (30 min)

1. **Toi** : ouvre <https://jamboreeeeeeee.duckdns.org>, crée une session (un nom),
   « Copier le lien », envoie-le au pote.
2. **Toi** : ouvre Jamtaba, connexion à un serveur privé :
   `jamboreeeeeeee.duckdns.org` port `2049`, sans mot de passe (login anonyme).
   Si Jamtaba dit « impossible to connect », port `2050` (secours, même room).
   Dans Jamtaba, règle le BPM sur celui de l'EMX2 (vote BPM) et garde BPI 16
   (= 4 mesures ; 8 pour réagir plus vite).
3. **Le pote musicien** fait les étapes 1 et 2 de son côté (il rejoint ta session
   par le lien). **Le pote auditeur** ouvre le bouton « Lien d'écoute » du bandeau
   sur son téléphone.
4. **Test son** : tu lances un pattern. Le pote doit t'entendre dans Jamtaba au
   prochain intervalle, et sur `/live` quelques secondes après. Puis l'inverse.
5. **Test cockpit** : il voit ta machine et tes parts bouger ; tu envoies un cue,
   il s'allume chez lui sur la mesure.
6. Remplis le compte rendu en bas de ce fichier, même si tout marche.

## Pièges connus

- **NINJAM = chacun entend l'intervalle précédent des autres.** Chaque machine
  doit tourner au BPM du serveur ; relance ton pattern sur le « 1 » du phare. Si
  ça dérive, relance. Le cockpit lit la clock MIDI de l'hôte, il ne synchronise
  pas l'EMX2 sur NINJAM : même BPM des deux côtés, à la main.
- **`/live` diffuse en continu**, silence compris : « En direct » sur la page
  d'écoute ne veut pas dire que quelqu'un joue.
- **Le port 2049 est ouvert au monde sans mot de passe de room** : n'importe qui
  parlant NINJAM peut entrer (les logs montrent des scans). Accepté pour l'instant ;
  un mot de passe de room est la suite logique dès que la jam marche.
- **Écriture SysEx (panneau jaune)** : depuis le 04/09 le dump est redemandé à la
  machine avant tout envoi et gardé dans le coffre (`.syx`). Un envoi remplace le
  contenu de travail du pattern sélectionné ; le slot n'est écrit que par Write.

## Compte rendu (à remplir après la première jam)

| Point | Résultat | Notes |
|---|---|---|
| Date, participants | | |
| Audio hôte → pote | ✅ / ❌ | |
| Audio pote → hôte | ✅ / ❌ | |
| Réplication machine dans le cockpit | ✅ / ❌ | |
| Cue calé à la mesure | ✅ / ❌ / ±1 mesure | |
| Écoute web sur téléphone | ✅ / ❌ | |
| BPM cockpit = BPM machine | ✅ / ❌ | |
| Ce qui a gêné le plus | | |
