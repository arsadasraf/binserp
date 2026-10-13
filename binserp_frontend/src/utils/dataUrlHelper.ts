/**
 * Helper to safely convert Base64 Data URLs to Blob URLs and trigger seamless downloads/previews.
 * Works around modern browser blocks on direct top-frame navigation to `data:` URLs.
 */

export function dataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    // If it's already an HTTP URL or plain text, return dummy blob
    return new Blob([dataUrl], { type: 'application/octet-stream' });
  }

  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  
  const byteString = atob(parts[1] || '');
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([uint8Array], { type: mimeType });
}

export function getSafeBlobUrl(urlOrDataUrl: string): string {
  if (!urlOrDataUrl) return '';
  if (urlOrDataUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(urlOrDataUrl);
    return URL.createObjectURL(blob);
  }
  return urlOrDataUrl;
}

export function openSafeUrlInNewTab(urlOrDataUrl: string): void {
  if (!urlOrDataUrl) return;
  if (urlOrDataUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(urlOrDataUrl);
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
  } else {
    window.open(urlOrDataUrl, '_blank');
  }
}

export function downloadDataUrl(urlOrDataUrl: string, filename: string = 'document.pdf'): void {
  if (!urlOrDataUrl) return;
  const link = document.createElement('a');
  if (urlOrDataUrl.startsWith('data:')) {
    const blob = dataUrlToBlob(urlOrDataUrl);
    const blobUrl = URL.createObjectURL(blob);
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } else {
    link.href = urlOrDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
