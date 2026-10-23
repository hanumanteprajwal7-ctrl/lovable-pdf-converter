import JSZip from 'jszip';

/**
 * Format bytes to human readable string (e.g. 1.2 MB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Trigger browser file download from a Blob or Uint8Array
 */
export function downloadFile(
  data: Blob | Uint8Array | ArrayBuffer,
  fileName: string,
  mimeType = 'application/octet-stream'
) {
  let blob: Blob;
  if (data instanceof Blob) {
    blob = data;
  } else {
    // Uint8Array or ArrayBuffer
    const copy = data instanceof Uint8Array ? data.slice() : data;
    blob = new Blob([copy], { type: mimeType });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Revoke object URL after brief delay
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Create a ZIP archive Blob from files
 */
export async function createZipBlob(
  files: { name: string; data: Blob | Uint8Array | ArrayBuffer }[]
): Promise<Blob> {
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.data);
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Bundle multiple files into a ZIP archive and trigger download
 */
export async function downloadZip(
  files: { name: string; data: Blob | Uint8Array | ArrayBuffer }[],
  zipName = 'converted_documents.zip'
) {
  const zipBlob = await createZipBlob(files);
  downloadFile(zipBlob, zipName, 'application/zip');
}

