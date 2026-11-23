/**
 * Détecte spécifiquement la WebView intégrée de l'application Android Monday (téléphone et tablette),
 * où les téléchargements `blob:` et `navigator.share` en iframe sont bloqués par Android.
 * Retourne toujours `false` sur PC (Windows/Mac) et navigateurs web (Chrome/Safari/Edge).
 */
export function isAndroidMondayWebView(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (!/Android/i.test(ua)) return false;
  return /;\s*wv\b/i.test(ua) || (/Version\/\d+\.\d+/i.test(ua) && !/SamsungBrowser|OPR|EdgA/i.test(ua));
}

/**
 * Téléchargement universel compatible Desktop PC et Mobile
 * Sur PC/Chrome/Safari : téléchargement classique ou Web Share API.
 * Dans la WebView Android Monday : retourne `false` sans téléchargement silencieux trompeur.
 */
export async function downloadFile(
  filename: string,
  content: string | Blob,
  mimeType = 'text/csv;charset=utf-8'
): Promise<boolean> {
  if (isAndroidMondayWebView()) {
    return false;
  }

  const blob =
    content instanceof Blob
      ? content
      : new Blob(['\uFEFF' + content], { type: mimeType });

  // 1. Navigateurs mobiles compatibles Web Share API
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return true;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return false;
      console.warn('Web Share failed, fallback to anchor download', e);
    }
  }

  // 2. PC / Desktop ou Fallback classique
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
}
