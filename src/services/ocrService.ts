import { createWorker, Worker } from 'tesseract.js';
import { renderPdfPagesToImages } from './pdfService';

let activeWorker: Worker | null = null;
let currentLanguage = 'eng';

/**
 * Get or initialize a Tesseract worker
 */
async function getWorker(
  language = 'eng',
  onProgress?: (progress: number, status: string) => void
): Promise<Worker> {
  if (activeWorker && currentLanguage === language) {
    return activeWorker;
  }

  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {
      // ignore
    }
    activeWorker = null;
  }

  activeWorker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress !== undefined) {
        if (onProgress) {
          onProgress(Math.round(m.progress * 100), m.status);
        }
      } else if (onProgress && m.status) {
        onProgress(10, m.status);
      }
    },
  });

  currentLanguage = language;
  return activeWorker;
}

/**
 * Perform OCR on an image file or blob
 */
export async function recognizeImage(
  imageSource: File | Blob | string,
  language = 'eng',
  onProgress?: (progress: number, status: string) => void
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker(language, onProgress);
  const result = await worker.recognize(imageSource);

  return {
    text: result.data.text.trim(),
    confidence: Math.round(result.data.confidence),
  };
}

/**
 * Perform OCR on a scanned multi-page PDF
 */
export async function recognizeScannedPdf(
  pdfBuffer: ArrayBuffer,
  language = 'eng',
  onProgress?: (progressPercent: number, pageNum: number, totalPages: number) => void
): Promise<{ fullText: string; pageTexts: { page: number; text: string; confidence: number }[] }> {
  // Step 1: Render PDF pages to images
  if (onProgress) onProgress(5, 0, 0);

  const images = await renderPdfPagesToImages(pdfBuffer, 'png', 150, (current, total) => {
    if (onProgress) {
      const renderProgress = Math.round((current / total) * 30);
      onProgress(renderProgress, current, total);
    }
  });

  const worker = await getWorker(language);
  const total = images.length;
  const pageTexts: { page: number; text: string; confidence: number }[] = [];
  const fullTextParts: string[] = [];

  for (let i = 0; i < total; i++) {
    const item = images[i];
    const pageNum = i + 1;

    const result = await worker.recognize(item.blob);
    const cleanText = result.data.text.trim();
    const conf = Math.round(result.data.confidence);

    pageTexts.push({
      page: pageNum,
      text: cleanText,
      confidence: conf,
    });
    fullTextParts.push(`--- Page ${pageNum} (OCR Confidence: ${conf}%) ---\n${cleanText}\n`);

    if (onProgress) {
      const overall = 30 + Math.round(((i + 1) / total) * 70);
      onProgress(overall, pageNum, total);
    }
  }

  return {
    fullText: fullTextParts.join('\n').trim(),
    pageTexts,
  };
}
