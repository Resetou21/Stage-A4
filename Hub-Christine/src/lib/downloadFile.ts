/**
 * Téléchargement universel compatible Desktop PC et Mobile (Android / iOS WebView dans Monday app)
 * Sur mobile, utilise l'API native navigator.share pour contourner le blocage des téléchargements d'iframe WebView.
 * Sur PC, utilise le téléchargement classique par ancre Blob avec révocation différée.
 */
export async function downloadFile(
  filename: string,
  content: string | Blob,
  mimeType = 'text/csv;charset=utf-8'
) {
  const blob =
    content instanceof Blob
      ? content
      : new Blob(['\uFEFF' + content], { type: mimeType });

  // 1. Mobile (Android & iOS WebView dans l'application Monday) : Web Share API
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
        });
        return;
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
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
}
