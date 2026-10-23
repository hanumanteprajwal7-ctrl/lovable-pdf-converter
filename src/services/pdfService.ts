// Ensure Promise.try and Uint8Array.toHex are available for PDF.js across all runtime environments
if (typeof (Promise as any).try !== 'function') {
  (Promise as any).try = function <T>(fn: (...args: any[]) => T | PromiseLike<T>, ...args: any[]): Promise<T> {
    return new Promise((resolve) => resolve(fn(...args)));
  };
}
if (typeof (Uint8Array.prototype as any).toHex !== 'function') {
  (Uint8Array.prototype as any).toHex = function (): string {
    let hex = '';
    for (let i = 0; i < this.length; i++) {
      hex += this[i].toString(16).padStart(2, '0');
    }
    return hex;
  };
}

import { PDFDocument, rgb, degrees, StandardFonts, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import {
  Document as DocxDocument,
  Paragraph as DocxParagraph,
  TextRun as DocxTextRun,
  HeadingLevel as DocxHeadingLevel,
  Packer as DocxPacker
} from 'docx';
import {
  CompressSettings,
  CompressResult,
  PageNumberOptions,
  WatermarkOptions,
  TextAnnotationOptions,
  ProtectPdfOptions,
  UnlockPdfOptions
} from '../types';
import { formatBytes } from '../utils/download';

// Configure PDF.js worker using reliable asset URL
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

export function getApiUrl(endpoint: string): string {
  if (typeof window !== 'undefined') return endpoint;
  return `http://localhost:3000${endpoint}`;
}

// Standard page dimensions in points (72 points per inch)
export const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  A4: { width: 595.28, height: 841.89 },
  'US-Letter': { width: 612.0, height: 792.0 },
  A3: { width: 841.89, height: 1190.55 },
};

/**
 * Convert images to a single or multi-page PDF document
 */
export async function imagesToPdf(
  images: { file: File; rotation?: number }[],
  options: {
    pageSize: 'A4' | 'US-Letter' | 'Fit' | 'A3';
    orientation: 'portrait' | 'landscape';
    margin: 'none' | 'small' | 'big';
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  const marginMap: Record<string, number> = {
    none: 0,
    small: 28.35, // ~10mm
    big: 56.7,    // ~20mm
  };
  const margin = marginMap[options.margin] || 0;

  for (const item of images) {
    const arrayBuffer = await item.file.arrayBuffer();
    const mimeType = item.file.type.toLowerCase();

    let embeddedImage;
    let imgWidth = 0;
    let imgHeight = 0;

    // Direct embed if standard JPG or PNG, otherwise rasterize through canvas
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      try {
        embeddedImage = await pdfDoc.embedJpg(arrayBuffer);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      } catch {
        // Fallback to canvas
        const raster = await rasterizeImageFile(item.file);
        embeddedImage = await pdfDoc.embedPng(raster);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      }
    } else if (mimeType === 'image/png') {
      try {
        embeddedImage = await pdfDoc.embedPng(arrayBuffer);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      } catch {
        const raster = await rasterizeImageFile(item.file);
        embeddedImage = await pdfDoc.embedPng(raster);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      }
    } else {
      // WebP, AVIF, HEIC, etc.
      const raster = await rasterizeImageFile(item.file);
      embeddedImage = await pdfDoc.embedPng(raster);
      imgWidth = embeddedImage.width;
      imgHeight = embeddedImage.height;
    }

    let pageWidth: number;
    let pageHeight: number;

    if (options.pageSize === 'Fit') {
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;
    } else {
      const baseSize = PAGE_SIZES[options.pageSize] || PAGE_SIZES.A4;
      if (options.orientation === 'landscape') {
        pageWidth = Math.max(baseSize.width, baseSize.height);
        pageHeight = Math.min(baseSize.width, baseSize.height);
      } else {
        pageWidth = Math.min(baseSize.width, baseSize.height);
        pageHeight = Math.max(baseSize.width, baseSize.height);
      }
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Apply manual rotation if set
    if (item.rotation) {
      page.setRotation(degrees(item.rotation % 360));
    }

    // Fit image inside available printable bounding box preserving aspect ratio
    const availableWidth = Math.max(10, pageWidth - margin * 2);
    const availableHeight = Math.max(10, pageHeight - margin * 2);

    const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;

    const x = margin + (availableWidth - drawWidth) / 2;
    const y = margin + (availableHeight - drawHeight) / 2;

    page.drawImage(embeddedImage, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return await pdfDoc.save();
}

/**
 * Helper to convert arbitrary image format to PNG buffer via browser canvas
 */
async function rasterizeImageFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 800;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to convert canvas to blob'));
          return;
        }
        blob.arrayBuffer().then(resolve).catch(reject);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file into canvas'));
    };
    img.src = url;
  });
}

/**
 * Convert plain text into a paginated PDF document
 */
export async function txtToPdf(
  text: string,
  options: { title?: string; fontSize?: number; pageSize?: 'A4' | 'US-Letter' } = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const baseSize = PAGE_SIZES[options.pageSize || 'A4'] || PAGE_SIZES.A4;
  const pageWidth = baseSize.width;
  const pageHeight = baseSize.height;

  const fontSize = options.fontSize || 11;
  const lineHeight = fontSize * 1.45;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const linesPerPage = Math.floor((pageHeight - margin * 2 - (options.title ? 40 : 0)) / lineHeight);

  const rawLines = text.split(/\r?\n/);
  const wrappedLines: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      wrappedLines.push('');
      continue;
    }
    const words = rawLine.split(' ');
    let currentLine = '';
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const textWidth = font.widthOfTextAtSize(candidate, fontSize);
      if (textWidth <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) wrappedLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) wrappedLines.push(currentLine);
  }

  let lineIndex = 0;
  let pageNumber = 1;

  while (lineIndex < wrappedLines.length || pageNumber === 1) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Optional header title
    if (options.title && pageNumber === 1) {
      page.drawText(options.title, {
        x: margin,
        y: y,
        size: 16,
        font: boldFont,
        color: rgb(0, 0.16, 0.56),
      });
      y -= 30;
    }

    const currentBatch = wrappedLines.slice(lineIndex, lineIndex + linesPerPage);
    for (const line of currentBatch) {
      if (line) {
        page.drawText(line, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.08, 0.1, 0.15),
        });
      }
      y -= lineHeight;
    }

    // Quiet page footer
    page.drawText(`${pageNumber}`, {
      x: pageWidth / 2 - 5,
      y: margin / 2,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.55),
    });

    lineIndex += linesPerPage;
    pageNumber++;
    if (lineIndex >= wrappedLines.length) break;
  }

  return await pdfDoc.save();
}

/**
 * Render PDF pages to JPG or PNG images using PDF.js
 */
export async function renderPdfPagesToImages(
  pdfBuffer: ArrayBuffer,
  format: 'jpg' | 'png' = 'png',
  dpi = 150,
  onProgress?: (current: number, total: number) => void,
  selectedPageNumbers?: number[]
): Promise<{ pageNumber: number; blob: Blob; dataUrl: string; width: number; height: number }[]> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const results: { pageNumber: number; blob: Blob; dataUrl: string; width: number; height: number }[] = [];

  const scale = dpi / 72;
  const pagesToProcess =
    selectedPageNumbers && selectedPageNumbers.length > 0
      ? selectedPageNumbers.filter((p) => p >= 1 && p <= numPages)
      : Array.from({ length: numPages }, (_, idx) => idx + 1);

  for (let idx = 0; idx < pagesToProcess.length; idx++) {
    const pageNum = pagesToProcess[idx];
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not create 2D canvas context for PDF rendering');

    // Solid white background for JPG
    if (format === 'jpg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Render page
    const renderContext = {
      canvasContext: ctx,
      viewport,
      canvas,
    };
    await page.render(renderContext).promise;

    const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpg' ? 0.92 : undefined;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to convert page ${pageNum} to image`));
        },
        mimeType,
        quality
      );
    });

    const dataUrl = canvas.toDataURL(mimeType, quality);

    results.push({
      pageNumber: pageNum,
      blob,
      dataUrl,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
    });

    if (onProgress) {
      onProgress(idx + 1, pagesToProcess.length);
    }
  }

  return results;
}

/**
 * Safely create a Blob from Uint8Array for all TypeScript DOM targets
 */
export function toPdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes) as unknown as BlobPart], { type: 'application/pdf' });
}


/**
 * Extract unicode text strings from PDF using PDF.js
 */
export async function extractTextFromPdf(
  pdfBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<{ fullText: string; pages: { pageNumber: number; text: string }[] }> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const pageTexts: { pageNumber: number; text: string }[] = [];
  const fullTextParts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str?: string; hasEOL?: boolean }>;
    
    let pageStr = '';
    for (const item of items) {
      if (item.str !== undefined) {
        pageStr += item.str + (item.hasEOL ? '\n' : ' ');
      }
    }
    const cleanStr = pageStr.trim();
    pageTexts.push({ pageNumber: i, text: cleanStr });
    fullTextParts.push(`--- Page ${i} ---\n${cleanStr}\n`);

    if (onProgress) onProgress(i, numPages);
  }

  return {
    fullText: fullTextParts.join('\n').trim(),
    pages: pageTexts,
  };
}

export interface MergePdfOptions {
  insertBlankPageBetween?: boolean;
  documentNames?: string[];
}

/**
 * Merge multiple PDFs into a single document using pdf-lib
 */
export async function mergePdfs(
  pdfBuffers: ArrayBuffer[],
  options?: MergePdfOptions,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  if (pdfBuffers.length === 0) {
    throw new Error('At least one PDF buffer is required to merge.');
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < pdfBuffers.length; i++) {
    const buffer = pdfBuffers[i];
    const docName = options?.documentNames?.[i] || `document #${i + 1}`;

    if (onProgress) onProgress(i + 1, pdfBuffers.length);

    let doc: PDFDocument;
    try {
      doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    } catch (err: any) {
      throw new Error(
        `Failed to parse "${docName}": ${err?.message || 'File may be corrupted or encrypted with a password.'}`
      );
    }

    const pageIndices = doc.getPageIndices();
    if (pageIndices.length === 0) {
      continue;
    }

    const copiedPages = await mergedPdf.copyPages(doc, pageIndices);
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }

    // Optional blank page separator for duplex printing if odd number of pages
    if (
      options?.insertBlankPageBetween &&
      i < pdfBuffers.length - 1 &&
      copiedPages.length % 2 !== 0
    ) {
      const lastPage = copiedPages[copiedPages.length - 1];
      const { width, height } = lastPage.getSize();
      mergedPdf.addPage([width, height]);
    }
  }

  return await mergedPdf.save({ useObjectStreams: true });
}

/**
 * Safely get total page count of a PDF document
 */
export async function getPdfPageCount(pdfBuffer: ArrayBuffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return 1;
  }
}


/**
 * Split a PDF into page ranges or single pages
 */
export async function splitPdf(
  pdfBuffer: ArrayBuffer,
  mode: 'all-pages' | 'custom-ranges',
  rangesStr = ''
): Promise<{ name: string; data: Uint8Array; pageCount: number }[]> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const outputs: { name: string; data: Uint8Array; pageCount: number }[] = [];

  if (mode === 'all-pages') {
    for (let i = 0; i < totalPages; i++) {
      const singleDoc = await PDFDocument.create();
      const [copiedPage] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copiedPage);
      const data = await singleDoc.save();
      outputs.push({
        name: `page_${i + 1}.pdf`,
        data,
        pageCount: 1,
      });
    }
  } else {
    // Parse range string e.g. "1-3, 5, 7-9"
    const groups = rangesStr.split(',').map((s) => s.trim()).filter(Boolean);
    let groupIndex = 1;

    for (const group of groups) {
      const pageIndices: number[] = [];
      if (group.includes('-')) {
        const [startStr, endStr] = group.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const from = Math.max(1, Math.min(start, end));
          const to = Math.min(totalPages, Math.max(start, end));
          for (let p = from; p <= to; p++) {
            pageIndices.push(p - 1);
          }
        }
      } else {
        const p = parseInt(group, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
          pageIndices.push(p - 1);
        }
      }

      if (pageIndices.length > 0) {
        const rangeDoc = await PDFDocument.create();
        const copied = await rangeDoc.copyPages(srcDoc, pageIndices);
        for (const p of copied) rangeDoc.addPage(p);
        const data = await rangeDoc.save();
        outputs.push({
          name: `split_range_${groupIndex}_pages_${group.replace(/\s+/g, '')}.pdf`,
          data,
          pageCount: pageIndices.length,
        });
        groupIndex++;
      }
    }
  }

  if (outputs.length === 0) {
    throw new Error('No valid pages matched the provided split ranges.');
  }

  return outputs;
}

/**
 * Extract selected page indices into a new PDF
 */
export async function extractPagesFromPdf(
  pdfBuffer: ArrayBuffer,
  selectedPageNumbers: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const validIndices = selectedPageNumbers
    .map((p) => p - 1)
    .filter((idx) => idx >= 0 && idx < total);

  if (validIndices.length === 0) {
    throw new Error('No valid pages selected for extraction.');
  }

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, validIndices);
  for (const page of copied) newDoc.addPage(page);

  return await newDoc.save();
}

/**
 * Remove selected page indices and save remaining pages
 */
export async function removePagesFromPdf(
  pdfBuffer: ArrayBuffer,
  pagesToRemove: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const total = srcDoc.getPageCount();
  const removeSet = new Set(pagesToRemove.map((p) => p - 1));

  const keepIndices: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!removeSet.has(i)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === 0) {
    throw new Error('Cannot remove all pages from a document. At least one page must remain.');
  }

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(srcDoc, keepIndices);
  for (const page of copied) newDoc.addPage(page);

  return await newDoc.save();
}

/**
 * Rotate specific or all pages in a PDF
 */
export async function rotatePdfPages(
  pdfBuffer: ArrayBuffer,
  pageRotationDeltas: Record<number, number> // 1-based page number -> degrees (e.g. 90, 180, 270)
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = doc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    const delta = pageRotationDeltas[pageNum] || pageRotationDeltas[-1] || 0; // -1 represents rotate all
    if (delta !== 0) {
      const current = pages[i].getRotation().angle;
      const target = (current + delta) % 360;
      pages[i].setRotation(degrees(target));
    }
  }

  return await doc.save();
}

/**
 * Reorder pages according to new array of 1-based page numbers
 */
export async function reorderPdfPages(
  pdfBuffer: ArrayBuffer,
  newOrderPageNumbers: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  const total = srcDoc.getPageCount();
  const indices = newOrderPageNumbers
    .map((p) => p - 1)
    .filter((idx) => idx >= 0 && idx < total);

  if (indices.length === 0) {
    throw new Error('Invalid page reordering sequence.');
  }

  const copied = await newDoc.copyPages(srcDoc, indices);
  for (const page of copied) newDoc.addPage(page);

  return await newDoc.save();
}

/**
 * Recompresses an embedded JPEG byte stream in the browser using HTML5 Canvas.
 * Returns new smaller JPEG bytes and new dimensions, or null if recompression did not reduce size.
 */
async function recompressJpegBytes(
  jpegBytes: Uint8Array,
  targetMaxWidth: number,
  targetMaxHeight: number,
  quality: number,
  colorMode: 'full' | 'gray' | 'mono'
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const blob = new Blob([new Uint8Array(jpegBytes) as unknown as BlobPart], { type: 'image/jpeg' });
      const url = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(url);
        const origW = img.naturalWidth || img.width;
        const origH = img.naturalHeight || img.height;

        if (!origW || !origH) {
          resolve(null);
          return;
        }

        let scale = 1;
        if (origW > targetMaxWidth || origH > targetMaxHeight) {
          scale = Math.min(targetMaxWidth / origW, targetMaxHeight / origH);
        }

        // If dimensions are already within target and color is full and quality is high, skip
        if (scale >= 0.98 && quality >= 0.88 && colorMode === 'full') {
          resolve(null);
          return;
        }

        const newW = Math.max(1, Math.round(origW * scale));
        const newH = Math.max(1, Math.round(origH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = newW;
        canvas.height = newH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, newW, newH);
        ctx.drawImage(img, 0, 0, newW, newH);

        if (colorMode === 'gray') {
          const imgData = ctx.getImageData(0, 0, newW, newH);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            d[i] = luma;
            d[i + 1] = luma;
            d[i + 2] = luma;
          }
          ctx.putImageData(imgData, 0, 0);
        } else if (colorMode === 'mono') {
          const imgData = ctx.getImageData(0, 0, newW, newH);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const val = luma > 128 ? 255 : 0;
            d[i] = val;
            d[i + 1] = val;
            d[i + 2] = val;
          }
          ctx.putImageData(imgData, 0, 0);
        }

        canvas.toBlob(
          async (outBlob) => {
            if (!outBlob) {
              resolve(null);
              return;
            }
            try {
              const buf = await outBlob.arrayBuffer();
              const outBytes = new Uint8Array(buf);
              // Crucial: Only accept if the new JPEG is actually smaller than the original!
              if (outBytes.length < jpegBytes.length * 0.97) {
                resolve({ data: outBytes, width: newW, height: newH });
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };

      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Real PDF Compression implementing genuine document optimization:
 * - Preserves selectable text, vectors, page geometry and fonts by default
 * - Never converts vector/text pages into raster images
 * - Compresses and downsamples embedded image XObjects when present
 * - Performs structural object compaction, metadata cleaning, and FlateDecode streams
 * - Compares original size vs output size and keeps the smaller valid file
 * - Detects already-optimized files and reports honest metrics
 */
export async function compressPdf(
  pdfBuffer: ArrayBuffer,
  settings: CompressSettings,
  onProgress?: (percent: number, msg: string) => void
): Promise<CompressResult> {
  const originalSize = pdfBuffer.byteLength;

  if (onProgress) onProgress(8, 'Analyzing PDF document structure & streams...');

  // Load document with pdf-lib
  const srcDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  // Inspect if the document has selectable text layers using PDF.js
  let hasSelectableText = false;
  try {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) });
    const pdf = await loadingTask.promise;
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
      const page = await pdf.getPage(i);
      const text = await page.getTextContent();
      const textLength = text.items.reduce(
        (acc: number, item: any) => acc + (item.str ? item.str.length : 0),
        0
      );
      if (textLength > 15) {
        hasSelectableText = true;
        break;
      }
    }
  } catch (err) {
    console.warn('Could not inspect PDF text stream:', err);
  }

  const isTargetSizeMode = settings.preset === 'target-size';
  const targetVal = settings.targetSizeValue || 250;
  const targetUnit = settings.targetSizeUnit || 'KB';
  let targetSizeBytes: number | undefined;

  if (isTargetSizeMode) {
    targetSizeBytes = Math.max(1024, targetVal * (targetUnit === 'MB' ? 1024 * 1024 : 1024));
  } else if (settings.preset === 'custom' && settings.targetReductionPercent) {
    targetSizeBytes = Math.max(1024, Math.round(originalSize * (1 - settings.targetReductionPercent / 100)));
  }

  // If document is ALREADY smaller than or equal to target size:
  if (targetSizeBytes && originalSize <= targetSizeBytes) {
    if (onProgress) onProgress(100, 'Document already within target size');
    return {
      data: new Uint8Array(pdfBuffer),
      originalSize,
      newSize: originalSize,
      reductionPercent: 0,
      bytesSaved: 0,
      modeUsed: 'already-optimized',
      isAlreadyOptimized: true,
      pageCount: totalPages,
      hasSelectableText,
      targetSizeBytes,
      targetAchieved: true,
      withinTolerance: true,
      tolerancePercent: 0,
      compressionMethodNotice: 'Already meets target size',
      message: `Document (${formatBytes(originalSize)}) is already smaller than or equal to your target size of ${formatBytes(targetSizeBytes)}. Further compression is unnecessary.`,
    };
  }

  // 1. Invoke Backend Compression Engine (/api/pdf/compress)
  if (onProgress) onProgress(15, 'Engaging backend precision compression engine with real size verification...');
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'x-preset': settings.preset,
      'x-color-mode': settings.colorMode,
      'x-dpi': String(settings.dpi || 150),
      'x-quality': String(settings.quality || 0.75),
    };
    if (targetSizeBytes) {
      headers['x-target-size-bytes'] = String(targetSizeBytes);
    }
    if (settings.targetReductionPercent) {
      headers['x-target-reduction-percent'] = String(settings.targetReductionPercent);
    }

    const backendRes = await fetch(getApiUrl('/api/pdf/compress'), {
      method: 'POST',
      headers,
      body: pdfBuffer,
    });

    if (backendRes.ok) {
      const isAlreadyOptimized = backendRes.headers.get('x-is-already-optimized') === 'true';
      const targetAchieved = backendRes.headers.get('x-target-achieved') === 'true';
      const withinTolerance = backendRes.headers.get('x-within-tolerance') === 'true';
      const tolerancePercent = backendRes.headers.get('x-tolerance-percent')
        ? parseFloat(backendRes.headers.get('x-tolerance-percent')!)
        : undefined;
      const compressionMethodNotice =
        backendRes.headers.get('x-compression-method') || 'Ghostscript Backend Engine';
      const rawMessage = backendRes.headers.get('x-compression-message');
      const message = rawMessage ? decodeURIComponent(rawMessage) : undefined;

      const outputArrayBuf = await backendRes.arrayBuffer();
      const outputData = new Uint8Array(outputArrayBuf);
      const measuredNewSize = outputData.byteLength;

      // Real size verification: only accept if strictly reduced or verified already optimized
      if (measuredNewSize < originalSize || isAlreadyOptimized) {
        if (onProgress) onProgress(100, 'Optimization verified and complete');
        return {
          data: outputData,
          originalSize,
          newSize: measuredNewSize,
          reductionPercent: isAlreadyOptimized
            ? 0
            : Number((((originalSize - measuredNewSize) / originalSize) * 100).toFixed(1)),
          bytesSaved: isAlreadyOptimized ? 0 : originalSize - measuredNewSize,
          modeUsed: isAlreadyOptimized ? 'already-optimized' : 'target-progressive',
          isAlreadyOptimized,
          pageCount: totalPages,
          hasSelectableText,
          targetSizeBytes,
          targetAchieved,
          withinTolerance,
          tolerancePercent,
          compressionMethodNotice,
          message,
        };
      }
    }
  } catch (err) {
    console.warn('Backend compression engine bypassed or failed, using progressive client engine:', err);
  }

  // Candidate representation
  type Candidate = {
    data: Uint8Array;
    size: number;
    mode: 'structural-deflate' | 'image-downsample' | 'scanned-raster' | 'target-progressive';
    stageDescription: string;
  };
  const candidates: Candidate[] = [];

  // Stage 1: Lossless structural object compaction & metadata cleaning
  if (onProgress) onProgress(20, 'Stage 1: Performing lossless structural object stream compaction...');
  try {
    const structuralDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    structuralDoc.setTitle('');
    structuralDoc.setAuthor('');
    structuralDoc.setSubject('');
    structuralDoc.setKeywords([]);
    structuralDoc.setProducer('Lovable PDF Converter');
    structuralDoc.setCreator('Lovable PDF Converter');
    try {
      if (structuralDoc.catalog.has(PDFName.of('Metadata'))) {
        structuralDoc.catalog.delete(PDFName.of('Metadata'));
      }
    } catch {}

    const structBytes = await structuralDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    if (structBytes.byteLength < originalSize) {
      candidates.push({
        data: structBytes,
        size: structBytes.byteLength,
        mode: 'structural-deflate',
        stageDescription: 'Lossless structural object compaction',
      });
    }
  } catch (err) {
    console.warn('Structural compaction notice:', err);
  }

  // Check if Stage 1 already hit target in target-size mode
  const hitTargetInStage1 = isTargetSizeMode && targetSizeBytes && candidates.some(c => c.size <= targetSizeBytes);

  // Progressive image optimization stages
  const imageOptimizationPasses = isTargetSizeMode
    ? [
        { quality: 0.78, dpi: 150, maxW: 1600, maxH: 2200, label: 'Gentle embedded image optimization' },
        { quality: 0.58, dpi: 120, maxW: 1200, maxH: 1600, label: 'Moderate image downsampling' },
        { quality: 0.40, dpi: 96, maxW: 900, maxH: 1200, label: 'Strong image downsampling' },
      ]
    : [
        {
          quality: settings.preset === 'recommended' ? 0.75 : settings.preset === 'maximum' ? 0.50 : settings.preset === 'high-quality' ? 0.88 : Math.max(0.2, Math.min(1.0, settings.quality)),
          dpi: settings.preset === 'recommended' ? 150 : settings.preset === 'maximum' ? 96 : settings.preset === 'high-quality' ? 200 : settings.dpi,
          maxW: settings.preset === 'recommended' ? 1600 : settings.preset === 'maximum' ? 1200 : settings.preset === 'high-quality' ? 2400 : Math.round((settings.dpi / 72) * 612),
          maxH: settings.preset === 'recommended' ? 2200 : settings.preset === 'maximum' ? 1600 : settings.preset === 'high-quality' ? 3200 : Math.round((settings.dpi / 72) * 792),
          label: settings.preset === 'recommended' ? 'Recommended balanced preset' : settings.preset === 'maximum' ? 'Maximum compression preset' : settings.preset === 'high-quality' ? 'High quality preset' : 'Custom tuning',
        },
      ];

  if (!hitTargetInStage1) {
    for (let passIdx = 0; passIdx < imageOptimizationPasses.length; passIdx++) {
      const pass = imageOptimizationPasses[passIdx];
      const progressBase = 35 + Math.round((passIdx / imageOptimizationPasses.length) * 35);
      if (onProgress) onProgress(progressBase, `Stage ${passIdx + 2}: ${pass.label}...`);

      try {
        const imageDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        imageDoc.setTitle('');
        imageDoc.setAuthor('');
        imageDoc.setProducer('Lovable PDF Converter');
        try {
          if (imageDoc.catalog.has(PDFName.of('Metadata'))) {
            imageDoc.catalog.delete(PDFName.of('Metadata'));
          }
        } catch {}

        let replacedCount = 0;
        const indirectObjects = imageDoc.context.enumerateIndirectObjects();

        for (let idx = 0; idx < indirectObjects.length; idx++) {
          const [ref, obj] = indirectObjects[idx];
          if (obj instanceof PDFRawStream) {
            const subtype = obj.dict.get(PDFName.of('Subtype'))?.toString();
            if (subtype === '/Image') {
              const filter = obj.dict.get(PDFName.of('Filter'))?.toString();
              const contents = obj.getContents();

              if (filter?.includes('DCTDecode') && contents.length >= 10000) {
                const recompressed = await recompressJpegBytes(
                  contents,
                  pass.maxW,
                  pass.maxH,
                  pass.quality,
                  settings.colorMode
                );

                if (recompressed && recompressed.data.length < contents.length) {
                  const newDict = obj.dict.clone();
                  newDict.set(PDFName.of('Width'), PDFNumber.of(recompressed.width));
                  newDict.set(PDFName.of('Height'), PDFNumber.of(recompressed.height));
                  newDict.set(PDFName.of('Length'), PDFNumber.of(recompressed.data.length));
                  const newStream = PDFRawStream.of(newDict, recompressed.data);
                  imageDoc.context.assign(ref, newStream);
                  replacedCount++;
                }
              }
            }
          }
        }

        if (replacedCount > 0) {
          const imgBytes = await imageDoc.save({ useObjectStreams: true, addDefaultPage: false });
          if (imgBytes.byteLength < originalSize) {
            candidates.push({
              data: imgBytes,
              size: imgBytes.byteLength,
              mode: isTargetSizeMode ? 'target-progressive' : 'image-downsample',
              stageDescription: pass.label,
            });

            // If target size reached, stop further passes
            if (isTargetSizeMode && targetSizeBytes && imgBytes.byteLength <= targetSizeBytes) {
              break;
            }
          }
        }
      } catch (err) {
        console.warn(`Image pass ${passIdx} notice:`, err);
      }
    }
  }

  // Stage: Ghostscript Backend Engine optimization pass if target is not yet met
  const targetReachedSoFar = isTargetSizeMode && targetSizeBytes && candidates.some(c => c.size <= targetSizeBytes);
  if ((isTargetSizeMode && !targetReachedSoFar) || settings.preset === 'maximum') {
    if (onProgress) onProgress(75, 'Stage: Applying Ghostscript PDF stream optimization pass...');
    try {
      const gsSetting = isTargetSizeMode ? '/screen' : '/ebook';
      const gsBytes = await tryGhostscriptCompressPass(pdfBuffer, gsSetting);
      if (gsBytes && gsBytes.byteLength < originalSize) {
        candidates.push({
          data: gsBytes,
          size: gsBytes.byteLength,
          mode: isTargetSizeMode ? 'target-progressive' : 'image-downsample',
          stageDescription: 'Ghostscript stream optimization',
        });
      }
    } catch {}
  }

  // Scanned PDF Fallback (ONLY when document has NO selectable text and protectVectors is false)
  if (!hasSelectableText && !settings.protectVectors && (!targetReachedSoFar || settings.preset === 'maximum')) {
    if (onProgress) onProgress(85, 'Optimizing scanned document pages...');
    try {
      const targetDpi = isTargetSizeMode ? 96 : Math.min(settings.dpi, 150);
      const rendered = await renderPdfPagesToImages(
        pdfBuffer,
        'jpg',
        targetDpi,
        (curr, total) => {
          if (onProgress) {
            onProgress(85 + Math.round((curr / total) * 10), `Processing scanned page ${curr} of ${total}...`);
          }
        }
      );

      const scannedDoc = await PDFDocument.create();
      for (const item of rendered) {
        let buf: ArrayBuffer;
        if (settings.colorMode === 'gray' || settings.colorMode === 'mono') {
          buf = await applyColorModeToBlob(item.blob, settings.colorMode);
        } else {
          buf = await item.blob.arrayBuffer();
        }
        const embeddedImg = await scannedDoc.embedJpg(buf);
        const p = scannedDoc.addPage([item.width * (72 / targetDpi), item.height * (72 / targetDpi)]);
        p.drawImage(embeddedImg, { x: 0, y: 0, width: p.getWidth(), height: p.getHeight() });
      }

      const scannedBytes = await scannedDoc.save({ useObjectStreams: true });
      if (scannedBytes.byteLength < originalSize) {
        candidates.push({
          data: scannedBytes,
          size: scannedBytes.byteLength,
          mode: 'scanned-raster',
          stageDescription: 'Scanned document raster optimization',
        });
      }
    } catch (err) {
      console.warn('Scanned raster optimization notice:', err);
    }
  }

  if (onProgress) onProgress(95, 'Verifying candidate outputs and measuring file sizes...');

  // Candidate Selection
  // Valid candidates strictly smaller than originalSize
  const validCandidates: Candidate[] = [];
  for (const c of candidates) {
    if (c.size < originalSize) {
      try {
        const verifyDoc = await PDFDocument.load(c.data, { ignoreEncryption: true });
        if (verifyDoc.getPageCount() === totalPages) {
          validCandidates.push(c);
        }
      } catch {}
    }
  }

  if (onProgress) onProgress(100, 'Complete');

  // TARGET SIZE MODE EVALUATION
  if (targetSizeBytes) {
    const targetMin = targetSizeBytes * 0.97;
    const targetMax = targetSizeBytes * 1.03;

    // 1. Check if any valid candidate achieved within +-3% of target window
    const inTolCandidates = validCandidates.filter((c) => c.size >= targetMin && c.size <= targetMax);

    if (inTolCandidates.length > 0) {
      inTolCandidates.sort(
        (a, b) => Math.abs(a.size - targetSizeBytes) - Math.abs(b.size - targetSizeBytes)
      );
      const winner = inTolCandidates[0];
      const newSize = winner.size;
      const bytesSaved = originalSize - newSize;
      const reductionPercent = Math.max(0.1, Number((((originalSize - newSize) / originalSize) * 100).toFixed(1)));
      const tolerancePercent = Number((((newSize - targetSizeBytes) / targetSizeBytes) * 100).toFixed(1));

      return {
        data: winner.data,
        originalSize,
        newSize,
        reductionPercent,
        bytesSaved,
        modeUsed: winner.mode,
        isAlreadyOptimized: false,
        pageCount: totalPages,
        hasSelectableText,
        targetSizeBytes,
        targetAchieved: true,
        withinTolerance: true,
        tolerancePercent,
        compressionMethodNotice: winner.stageDescription,
        message: `Target achieved within ±3% tolerance! Reduced to ${formatBytes(newSize)} (${
          tolerancePercent >= 0 ? '+' : ''
        }${tolerancePercent}% of target). Optimal quality preserved without unnecessary compression.`,
      };
    }

    // 2. Check if any valid candidate reached <= targetSizeBytes (prevent overcompression by picking largest <= target)
    const targetAchievedCandidates = validCandidates.filter((c) => c.size <= targetSizeBytes);

    if (targetAchievedCandidates.length > 0) {
      targetAchievedCandidates.sort((a, b) => b.size - a.size);
      const winner = targetAchievedCandidates[0];
      const newSize = winner.size;
      const bytesSaved = originalSize - newSize;
      const reductionPercent = Math.max(0.1, Number((((originalSize - newSize) / originalSize) * 100).toFixed(1)));
      const tolerancePercent = Number((((newSize - targetSizeBytes) / targetSizeBytes) * 100).toFixed(1));

      return {
        data: winner.data,
        originalSize,
        newSize,
        reductionPercent,
        bytesSaved,
        modeUsed: winner.mode,
        isAlreadyOptimized: false,
        pageCount: totalPages,
        hasSelectableText,
        targetSizeBytes,
        targetAchieved: true,
        withinTolerance: false,
        tolerancePercent,
        compressionMethodNotice: winner.stageDescription,
        message: `Target achieved! Successfully reduced document to ${formatBytes(newSize)} (below requested target of ${formatBytes(targetSizeBytes)}).`,
      };
    }

    // 3. Target could not be fully reached, but we have smaller valid candidates
    if (validCandidates.length > 0) {
      // Pick the smallest candidate achieved (best effort)
      validCandidates.sort((a, b) => a.size - b.size);
      const winner = validCandidates[0];
      const newSize = winner.size;
      const bytesSaved = originalSize - newSize;
      const reductionPercent = Math.max(0.1, Number((((originalSize - newSize) / originalSize) * 100).toFixed(1)));
      const tolerancePercent = Number((((newSize - targetSizeBytes) / targetSizeBytes) * 100).toFixed(1));

      return {
        data: winner.data,
        originalSize,
        newSize,
        reductionPercent,
        bytesSaved,
        modeUsed: winner.mode,
        isAlreadyOptimized: false,
        pageCount: totalPages,
        hasSelectableText,
        targetSizeBytes,
        targetAchieved: false,
        withinTolerance: false,
        tolerancePercent,
        compressionMethodNotice: winner.stageDescription,
        message: `Requested target of ${formatBytes(targetSizeBytes)} could not be reached without excessive visual corruption. Achieved best possible reduction to ${formatBytes(newSize)} (${reductionPercent}% saved).`,
      };
    }

    // 3. Document could not be reduced at all
    return {
      data: new Uint8Array(pdfBuffer),
      originalSize,
      newSize: originalSize,
      reductionPercent: 0,
      bytesSaved: 0,
      modeUsed: 'already-optimized',
      isAlreadyOptimized: true,
      pageCount: totalPages,
      hasSelectableText,
      targetSizeBytes,
      targetAchieved: false,
      compressionMethodNotice: 'Already optimized',
      message: `Compression did not reduce this file. This PDF may already be optimized or its vector content cannot be compressed further.`,
    };
  }

  // STANDARD PRESET MODE EVALUATION
  if (validCandidates.length > 0) {
    validCandidates.sort((a, b) => a.size - b.size);
    const winner = validCandidates[0];
    const newSize = winner.size;
    const bytesSaved = originalSize - newSize;
    const reductionPercent = Math.max(0.1, Number((((originalSize - newSize) / originalSize) * 100).toFixed(1)));

    return {
      data: winner.data,
      originalSize,
      newSize,
      reductionPercent,
      bytesSaved,
      modeUsed: winner.mode,
      isAlreadyOptimized: false,
      pageCount: totalPages,
      hasSelectableText,
      compressionMethodNotice: winner.stageDescription,
    };
  }

  // Document cannot be compressed further
  return {
    data: new Uint8Array(pdfBuffer),
    originalSize,
    newSize: originalSize,
    reductionPercent: 0,
    bytesSaved: 0,
    modeUsed: 'already-optimized',
    isAlreadyOptimized: true,
    pageCount: totalPages,
    hasSelectableText,
    message: 'Compression did not reduce this file. This PDF may already be optimized or may contain content that cannot be compressed further.',
  };
}

/**
 * Backend Ghostscript compression pass helper
 */
async function tryGhostscriptCompressPass(
  pdfBuffer: ArrayBuffer,
  setting: '/screen' | '/ebook' = '/ebook'
): Promise<Uint8Array | null> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch(getApiUrl('/api/pdf/compress-pass'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/pdf',
        'x-pdf-setting': setting,
      },
      body: pdfBuffer,
    });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    }
  } catch {}
  return null;
}

/**
 * Helper to transform blob color modes (Grayscale / Monochrome)
 */
async function applyColorModeToBlob(blob: Blob, mode: 'gray' | 'mono'): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Luminance calculation
        const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (mode === 'mono') {
          const val = avg > 128 ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        } else {
          data[i] = avg;
          data[i + 1] = avg;
          data[i + 2] = avg;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob((b) => {
        if (b) b.arrayBuffer().then(resolve).catch(reject);
        else reject(new Error('Failed to export color-adjusted canvas'));
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    img.src = url;
  });
}

/**
 * Add page numbers to all pages of a PDF
 */
export async function addPageNumbers(
  pdfBuffer: ArrayBuffer,
  options: PageNumberOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const total = doc.getPageCount();
  const pages = doc.getPages();

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const currentNum = i + options.startNumber;

    let text = `${currentNum}`;
    if (options.format === 'page-x-of-y') {
      text = `Page ${currentNum} of ${total}`;
    } else if (options.format === 'page-x') {
      text = `Page ${currentNum}`;
    }

    const textWidth = font.widthOfTextAtSize(text, options.fontSize);
    let x = width / 2 - textWidth / 2;
    let y = 25;

    switch (options.position) {
      case 'bottom-center':
        x = width / 2 - textWidth / 2;
        y = 25;
        break;
      case 'bottom-right':
        x = width - textWidth - 30;
        y = 25;
        break;
      case 'bottom-left':
        x = 30;
        y = 25;
        break;
      case 'top-right':
        x = width - textWidth - 30;
        y = height - 30;
        break;
    }

    page.drawText(text, {
      x,
      y,
      size: options.fontSize,
      font,
      color: rgb(0.3, 0.35, 0.4),
    });
  }

  return await doc.save();
}

/**
 * Add a text watermark to all pages
 */
export async function addWatermark(
  pdfBuffer: ArrayBuffer,
  options: WatermarkOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    const textHeight = font.heightAtSize(options.fontSize);

    page.drawText(options.text, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 2,
      size: options.fontSize,
      font,
      color: rgb(0.65, 0.65, 0.7),
      opacity: Math.max(0.05, Math.min(1.0, options.opacity)),
      rotate: degrees(options.rotation || 45),
    });
  }

  return await doc.save();
}

/**
 * Add custom text annotation to a specific page
 */
export async function addTextAnnotation(
  pdfBuffer: ArrayBuffer,
  options: TextAnnotationOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = doc.getPages();
  const pageIndex = Math.max(0, Math.min(pages.length - 1, options.pageNumber - 1));
  const page = pages[pageIndex];

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = page.getSize();

  const x = (options.xPercent / 100) * width;
  const y = height - (options.yPercent / 100) * height; // Invert y for PDF coordinate origin at bottom

  page.drawText(options.text, {
    x,
    y,
    size: options.fontSize,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  return await doc.save();
}

/**
 * Convert Excel workbooks (.xlsx, .xls, .csv) into paginated PDF tables
 */
export async function excelToPdf(
  fileBuffer: ArrayBuffer,
  fileName: string,
  options?: { pageSize?: 'A4' | 'US-Letter' | 'A3' | 'Fit'; orientation?: 'portrait' | 'landscape' }
): Promise<Uint8Array> {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const selectedSizeKey = options?.pageSize && options.pageSize !== 'Fit' ? options.pageSize : 'A4';
  const baseSize = PAGE_SIZES[selectedSizeKey] || PAGE_SIZES.A4;
  const isLandscape = options?.orientation !== 'portrait'; // default landscape for tables
  const pageWidth = isLandscape ? Math.max(baseSize.width, baseSize.height) : Math.min(baseSize.width, baseSize.height);
  const pageHeight = isLandscape ? Math.min(baseSize.width, baseSize.height) : Math.max(baseSize.width, baseSize.height);

  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let totalPagesRendered = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
    const data = rawData.filter((row) => row && row.some((c) => String(c).trim() !== ''));

    if (data.length === 0) continue;

    const maxCols = Math.min(10, Math.max(...data.map((r) => r.length), 1));
    const colWidth = Math.max(45, contentWidth / maxCols);
    const rowHeight = 22;
    const headerHeight = 26;
    const rowsPerPage = Math.floor((pageHeight - margin * 2 - 45) / rowHeight);

    let rowIndex = 0;
    let sheetPage = 1;

    while (rowIndex < data.length) {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      totalPagesRendered++;
      let currentY = pageHeight - margin;

      // Sheet Title Banner
      page.drawText(`${sheetName} — ${fileName.replace(/\.[^/.]+$/, '')}`, {
        x: margin,
        y: currentY - 14,
        size: 13,
        font: boldFont,
        color: rgb(0, 0.16, 0.56),
      });

      currentY -= 32;

      const batch = data.slice(rowIndex, rowIndex + rowsPerPage);
      const isFirstBatch = rowIndex === 0;

      for (let bIdx = 0; bIdx < batch.length; bIdx++) {
        const row = batch[bIdx];
        const isHeaderRow = isFirstBatch && bIdx === 0;
        const currentH = isHeaderRow ? headerHeight : rowHeight;

        // Row background
        if (isHeaderRow) {
          page.drawRectangle({
            x: margin,
            y: currentY - currentH + 4,
            width: contentWidth,
            height: currentH,
            color: rgb(0.92, 0.94, 0.98),
          });
        } else if (bIdx % 2 === 1) {
          page.drawRectangle({
            x: margin,
            y: currentY - currentH + 4,
            width: contentWidth,
            height: currentH,
            color: rgb(0.98, 0.98, 0.99),
          });
        }

        // Draw cells
        for (let col = 0; col < maxCols; col++) {
          const rawCell = row[col];
          const text = rawCell !== undefined && rawCell !== null ? String(rawCell).trim() : '';
          const cellX = margin + col * colWidth + 5;
          const cellY = currentY - currentH + 8;

          let displayText = text;
          const currentFont = isHeaderRow ? boldFont : font;
          const fontSize = isHeaderRow ? 9 : 8.5;
          while (displayText.length > 3 && currentFont.widthOfTextAtSize(displayText + '..', fontSize) > colWidth - 10) {
            displayText = displayText.slice(0, -1);
          }
          if (displayText !== text) displayText += '..';

          page.drawText(displayText, {
            x: cellX,
            y: cellY,
            size: fontSize,
            font: currentFont,
            color: isHeaderRow ? rgb(0, 0.16, 0.56) : rgb(0.15, 0.18, 0.22),
          });

          // Cell vertical divider
          page.drawLine({
            start: { x: margin + col * colWidth, y: currentY + 4 },
            end: { x: margin + col * colWidth, y: currentY - currentH + 4 },
            thickness: 0.5,
            color: rgb(0.85, 0.88, 0.92),
          });
        }

        // Right boundary
        page.drawLine({
          start: { x: margin + contentWidth, y: currentY + 4 },
          end: { x: margin + contentWidth, y: currentY - currentH + 4 },
          thickness: 0.5,
          color: rgb(0.85, 0.88, 0.92),
        });

        // Bottom border line
        page.drawLine({
          start: { x: margin, y: currentY - currentH + 4 },
          end: { x: margin + contentWidth, y: currentY - currentH + 4 },
          thickness: 0.5,
          color: rgb(0.85, 0.88, 0.92),
        });

        currentY -= currentH;
      }

      // Page footer
      page.drawText(`Sheet: ${sheetName} · Page ${sheetPage}`, {
        x: margin,
        y: margin / 2,
        size: 8,
        font,
        color: rgb(0.5, 0.55, 0.6),
      });

      rowIndex += rowsPerPage;
      sheetPage++;
    }
  }

  if (totalPagesRendered === 0) {
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawText('Spreadsheet contained no readable data.', {
      x: margin,
      y: pageHeight / 2,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Convert Microsoft Word documents (.docx) to a structured PDF document
 */
export async function wordToPdf(
  fileBuffer: ArrayBuffer,
  options?: { pageSize?: 'A4' | 'US-Letter' | 'A3' | 'Fit'; orientation?: 'portrait' | 'landscape' }
): Promise<Uint8Array> {
  const nodeBuf = typeof Buffer !== 'undefined' ? Buffer.from(fileBuffer) : undefined;
  const rawTextResult = await (mammoth as any).extractRawText({
    arrayBuffer: fileBuffer,
    ...(nodeBuf ? { buffer: nodeBuf } : {}),
  });
  const rawText = rawTextResult?.value || '';

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const selectedSizeKey = options?.pageSize && options.pageSize !== 'Fit' ? options.pageSize : 'A4';
  const baseSize = PAGE_SIZES[selectedSizeKey] || PAGE_SIZES.A4;
  const isLandscape = options?.orientation === 'landscape';
  const pageWidth = isLandscape ? Math.max(baseSize.width, baseSize.height) : Math.min(baseSize.width, baseSize.height);
  const pageHeight = isLandscape ? Math.min(baseSize.width, baseSize.height) : Math.max(baseSize.width, baseSize.height);

  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const bodySize = 10.5;
  const bodyLineHeight = 15;

  const rawParagraphs = rawText.split(/\r?\n\r?\n/).filter((p: string) => p.trim().length > 0);
  const paragraphs = rawParagraphs.length > 0 ? rawParagraphs : ['Document contains no readable text content.'];

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;
  let pageNumber = 1;

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const para = paragraphs[pIdx].trim();
    const isHeading = (para.length < 80 && !para.endsWith('.')) || pIdx === 0;
    const currentFont = isHeading ? boldFont : font;
    const currentSize = isHeading ? (pIdx === 0 ? 16 : 13) : bodySize;
    const lineHeight = isHeading ? 22 : bodyLineHeight;

    const words = para.split(/\s+/);
    let line = '';
    const lines: string[] = [];

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (currentFont.widthOfTextAtSize(candidate, currentSize) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);

    for (const l of lines) {
      if (currentY - lineHeight < margin + 25) {
        currentPage.drawText(`${pageNumber}`, {
          x: pageWidth / 2,
          y: margin / 2,
          size: 9,
          font,
          color: rgb(0.5, 0.5, 0.55),
        });

        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        pageNumber++;
        currentY = pageHeight - margin;
      }

      currentPage.drawText(l, {
        x: margin,
        y: currentY,
        size: currentSize,
        font: currentFont,
        color: isHeading ? rgb(0, 0.16, 0.56) : rgb(0.12, 0.14, 0.18),
      });

      currentY -= lineHeight;
    }

    currentY -= isHeading ? 8 : 6;
  }

  currentPage.drawText(`${pageNumber}`, {
    x: pageWidth / 2,
    y: margin / 2,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.55),
  });

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Convert PowerPoint presentation slides (.pptx) into 16:9 PDF slides
 */
export async function powerPointToPdf(fileBuffer: ArrayBuffer): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 16:9 widescreen presentation dimensions: 960 x 540 pt
  const slideWidth = 960;
  const slideHeight = 540;

  const slideFileNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10);
      const numB = parseInt(b.match(/\d+/)![0], 10);
      return numA - numB;
    });

  const totalSlides = Math.max(1, slideFileNames.length);

  if (slideFileNames.length === 0) {
    const page = pdfDoc.addPage([slideWidth, slideHeight]);
    page.drawText('Presentation contained no standard XML slide definitions.', {
      x: 60,
      y: slideHeight / 2,
      size: 16,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    return await pdfDoc.save({ useObjectStreams: true });
  }

  for (let idx = 0; idx < slideFileNames.length; idx++) {
    const slideFileName = slideFileNames[idx];
    const xmlContent = await zip.file(slideFileName)!.async('text');

    const textMatches = Array.from(xmlContent.matchAll(/<a:t>([^<]+)<\/a:t>/g))
      .map((m) => m[1].trim())
      .filter(Boolean);

    const page = pdfDoc.addPage([slideWidth, slideHeight]);

    // Slide background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: slideWidth,
      height: slideHeight,
      color: rgb(0.97, 0.98, 1.0),
    });

    // Top primary accent bar
    page.drawRectangle({
      x: 0,
      y: slideHeight - 8,
      width: slideWidth,
      height: 8,
      color: rgb(0, 0.16, 0.56),
    });

    let currentY = slideHeight - 65;
    const titleText = textMatches[0] || `Slide ${idx + 1}`;

    page.drawText(titleText, {
      x: 60,
      y: currentY,
      size: 24,
      font: boldFont,
      color: rgb(0, 0.16, 0.56),
    });

    page.drawLine({
      start: { x: 60, y: currentY - 14 },
      end: { x: slideWidth - 60, y: currentY - 14 },
      thickness: 1,
      color: rgb(0.85, 0.88, 0.94),
    });

    currentY -= 45;

    const bodyItems = textMatches.slice(1);
    for (let bIdx = 0; bIdx < Math.min(bodyItems.length, 10); bIdx++) {
      const item = bodyItems[bIdx];
      if (!item) continue;

      page.drawText('•', {
        x: 64,
        y: currentY,
        size: 15,
        font: boldFont,
        color: rgb(0.0, 0.45, 0.85),
      });

      let line = '';
      const words = item.split(' ');
      for (const w of words) {
        const candidate = line ? `${line} ${w}` : w;
        if (font.widthOfTextAtSize(candidate, 14) < slideWidth - 160) {
          line = candidate;
        } else {
          page.drawText(line, {
            x: 85,
            y: currentY,
            size: 14,
            font,
            color: rgb(0.18, 0.2, 0.25),
          });
          currentY -= 20;
          line = w;
        }
      }
      if (line) {
        page.drawText(line, {
          x: 85,
          y: currentY,
          size: 14,
          font,
          color: rgb(0.18, 0.2, 0.25),
        });
        currentY -= 24;
      }
    }

    page.drawText(`Slide ${idx + 1} of ${totalSlides}`, {
      x: slideWidth - 140,
      y: 25,
      size: 10,
      font,
      color: rgb(0.5, 0.55, 0.6),
    });
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

/**
 * Convert PDF layout and text blocks into an editable Microsoft Word (.docx) file
 */
export async function pdfToWord(
  pdfBuffer: ArrayBuffer,
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const docChildren: any[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<any>;

    const lineMap = new Map<number, any[]>();
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item);
    }

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
      const lineStr = lineItems.map((it) => it.str).join(' ').trim();
      if (!lineStr) continue;

      const maxFontSize = Math.max(...lineItems.map((it) => Math.round(it.transform[0] || it.height || 11)));
      const isHeading = maxFontSize >= 14;

      docChildren.push(
        new DocxParagraph({
          text: lineStr,
          heading: isHeading
            ? maxFontSize >= 18
              ? DocxHeadingLevel.HEADING_1
              : DocxHeadingLevel.HEADING_2
            : undefined,
          spacing: { after: isHeading ? 180 : 120, line: 276 },
        })
      );
    }

    if (i < numPages) {
      docChildren.push(
        new DocxParagraph({
          children: [new DocxTextRun({ text: '', break: 1 })],
          pageBreakBefore: true,
        })
      );
    }

    if (onProgress) onProgress(i, numPages);
  }

  const doc = new DocxDocument({
    sections: [
      {
        properties: {},
        children: docChildren.length > 0 ? docChildren : [new DocxParagraph({ text: 'No text extracted from PDF.' })],
      },
    ],
  });

  return await DocxPacker.toBlob(doc);
}

/**
 * Convert PDF pages to a semantic, responsive HTML5 document
 */
export async function pdfToHtml(
  pdfBuffer: ArrayBuffer,
  docTitle = 'PDF Document',
  onProgress?: (current: number, total: number) => void
): Promise<{ html: string; blob: Blob }> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  const pagesHtml: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<any>;

    const lineMap = new Map<number, any[]>();
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item);
    }

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    let pageLinesHtml = '';

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!.sort((a, b) => a.transform[4] - b.transform[4]);
      const lineStr = lineItems.map((it) => escapeHtml(it.str)).join(' ').trim();
      if (!lineStr) continue;

      const maxFontSize = Math.max(...lineItems.map((it) => Math.round(it.transform[0] || it.height || 11)));
      if (maxFontSize >= 18) {
        pageLinesHtml += `        <h1 class="pdf-h1">${lineStr}</h1>\n`;
      } else if (maxFontSize >= 14) {
        pageLinesHtml += `        <h2 class="pdf-h2">${lineStr}</h2>\n`;
      } else {
        pageLinesHtml += `        <p class="pdf-p">${lineStr}</p>\n`;
      }
    }

    pagesHtml.push(`
      <article class="pdf-sheet" id="page-${i}">
        <header class="sheet-header">
          <span class="sheet-badge">Page ${i} of ${numPages}</span>
        </header>
        <div class="sheet-content">
${pageLinesHtml || '        <p class="empty-notice">(No selectable text on this page)</p>\n'}
        </div>
      </article>`);

    if (onProgress) onProgress(i, numPages);
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(docTitle)}</title>
  <style>
    :root {
      --primary: #00288e;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 820px;
      margin: 0 auto;
    }
    .top-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .doc-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--primary);
    }
    .print-btn {
      background: var(--primary);
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
    }
    .pdf-sheet {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 3rem 2.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .sheet-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 1.5rem;
    }
    .sheet-badge {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      background: #f1f5f9;
      color: var(--muted);
      padding: 0.25rem 0.65rem;
      border-radius: 9999px;
    }
    .pdf-h1 {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--primary);
      margin: 1.25rem 0 0.5rem;
    }
    .pdf-h2 {
      font-size: 1.15rem;
      font-weight: 700;
      color: #1e293b;
      margin: 1rem 0 0.4rem;
    }
    .pdf-p {
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
      color: #334155;
    }
    .empty-notice {
      color: var(--muted);
      font-style: italic;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .top-toolbar { display: none; }
      .pdf-sheet { box-shadow: none; border: none; margin: 0; page-break-after: always; padding: 2cm; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="top-toolbar">
      <div class="doc-title">${escapeHtml(docTitle)}</div>
      <button class="print-btn" onclick="window.print()">Print / Export</button>
    </div>
    <main>
${pagesHtml.join('\n')}
    </main>
  </div>
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  return { html: fullHtml, blob };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Protect a PDF document with User and Owner passwords
 */
export async function protectPdf(
  pdfBuffer: ArrayBuffer,
  options: ProtectPdfOptions
): Promise<Uint8Array> {
  const response = await fetch(getApiUrl('/api/pdf/protect'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'x-user-password': options.userPassword,
      'x-owner-password': options.ownerPassword || options.userPassword,
      'x-allow-printing': options.allowPrinting ? 'true' : 'false',
      'x-allow-copying': options.allowCopying ? 'true' : 'false',
    },
    body: pdfBuffer,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Failed to encrypt PDF document.');
  }

  const arrayBuf = await response.arrayBuffer();
  return new Uint8Array(arrayBuf);
}

/**
 * Unlock a password-protected PDF document
 */
export async function unlockPdf(
  pdfBuffer: ArrayBuffer,
  options: UnlockPdfOptions
): Promise<Uint8Array> {
  const response = await fetch(getApiUrl('/api/pdf/unlock'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
      'x-pdf-password': options.password,
    },
    body: pdfBuffer,
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.error || 'Incorrect password or unable to unlock PDF document.');
  }

  const arrayBuf = await response.arrayBuffer();
  return new Uint8Array(arrayBuf);
}

