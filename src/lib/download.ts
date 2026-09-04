/** Déclenche le téléchargement d'un fichier binaire depuis le navigateur. */
export function downloadBytes(fileName: string, bytes: Uint8Array): void {
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer as ArrayBuffer], {
    type: 'application/octet-stream',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
