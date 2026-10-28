import React, { useState, useEffect } from 'react';
import {
  FileText,
  Image as ImageIcon,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCw,
  Trash2,
  Plus,
  Sliders,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Lock,
  ArrowLeft,
  Share2,
  Clock,
  Sparkles,
  Layers,
  Split,
  Eye,
  FileCheck,
  ArrowUp,
  ArrowDown,
  GripVertical,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn
} from 'lucide-react';
import { ToolDef, CompressSettings, CompressResult, CompressionPreset, PageNumberOptions, WatermarkOptions } from '../types';
import { Dropzone } from '../components/Dropzone';
import { formatBytes, downloadFile, downloadZip, createZipBlob } from '../utils/download';
import { useSettings } from '../context/SettingsContext';
import { useBatchQueue } from '../context/BatchQueueContext';
import {
  imagesToPdf,
  renderPdfPagesToImages,
  extractTextFromPdf,
  mergePdfs,
  getPdfPageCount,
  splitPdf,
  extractPagesFromPdf,
  removePagesFromPdf,
  rotatePdfPages,
  reorderPdfPages,
  compressPdf,
  addPageNumbers,
  addWatermark,
  txtToPdf,
  toPdfBlob,
  excelToPdf,
  wordToPdf,
  powerPointToPdf,
  pdfToWord,
  pdfToHtml,
  protectPdf,
  unlockPdf
} from '../services/pdfService';
import { recognizeImage, recognizeScannedPdf } from '../services/ocrService';

interface ToolStudioPageProps {
  tool: ToolDef;
  initialFiles?: File[];
  onNavigate: (path: string) => void;
}

interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  rotation: number;
  width?: number;
  height?: number;
}

interface PagePreviewItem {
  pageNumber: number;
  dataUrl: string;
  selected: boolean;
  rotation: number;
}

interface MergePdfItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

export const ToolStudioPage: React.FC<ToolStudioPageProps> = ({
  tool,
  initialFiles = [],
  onNavigate,
}) => {
  const { settings } = useSettings();
  const { addItem: addQueueItem } = useBatchQueue();

  // File states
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [officeFile, setOfficeFile] = useState<File | null>(null);
  const [mergePdfList, setMergePdfList] = useState<MergePdfItem[]>([]);
  const [mergeOutputName, setMergeOutputName] = useState<string>('merged_document.pdf');
  const [insertBlankPageForDuplex, setInsertBlankPageForDuplex] = useState<boolean>(false);
  const [txtContent, setTxtContent] = useState<string>('');
  const [pdfPagePreviews, setPdfPagePreviews] = useState<PagePreviewItem[]>([]);
  const [draggedPageIndex, setDraggedPageIndex] = useState<number | null>(null);

  // Processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result states
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>('');
  const [resultSize, setResultSize] = useState<number>(0);
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [reductionPercent, setReductionPercent] = useState<number>(0);
  const [extractedTextResult, setExtractedTextResult] = useState<string>('');
  const [htmlResult, setHtmlResult] = useState<string>('');
  const [renderedImagesResult, setRenderedImagesResult] = useState<
    { pageNumber: number; blob: Blob; dataUrl: string }[]
  >([]);
  const [copySuccess, setCopySuccess] = useState(false);

  // Tool Specific Configuration States
  const [renderDpi, setRenderDpi] = useState<number>(settings.defaultDpi || 150);
  const [pageRangeInput, setPageRangeInput] = useState<string>('');
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState<boolean>(false);
  const [thumbnailProgress, setThumbnailProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [inspectingPagePreview, setInspectingPagePreview] = useState<PagePreviewItem | null>(null);
  const [pageSearchFilter, setPageSearchFilter] = useState<string>('');

  const [pageSize, setPageSize] = useState<'A4' | 'US-Letter' | 'Fit' | 'A3'>(
    settings.defaultPageSize
  );
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState<'none' | 'small' | 'big'>('small');
  const [mergeAllImages, setMergeAllImages] = useState(true);

  // Split options
  const [splitMode, setSplitMode] = useState<'all-pages' | 'custom-ranges'>('custom-ranges');
  const [splitRanges, setSplitRanges] = useState('1-3');

  // Compress options
  const [compressSettings, setCompressSettings] = useState<CompressSettings>({
    preset: tool.id === 'custom-pdf-compression' ? 'custom' : 'recommended',
    targetReductionPercent: 45,
    targetSizeValue: 250,
    targetSizeUnit: 'KB',
    quality: 0.75,
    dpi: settings.defaultDpi || 150,
    colorMode: 'full',
    protectVectors: true,
  });
  const [compressionResultInfo, setCompressionResultInfo] = useState<CompressResult | null>(null);

  // OCR options
  const [ocrLanguage, setOcrLanguage] = useState('eng');

  // Security options (Protect / Unlock)
  const [protectPassword, setProtectPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Page Numbers options
  const [pageNumberOptions, setPageNumberOptions] = useState<PageNumberOptions>({
    position: 'bottom-center',
    format: 'page-x-of-y',
    fontSize: 10,
    startNumber: 1,
  });

  // Watermark options
  const [watermarkOptions, setWatermarkOptions] = useState<WatermarkOptions>({
    text: 'CONFIDENTIAL',
    fontSize: 48,
    opacity: 0.25,
    color: '#000000',
    rotation: 45,
  });

  // Load initial files if provided
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      handleFilesSelected(initialFiles);
    }
  }, [tool.id]);

  const handleFilesSelected = async (files: File[]) => {
    setErrorMessage(null);
    setResultBlob(null);

    // If tool accepts images
    if (
      tool.id === 'jpg-to-pdf' ||
      tool.id === 'png-to-pdf' ||
      tool.id === 'images-to-pdf' ||
      tool.id === 'ocr-images'
    ) {
      const newItems: ImageItem[] = [];
      for (const file of files) {
        const previewUrl = URL.createObjectURL(file);
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          file,
          name: file.name,
          size: file.size,
          previewUrl,
          rotation: 0,
        });
      }
      setImages((prev) => (tool.multiFile ? [...prev, ...newItems] : newItems));
    } else if (
      tool.id === 'excel-to-pdf' ||
      tool.id === 'word-to-pdf' ||
      tool.id === 'powerpoint-to-pdf'
    ) {
      const file = files[0];
      setOfficeFile(file);
      setOriginalSize(file.size);
    } else if (tool.id === 'txt-to-pdf') {
      const file = files[0];
      const text = await file.text();
      setTxtContent(text);
      setOriginalSize(file.size);
    } else if (tool.id === 'merge-pdf') {
      const newPdfItems: MergePdfItem[] = [];
      for (const file of files) {
        if (fileIsPdf(file)) {
          let pageCount = 1;
          try {
            const buf = await file.arrayBuffer();
            pageCount = await getPdfPageCount(buf);
          } catch {
            pageCount = 1;
          }
          newPdfItems.push({
            id: Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            size: file.size,
            pageCount,
          });
        }
      }
      if (newPdfItems.length === 0) {
        setErrorMessage('Please select valid PDF documents (.pdf) to merge.');
        return;
      }
      setMergePdfList((prev) => [...prev, ...newPdfItems]);
    } else if (fileIsPdf(files[0])) {
      const file = files[0];
      setPdfFile(file);
      setOriginalSize(file.size);

      // Generate page thumbnails for visual selection tools
      if (
        tool.id === 'extract-pdf-pages' ||
        tool.id === 'remove-pdf-pages' ||
        tool.id === 'rotate-pdf-pages' ||
        tool.id === 'reorder-pdf-pages' ||
        tool.id === 'pdf-to-jpg' ||
        tool.id === 'pdf-to-png'
      ) {
        try {
          setIsLoadingThumbnails(true);
          setThumbnailProgress({ current: 0, total: 0 });
          const buffer = await file.arrayBuffer();
          const rendered = await renderPdfPagesToImages(
            buffer,
            'jpg',
            72,
            (curr, total) => {
              setThumbnailProgress({ current: curr, total });
            }
          );
          const previews: PagePreviewItem[] = rendered.map((r) => ({
            pageNumber: r.pageNumber,
            dataUrl: r.dataUrl,
            selected: tool.id === 'remove-pdf-pages' ? false : true,
            rotation: 0,
          }));
          setPdfPagePreviews(previews);
          setPageRangeInput(tool.id === 'remove-pdf-pages' ? '' : `1-${previews.length}`);
        } catch (err: any) {
          console.warn('Could not generate full page thumbnails:', err);
          setErrorMessage('Could not render page previews: ' + (err.message || 'Error processing document'));
        } finally {
          setIsLoadingThumbnails(false);
        }
      }
    }
  };

  const fileIsPdf = (file: File) => {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  };

  // Reordering & management controls for Merge PDF
  const handleMoveMergePdf = (index: number, direction: 'up' | 'down') => {
    setMergePdfList((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[target];
      copy[target] = temp;
      return copy;
    });
  };

  const handleRemoveMergePdf = (id: string) => {
    setMergePdfList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearMergePdfs = () => {
    setMergePdfList([]);
  };

  // Sorting & sequence controls for Merge PDF
  const handleSortMergeAlphabetical = (ascending = true) => {
    setMergePdfList((prev) => {
      return [...prev].sort((a, b) =>
        ascending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      );
    });
  };

  const handleReverseMergeOrder = () => {
    setMergePdfList((prev) => [...prev].reverse());
  };

  // Reordering controls for Reorder PDF Pages
  const handleMovePagePreview = (index: number, direction: 'prev' | 'next') => {
    setPdfPagePreviews((prev) => {
      const targetIndex = direction === 'prev' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const copy = [...prev];
      const item = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = item;
      return copy;
    });
  };

  const handleResetPageOrder = () => {
    setPdfPagePreviews((prev) => [...prev].sort((a, b) => a.pageNumber - b.pageNumber));
  };

  const handleReversePageOrder = () => {
    setPdfPagePreviews((prev) => [...prev].reverse());
  };

  const isPageOrderModified = React.useMemo(() => {
    return pdfPagePreviews.some((p, idx) => p.pageNumber !== idx + 1);
  }, [pdfPagePreviews]);

  // Cumulative page ranges for each PDF in the merge list
  const mergeRanges = React.useMemo(() => {
    let currentStart = 1;
    return mergePdfList.map((item) => {
      const start = currentStart;
      const pages = Math.max(1, item.pageCount || 1);
      const end = currentStart + pages - 1;
      currentStart = end + 1;
      return { start, end };
    });
  }, [mergePdfList]);

  const totalMergePages = React.useMemo(() => {
    return mergePdfList.reduce((sum, item) => sum + (item.pageCount || 1), 0);
  }, [mergePdfList]);

  const totalMergeBytes = React.useMemo(() => {
    return mergePdfList.reduce((sum, item) => sum + item.size, 0);
  }, [mergePdfList]);

  // Selected pages calculation for PDF to JPG / PNG
  const selectedPageNumbers = React.useMemo(() => {
    return pdfPagePreviews.filter((p) => p.selected).map((p) => p.pageNumber);
  }, [pdfPagePreviews]);

  // Helper to parse page range string like "1-3, 5, 7" into array of page numbers
  const parsePageRangeString = (rangeStr: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const parts = rangeStr.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(maxPages, Math.max(start, end));
          for (let p = min; p <= max; p++) {
            pages.add(p);
          }
        }
      } else {
        const single = parseInt(part, 10);
        if (!isNaN(single) && single >= 1 && single <= maxPages) {
          pages.add(single);
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  // Helper to format array of page numbers into compact range string like "1-3, 5"
  const formatPageRangeString = (nums: number[]): string => {
    if (nums.length === 0) return '';
    const sorted = [...nums].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = sorted[i];
        prev = sorted[i];
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(', ');
  };

  // Sync pageRangeInput when user types custom sequence
  const handleRangeInputChange = (val: string) => {
    setPageRangeInput(val);
    if (pdfPagePreviews.length === 0) return;
    const targetPages = parsePageRangeString(val, pdfPagePreviews.length);
    const targetSet = new Set(targetPages);
    setPdfPagePreviews((prev) =>
      prev.map((p) => ({ ...p, selected: targetSet.has(p.pageNumber) }))
    );
  };

  // Toggle single page preview and sync range input
  const handleTogglePagePreview = (pageNum: number) => {
    setPdfPagePreviews((prev) => {
      const updated = prev.map((item) =>
        item.pageNumber === pageNum ? { ...item, selected: !item.selected } : item
      );
      const selectedNums = updated.filter((x) => x.selected).map((x) => x.pageNumber);
      setPageRangeInput(formatPageRangeString(selectedNums));
      return updated;
    });
  };

  // Selection preset helpers
  const handleSelectAllPages = () => {
    setPdfPagePreviews((prev) => {
      const updated = prev.map((p) => ({ ...p, selected: true }));
      setPageRangeInput(`1-${prev.length}`);
      return updated;
    });
  };

  const handleDeselectAllPages = () => {
    setPdfPagePreviews((prev) => {
      const updated = prev.map((p) => ({ ...p, selected: false }));
      setPageRangeInput('');
      return updated;
    });
  };

  const handleSelectOddPages = () => {
    setPdfPagePreviews((prev) => {
      const updated = prev.map((p) => ({ ...p, selected: p.pageNumber % 2 !== 0 }));
      const selectedNums = updated.filter((x) => x.selected).map((x) => x.pageNumber);
      setPageRangeInput(formatPageRangeString(selectedNums));
      return updated;
    });
  };

  const handleSelectEvenPages = () => {
    setPdfPagePreviews((prev) => {
      const updated = prev.map((p) => ({ ...p, selected: p.pageNumber % 2 === 0 }));
      const selectedNums = updated.filter((x) => x.selected).map((x) => x.pageNumber);
      setPageRangeInput(formatPageRangeString(selectedNums));
      return updated;
    });
  };

  const handleInvertSelection = () => {
    setPdfPagePreviews((prev) => {
      const updated = prev.map((p) => ({ ...p, selected: !p.selected }));
      const selectedNums = updated.filter((x) => x.selected).map((x) => x.pageNumber);
      setPageRangeInput(formatPageRangeString(selectedNums));
      return updated;
    });
  };

  // Rotation controls for images
  const handleRotateImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img))
    );
  };

  const handleRotateAllImages = () => {
    setImages((prev) => prev.map((img) => ({ ...img, rotation: (img.rotation + 90) % 360 })));
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      const target = prev.find((img) => img.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return filtered;
    });
  };

  const handleClearImages = () => {
    images.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setImages([]);
  };

  // Keyboard navigation for inspection modal
  useEffect(() => {
    if (!inspectingPagePreview) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectingPagePreview(null);
      } else if (e.key === 'ArrowLeft') {
        const idx = pdfPagePreviews.findIndex((p) => p.pageNumber === inspectingPagePreview.pageNumber);
        if (idx > 0) {
          setInspectingPagePreview(pdfPagePreviews[idx - 1]);
        }
      } else if (e.key === 'ArrowRight') {
        const idx = pdfPagePreviews.findIndex((p) => p.pageNumber === inspectingPagePreview.pageNumber);
        if (idx < pdfPagePreviews.length - 1) {
          setInspectingPagePreview(pdfPagePreviews[idx + 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingPagePreview, pdfPagePreviews]);

  // Primary Execution Handler
  const handleExecuteOperation = async () => {
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressMessage('Initializing document processor...');
    setErrorMessage(null);
    setResultBlob(null);

    const startTime = performance.now();

    try {
      // 1. Image to PDF conversions
      if (
        tool.id === 'jpg-to-pdf' ||
        tool.id === 'png-to-pdf' ||
        tool.id === 'images-to-pdf'
      ) {
        if (images.length === 0) {
          throw new Error('Please select at least one image file.');
        }

        setProgressPercent(40);
        setProgressMessage('Composing pages and layout geometry...');

        const pdfBytes = await imagesToPdf(
          images.map((img) => ({ file: img.file, rotation: img.rotation })),
          { pageSize, orientation, margin }
        );

        setProgressPercent(90);
        setProgressMessage('Finalizing PDF package...');

        const blob = toPdfBlob(pdfBytes);
        const name = `${images[0].name.replace(/\.[^/.]+$/, '')}_converted.pdf`;

        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);

        const totalInput = images.reduce((sum, img) => sum + img.size, 0);
        setOriginalSize(totalInput);
        setReductionPercent(
          Math.max(0, Number((((totalInput - blob.size) / totalInput) * 100).toFixed(1)))
        );

        // Add to batch history
        addQueueItem({
          toolId: tool.id,
          toolName: tool.name,
          file: images[0].file,
          status: 'completed',
          progress: 100,
          outputBlob: blob,
          outputName: name,
          outputSize: blob.size,
        });
      }

      // 2. Plain Text to PDF
      else if (tool.id === 'txt-to-pdf') {
        if (!txtContent.trim()) {
          throw new Error('Text document contains no content to convert.');
        }
        setProgressPercent(50);
        setProgressMessage('Typesetting text streams and margins...');

        const pdfBytes = await txtToPdf(txtContent, {
          title: 'Document Transcript',
          pageSize: pageSize === 'US-Letter' ? 'US-Letter' : 'A4',
        });

        const blob = toPdfBlob(pdfBytes);
        const name = 'text_document.pdf';
        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);
      }

      // 3. PDF to JPG / PNG
      else if (tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') {
        if (!pdfFile) throw new Error('Please upload a PDF document.');
        const format = tool.id === 'pdf-to-jpg' ? 'jpg' : 'png';
        const buffer = await pdfFile.arrayBuffer();

        // Determine which pages are selected by the user in the thumbnail selector
        const selectedPages = pdfPagePreviews
          .filter((p) => p.selected)
          .map((p) => p.pageNumber);

        // If specific pages are selected, render only those; otherwise render all
        const pagesToRender = selectedPages.length > 0 ? selectedPages : undefined;

        setProgressPercent(20);
        setProgressMessage(
          `Converting ${pagesToRender ? `${pagesToRender.length} selected page(s)` : 'all pages'} to high-resolution ${format.toUpperCase()}...`
        );

        const rendered = await renderPdfPagesToImages(
          buffer,
          format,
          renderDpi || settings.defaultDpi || 150,
          (curr, total) => {
            setProgressPercent(20 + Math.round((curr / total) * 75));
            setProgressMessage(`Rendering ${format.toUpperCase()} page ${curr} of ${total}...`);
          },
          pagesToRender
        );

        if (rendered.length === 0) {
          throw new Error('No pages were rendered. Please select at least one page to convert.');
        }

        setRenderedImagesResult(rendered);
        const cleanBaseName = pdfFile.name.replace(/\.pdf$/i, '');

        if (rendered.length === 1) {
          // Exactly 1 page -> directly output the single JPG / PNG image!
          const single = rendered[0];
          setResultBlob(single.blob);
          const singleName = `${cleanBaseName}_page_${single.pageNumber}.${format}`;
          setResultFileName(singleName);
          setResultSize(single.blob.size);
        } else {
          // Multiple pages -> generate a valid ZIP archive containing all images
          const zipFiles = rendered.map((r) => ({
            name: `${cleanBaseName}_page_${r.pageNumber}.${format}`,
            data: r.blob,
          }));
          const zipBlob = await createZipBlob(zipFiles);
          const zipName = `${cleanBaseName}_${format}_images.zip`;
          setResultBlob(zipBlob);
          setResultFileName(zipName);
          setResultSize(zipBlob.size);
        }
      }

      // 4. Extract Text from PDF
      else if (tool.id === 'extract-text' || tool.id === 'pdf-to-txt') {
        if (!pdfFile) throw new Error('Please upload a PDF document.');
        const buffer = await pdfFile.arrayBuffer();
        setProgressPercent(40);
        setProgressMessage('Extracting font unicode mappings and text elements...');

        const result = await extractTextFromPdf(buffer, (curr, total) => {
          setProgressPercent(40 + Math.round((curr / total) * 50));
        });

        if (!result.fullText) {
          throw new Error(
            'No selectable text layer found. This file appears to be a scanned document. Try running "OCR for Scanned PDFs".'
          );
        }

        setExtractedTextResult(result.fullText);
        const textBlob = new Blob([result.fullText], { type: 'text/plain;charset=utf-8' });
        setResultBlob(textBlob);
        setResultFileName(`${pdfFile.name.replace(/\.pdf$/i, '')}_extracted.txt`);
        setResultSize(textBlob.size);
      }

      // 5. OCR for Images
      else if (tool.id === 'ocr-images') {
        if (images.length === 0) throw new Error('Please select an image file to run OCR.');
        setProgressPercent(30);
        setProgressMessage('Booting Tesseract neural engine worker...');

        const ocrRes = await recognizeImage(images[0].file, ocrLanguage, (p, status) => {
          setProgressPercent(30 + Math.round(p * 0.65));
          setProgressMessage(`${status} (${p}%)...`);
        });

        setExtractedTextResult(ocrRes.text || '(No text detected in this image)');
        const textBlob = new Blob([ocrRes.text], { type: 'text/plain;charset=utf-8' });
        setResultBlob(textBlob);
        setResultFileName(`${images[0].name.replace(/\.[^/.]+$/, '')}_ocr.txt`);
        setResultSize(textBlob.size);
      }

      // 6. OCR for Scanned PDFs
      else if (tool.id === 'ocr-scanned-pdf') {
        if (!pdfFile) throw new Error('Please upload a scanned PDF.');
        const buffer = await pdfFile.arrayBuffer();
        setProgressPercent(20);
        setProgressMessage('Rasterizing scanned document and loading OCR model...');

        const ocrRes = await recognizeScannedPdf(buffer, ocrLanguage, (percent, page, total) => {
          setProgressPercent(percent);
          setProgressMessage(
            page > 0
              ? `Optical recognition page ${page} of ${total} (${percent}%)...`
              : 'Processing...'
          );
        });

        setExtractedTextResult(ocrRes.fullText || '(No text detected)');
        const textBlob = new Blob([ocrRes.fullText], { type: 'text/plain;charset=utf-8' });
        setResultBlob(textBlob);
        setResultFileName(`${pdfFile.name.replace(/\.pdf$/i, '')}_scanned_ocr.txt`);
        setResultSize(textBlob.size);
      }

      // 7. Compress PDF (Standard & Custom)
      else if (tool.id === 'compress-pdf' || tool.id === 'custom-pdf-compression') {
        if (!pdfFile) throw new Error('Please upload a PDF document.');
        const buffer = await pdfFile.arrayBuffer();

        const compressRes = await compressPdf(buffer, compressSettings, (p, msg) => {
          setProgressPercent(p);
          setProgressMessage(msg);
        });

        setCompressionResultInfo(compressRes);

        const blob = toPdfBlob(compressRes.data);
        setResultBlob(blob);
        const nameSuffix = compressRes.isAlreadyOptimized ? '_verified.pdf' : '_compressed.pdf';
        const finalName = `${pdfFile.name.replace(/\.pdf$/i, '')}${nameSuffix}`;
        setResultFileName(finalName);
        setResultSize(compressRes.newSize);
        setOriginalSize(compressRes.originalSize);
        setReductionPercent(compressRes.reductionPercent);

        if (!compressRes.isAlreadyOptimized) {
          addQueueItem({
            toolId: tool.id,
            toolName: tool.name,
            file: pdfFile,
            status: 'completed',
            progress: 100,
            outputBlob: blob,
            outputName: finalName,
            outputSize: compressRes.newSize,
          });
        }
      }

      // 8. Merge PDF
      else if (tool.id === 'merge-pdf') {
        if (mergePdfList.length < 2) {
          throw new Error('Please upload at least 2 PDF documents to combine.');
        }

        setProgressPercent(20);
        setProgressMessage(`Preparing ${mergePdfList.length} PDF documents...`);

        const pdfBuffers: ArrayBuffer[] = [];
        for (let i = 0; i < mergePdfList.length; i++) {
          const item = mergePdfList[i];
          setProgressPercent(20 + Math.round(((i + 1) / mergePdfList.length) * 35));
          setProgressMessage(`Reading "${item.name}" (${i + 1} of ${mergePdfList.length})...`);
          const buf = await item.file.arrayBuffer();
          pdfBuffers.push(buf);
        }

        setProgressPercent(60);
        setProgressMessage('Concatenating pages with pdf-lib...');

        const mergedBytes = await mergePdfs(
          pdfBuffers,
          {
            insertBlankPageBetween: insertBlankPageForDuplex,
            documentNames: mergePdfList.map((item) => item.name),
          },
          (current, total) => {
            setProgressPercent(60 + Math.round((current / total) * 30));
            setProgressMessage(`Merging document ${current} of ${total}...`);
          }
        );

        setProgressPercent(95);
        setProgressMessage('Finalizing merged PDF document...');

        const blob = toPdfBlob(mergedBytes);
        const totalInput = mergePdfList.reduce((sum, item) => sum + item.size, 0);

        const rawName = mergeOutputName.trim() || 'merged_document.pdf';
        const finalName = rawName.toLowerCase().endsWith('.pdf') ? rawName : `${rawName}.pdf`;

        setResultBlob(blob);
        setResultFileName(finalName);
        setResultSize(blob.size);
        setOriginalSize(totalInput);
        setReductionPercent(
          Math.max(0, Number((((totalInput - blob.size) / totalInput) * 100).toFixed(1)))
        );

        addQueueItem({
          toolId: tool.id,
          toolName: tool.name,
          file: mergePdfList[0].file,
          status: 'completed',
          progress: 100,
          outputBlob: blob,
          outputName: finalName,
          outputSize: blob.size,
        });
      }

      // 9. Split PDF
      else if (tool.id === 'split-pdf') {
        if (!pdfFile) throw new Error('Please upload a PDF file to split.');
        const buffer = await pdfFile.arrayBuffer();

        setProgressPercent(50);
        setProgressMessage('Extracting target page splits...');

        const splits = await splitPdf(buffer, splitMode, splitRanges);

        if (splits.length === 1) {
          const blob = toPdfBlob(splits[0].data);
          setResultBlob(blob);
          setResultFileName(splits[0].name);
          setResultSize(blob.size);
        } else {
          // Bundle into ZIP
          const zipFiles = splits.map((s) => ({
            name: s.name,
            data: s.data,
          }));
          const zipName = `${pdfFile.name.replace(/\.pdf$/i, '')}_split_pages.zip`;
          setResultFileName(zipName);
          setResultSize(splits.reduce((sum, s) => sum + s.data.byteLength, 0));
          // Store first blob or zip
          const zipBlob = await new Promise<Blob>((resolve) => {
            downloadZip(zipFiles, zipName);
            // also make a representative blob
            resolve(toPdfBlob(splits[0].data));
          });
          setResultBlob(zipBlob);
        }
      }

      // 10. Extract / Remove Pages
      else if (tool.id === 'extract-pdf-pages') {
        if (!pdfFile) throw new Error('Please upload a PDF file.');
        const selected = pdfPagePreviews.filter((p) => p.selected).map((p) => p.pageNumber);
        if (selected.length === 0) {
          throw new Error('Please select at least one page to extract.');
        }
        const buffer = await pdfFile.arrayBuffer();
        const extractedBytes = await extractPagesFromPdf(buffer, selected);
        const blob = toPdfBlob(extractedBytes);
        setResultBlob(blob);
        setResultFileName(`${pdfFile.name.replace(/\.pdf$/i, '')}_extracted.pdf`);
        setResultSize(blob.size);
      } else if (tool.id === 'remove-pdf-pages') {
        if (!pdfFile) throw new Error('Please upload a PDF file.');
        const toRemove = pdfPagePreviews.filter((p) => p.selected).map((p) => p.pageNumber);
        if (toRemove.length === 0) {
          throw new Error('Please select at least one page to remove.');
        }
        const buffer = await pdfFile.arrayBuffer();
        const remainingBytes = await removePagesFromPdf(buffer, toRemove);
        const blob = toPdfBlob(remainingBytes);
        setResultBlob(blob);
        setResultFileName(`${pdfFile.name.replace(/\.pdf$/i, '')}_removed_pages.pdf`);
        setResultSize(blob.size);
      }

      // 11. Rotate Pages
      else if (tool.id === 'rotate-pdf-pages') {
        if (!pdfFile) throw new Error('Please upload a PDF file.');
        const buffer = await pdfFile.arrayBuffer();
        const deltaMap: Record<number, number> = {};
        pdfPagePreviews.forEach((p) => {
          if (p.rotation !== 0) {
            deltaMap[p.pageNumber] = p.rotation;
          }
        });
        const rotatedBytes = await rotatePdfPages(buffer, deltaMap);
        const blob = toPdfBlob(rotatedBytes);
        setResultBlob(blob);
        setResultFileName(`${pdfFile.name.replace(/\.pdf$/i, '')}_rotated.pdf`);
        setResultSize(blob.size);
      }

      // Reorder PDF Pages
      else if (tool.id === 'reorder-pdf-pages') {
        if (!pdfFile) throw new Error('Please upload a PDF document.');
        setProgressPercent(30);
        setProgressMessage('Organizing and re-sequencing document pages...');
        const buffer = await pdfFile.arrayBuffer();
        const currentOrder = pdfPagePreviews.map((p) => p.pageNumber);
        const reorderedBytes = await reorderPdfPages(buffer, currentOrder);
        const blob = toPdfBlob(reorderedBytes);
        const name = `${pdfFile.name.replace(/\.pdf$/i, '')}_reordered.pdf`;
        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);
        setOriginalSize(pdfFile.size);
      }

      // 12. Add Page Numbers
      else if (tool.id === 'add-page-numbers') {
        if (!pdfFile) throw new Error('Please upload a PDF file.');
        const buffer = await pdfFile.arrayBuffer();
        const numberedBytes = await addPageNumbers(buffer, pageNumberOptions);
        const blob = toPdfBlob(numberedBytes);
        setResultBlob(blob);
        setResultFileName(`${pdfFile.name.replace(/\.pdf$/i, '')}_numbered.pdf`);
        setResultSize(blob.size);
      }

      // 13. Add Watermark
      else if (tool.id === 'add-watermark') {
        if (!pdfFile) throw new Error('Please upload a PDF file.');
        const buffer = await pdfFile.arrayBuffer();
        const watermarkBytes = await addWatermark(buffer, watermarkOptions);
        const blob = toPdfBlob(watermarkBytes);
        setResultBlob(blob);
        setResultFileName(`${pdfFile.name.replace(/\.pdf$/i, '')}_watermarked.pdf`);
        setResultSize(blob.size);
      }

      // 14. Excel to PDF
      else if (tool.id === 'excel-to-pdf') {
        if (!officeFile) throw new Error('Please upload an Excel workbook (.xlsx, .xls, .csv).');
        setProgressPercent(25);
        setProgressMessage('Reading worksheets and calculating column geometries...');
        const buffer = await officeFile.arrayBuffer();
        const pdfBytes = await excelToPdf(buffer, officeFile.name, { pageSize, orientation });
        const blob = toPdfBlob(pdfBytes);
        const name = `${officeFile.name.replace(/\.[^/.]+$/, '')}_spreadsheet.pdf`;
        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);
        setOriginalSize(officeFile.size);
      }

      // 15. Word to PDF
      else if (tool.id === 'word-to-pdf') {
        if (!officeFile) throw new Error('Please upload a Microsoft Word document (.docx).');
        setProgressPercent(25);
        setProgressMessage('Parsing Word document layout and typography...');
        const buffer = await officeFile.arrayBuffer();
        const pdfBytes = await wordToPdf(buffer, { pageSize, orientation });
        const blob = toPdfBlob(pdfBytes);
        const name = `${officeFile.name.replace(/\.[^/.]+$/, '')}_document.pdf`;
        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);
        setOriginalSize(officeFile.size);
      }

      // 16. PowerPoint to PDF
      else if (tool.id === 'powerpoint-to-pdf') {
        if (!officeFile) throw new Error('Please upload a PowerPoint presentation (.pptx).');
        setProgressPercent(25);
        setProgressMessage('Extracting presentation slides and geometries...');
        const buffer = await officeFile.arrayBuffer();
        const pdfBytes = await powerPointToPdf(buffer);
        const blob = toPdfBlob(pdfBytes);
        const name = `${officeFile.name.replace(/\.[^/.]+$/, '')}_presentation.pdf`;
        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);
        setOriginalSize(officeFile.size);
      }

      // 17. PDF to Word (DOCX)
      else if (tool.id === 'pdf-to-word') {
        if (!pdfFile) throw new Error('Please upload a PDF document.');
        setProgressPercent(20);
        setProgressMessage('Extracting document blocks and generating native DOCX...');
        const buffer = await pdfFile.arrayBuffer();
        const docxBlob = await pdfToWord(buffer, (curr, total) => {
          setProgressPercent(20 + Math.round((curr / total) * 70));
          setProgressMessage(`Converting page ${curr} of ${total} into Word paragraphs...`);
        });
        const name = `${pdfFile.name.replace(/\.pdf$/i, '')}.docx`;
        setResultBlob(docxBlob);
        setResultFileName(name);
        setResultSize(docxBlob.size);
        setOriginalSize(pdfFile.size);
      }

      // 18. PDF to HTML
      else if (tool.id === 'pdf-to-html') {
        if (!pdfFile) throw new Error('Please upload a PDF document.');
        setProgressPercent(20);
        setProgressMessage('Extracting page layers and building semantic HTML5...');
        const buffer = await pdfFile.arrayBuffer();
        const res = await pdfToHtml(buffer, pdfFile.name, (curr, total) => {
          setProgressPercent(20 + Math.round((curr / total) * 70));
          setProgressMessage(`Building HTML structure for page ${curr} of ${total}...`);
        });
        const name = `${pdfFile.name.replace(/\.pdf$/i, '')}.html`;
        setHtmlResult(res.html);
        setResultBlob(res.blob);
        setResultFileName(name);
        setResultSize(res.blob.size);
        setOriginalSize(pdfFile.size);
      }

      // 19. Protect PDF with Password
      else if (tool.id === 'protect-pdf') {
        if (!pdfFile) throw new Error('Please upload a PDF document to encrypt.');
        if (!protectPassword.trim()) {
          throw new Error('Please enter a password to protect the document.');
        }
        if (protectPassword !== confirmPassword) {
          throw new Error('Password and confirmation password do not match.');
        }
        setProgressPercent(35);
        setProgressMessage('Applying 128-bit cryptographic standard encryption...');
        const buffer = await pdfFile.arrayBuffer();
        const protectedBytes = await protectPdf(buffer, {
          userPassword: protectPassword,
          ownerPassword: protectPassword,
          allowPrinting,
          allowCopying,
        });
        const blob = toPdfBlob(protectedBytes);
        const name = `${pdfFile.name.replace(/\.pdf$/i, '')}_protected.pdf`;
        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);
        setOriginalSize(pdfFile.size);
      }

      // 20. Unlock PDF
      else if (tool.id === 'unlock-pdf') {
        if (!pdfFile) throw new Error('Please upload a password-protected PDF document.');
        if (!unlockPassword.trim()) {
          throw new Error('Please enter the document password to unlock.');
        }
        setProgressPercent(35);
        setProgressMessage('Verifying credentials and decrypting document...');
        const buffer = await pdfFile.arrayBuffer();
        const unlockedBytes = await unlockPdf(buffer, { password: unlockPassword });
        const blob = toPdfBlob(unlockedBytes);
        const name = `${pdfFile.name.replace(/\.pdf$/i, '')}_unlocked.pdf`;
        setResultBlob(blob);
        setResultFileName(name);
        setResultSize(blob.size);
        setOriginalSize(pdfFile.size);
      }

      setProgressPercent(100);
      setProgressMessage('Complete!');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred during conversion.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultBlob && renderedImagesResult.length === 0) return;

    if (renderedImagesResult.length > 1 && (tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png')) {
      const format = tool.id === 'pdf-to-jpg' ? 'jpg' : 'png';
      const zipFiles = renderedImagesResult.map((r) => ({
        name: `${pdfFile?.name.replace(/\.pdf$/i, '') || 'page'}_page_${r.pageNumber}.${format}`,
        data: r.blob,
      }));
      downloadZip(zipFiles, resultFileName || 'rendered_pages.zip');
    } else if (resultBlob) {
      downloadFile(resultBlob, resultFileName || 'converted_file.pdf');
    }
  };

  const handleCopyText = () => {
    if (extractedTextResult) {
      navigator.clipboard.writeText(extractedTextResult);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // If tool is coming soon / requires backend engine
  if (tool.status === 'coming-soon') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => onNavigate('/all-tools')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Tools</span>
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8" />
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full mb-2">
            Engine Specification Notice
          </span>

          <h1 className="text-2xl font-bold text-slate-900">{tool.name}</h1>
          <p className="text-sm text-slate-500 mt-2 max-w-lg leading-relaxed">
            {tool.requiresEngineNotice ||
              'This conversion requires a specialized server conversion engine to guarantee document fidelity without corrupting complex styles or layouts.'}
          </p>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => onNavigate('/tool/jpg-to-pdf')}
              className="px-5 py-2.5 rounded-xl bg-[#00288e] text-white text-xs font-semibold hover:bg-blue-800 transition-colors"
            >
              Try JPG to PDF Studio
            </button>
            <button
              onClick={() => onNavigate('/tool/compress-pdf')}
              className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
            >
              Try Compress PDF
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full flex flex-col gap-6">
      {/* Breadcrumb & Navigation */}
      <nav className="flex items-center justify-between text-xs font-medium text-slate-500">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onNavigate('/all-tools')}
            className="hover:text-[#00288e] transition-colors"
          >
            All Tools
          </button>
          <span>/</span>
          <span className="text-slate-400">{tool.categoryLabel}</span>
          <span>/</span>
          <span className="text-[#00288e] font-bold bg-blue-50 px-2.5 py-0.5 rounded-full">
            {tool.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            Client-Side Sandbox
          </span>
          <button
            onClick={() => {
              setImages([]);
              setPdfFile(null);
              setResultBlob(null);
              setPdfPagePreviews([]);
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
            title="Reset Workspace"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            {tool.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{tool.description}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-2xs">
          <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>Client-side pre-processing · Zero server retention</span>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Center Area: Files & Workbench (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Images List for Image-based tools */}
          {(tool.id === 'jpg-to-pdf' ||
            tool.id === 'png-to-pdf' ||
            tool.id === 'images-to-pdf' ||
            tool.id === 'ocr-images') && (
            <div className="flex flex-col gap-4">
              {/* Action Bar */}
              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Uploaded Images</span>
                  <span className="bg-[#00288e] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {images.length} {images.length === 1 ? 'file' : 'files'}
                  </span>
                </div>
                {images.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handleRotateAllImages}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotate All (90°)
                    </button>
                    <button
                      onClick={handleClearImages}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Grid of uploaded images matching Stitch card layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {images.map((item, idx) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs flex flex-col"
                  >
                    {/* Top control bar */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#00288e] text-white flex items-center justify-center font-bold text-[11px]">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-700">Page {idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRotateImage(item.id)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                          title="Rotate 90° clockwise"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRemoveImage(item.id)}
                          className="p-1 hover:bg-red-50 rounded text-red-500 transition-colors"
                          title="Remove image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Image Preview Canvas */}
                    <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden p-3">
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="w-full h-full object-contain transition-transform duration-300"
                        style={{ transform: `rotate(${item.rotation}deg)` }}
                      />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-white/90 text-slate-700 font-bold text-[10px] uppercase shadow-2xs backdrop-blur-xs">
                        {item.name.split('.').pop() || 'IMG'}
                      </span>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-3 bg-white flex items-center justify-between text-xs">
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400">{formatBytes(item.size)}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    </div>
                  </div>
                ))}

                {/* Add More Drop Tile */}
                <Dropzone
                  accept={tool.acceptedFormats.join(',')}
                  multiple={tool.multiFile}
                  onFilesSelected={handleFilesSelected}
                  title={images.length === 0 ? 'Upload Images' : 'Add More Images'}
                  subtitle="Drop pictures here or click to browse"
                  badges={[]}
                  className="min-h-[220px]"
                />
              </div>
            </div>
          )}

          {/* PDF Page Previews Loading State */}
          {pdfFile && isLoadingThumbnails && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-3">
              <Loader2 className="w-8 h-8 text-[#00288e] dark:text-blue-400 animate-spin" />
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Generating Visual Page Previews...
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {thumbnailProgress.total > 0
                    ? `Rendering page ${thumbnailProgress.current} of ${thumbnailProgress.total}...`
                    : 'Parsing PDF document structure...'}
                </p>
              </div>
              {thumbnailProgress.total > 0 && (
                <div className="w-56 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#00288e] dark:bg-blue-500 h-full transition-all duration-200"
                    style={{
                      width: `${Math.round((thumbnailProgress.current / thumbnailProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* PDF Page Previews for organize / reorder / split / extract / pdf-to-jpg tools */}
          {pdfFile && pdfPagePreviews.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 gap-3">
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                    {pdfFile.name}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">· {pdfPagePreviews.length} pages</span>

                  {tool.id === 'reorder-pdf-pages' && isPageOrderModified && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-semibold text-[10px] border border-amber-200 dark:border-amber-800">
                      Order Re-sequenced
                    </span>
                  )}

                  {(tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-xs border ${
                        selectedPageNumbers.length === 0
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-[#00288e] dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
                      }`}
                    >
                      {selectedPageNumbers.length === 0
                        ? '0 selected (None)'
                        : `✓ ${selectedPageNumbers.length} of ${pdfPagePreviews.length} pages selected`}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {tool.id === 'reorder-pdf-pages' && (
                    <>
                      {isPageOrderModified && (
                        <button
                          onClick={handleResetPageOrder}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                          title="Reset pages to original 1..N order"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Reset Order</span>
                        </button>
                      )}
                      <button
                        onClick={handleReversePageOrder}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="Reverse entire page order"
                      >
                        Reverse
                      </button>
                    </>
                  )}

                  {(tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') && (
                    <>
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={handleSelectAllPages}
                          className="px-2 py-0.5 text-xs font-semibold rounded text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                          title="Select all pages"
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={handleDeselectAllPages}
                          className="px-2 py-0.5 text-xs font-semibold rounded text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                          title="Deselect all pages"
                        >
                          None
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectOddPages}
                          className="px-2 py-0.5 text-xs font-semibold rounded text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                          title="Select odd numbered pages (1, 3, 5...)"
                        >
                          Odd
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectEvenPages}
                          className="px-2 py-0.5 text-xs font-semibold rounded text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                          title="Select even numbered pages (2, 4, 6...)"
                        >
                          Even
                        </button>
                        <button
                          type="button"
                          onClick={handleInvertSelection}
                          className="px-2 py-0.5 text-xs font-semibold rounded text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
                          title="Invert current selection"
                        >
                          Invert
                        </button>
                      </div>

                      {pdfPagePreviews.length > 6 && (
                        <input
                          type="text"
                          value={pageSearchFilter}
                          onChange={(e) => setPageSearchFilter(e.target.value)}
                          placeholder="Filter pg #"
                          className="w-20 px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00288e]"
                        />
                      )}
                    </>
                  )}

                  {tool.id !== 'reorder-pdf-pages' && tool.id !== 'pdf-to-jpg' && tool.id !== 'pdf-to-png' && (
                    <>
                      <button
                        onClick={() => {
                          setPdfPagePreviews((prev) => prev.map((p) => ({ ...p, selected: true })));
                        }}
                        className="text-xs font-semibold text-[#00288e] dark:text-blue-400 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button
                        onClick={() => {
                          setPdfPagePreviews((prev) => prev.map((p) => ({ ...p, selected: false })));
                        }}
                        className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:underline"
                      >
                        Deselect All
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Informational Guidance Banner */}
              {tool.id === 'reorder-pdf-pages' && (
                <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-xl p-3 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#00288e] dark:text-blue-400 shrink-0" />
                    <span>
                      Drag pages or use the <strong>←</strong> / <strong>→</strong> buttons to arrange your desired sequence. The output PDF will strictly follow this order.
                    </span>
                  </div>
                </div>
              )}

              {(tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') && (
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#00288e] dark:text-blue-400 shrink-0" />
                    <span>
                      {selectedPageNumbers.length === 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          Click any page thumbnail below to select it for conversion.
                        </span>
                      ) : selectedPageNumbers.length === 1 ? (
                        <span>
                          <strong>Page {selectedPageNumbers[0]}</strong> will download directly as a high-resolution{' '}
                          <strong>.{tool.id === 'pdf-to-jpg' ? 'jpg' : 'png'}</strong> image file.
                        </span>
                      ) : (
                        <span>
                          <strong>{selectedPageNumbers.length} pages selected</strong> ({formatPageRangeString(selectedPageNumbers)}): Will download as a <strong>ZIP archive</strong> with individual image downloads available.
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] shrink-0">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Hover thumbnail to inspect full-size</span>
                  </div>
                </div>
              )}

              {/* Page Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                {pdfPagePreviews
                  .filter((p) =>
                    pageSearchFilter.trim()
                      ? p.pageNumber.toString().includes(pageSearchFilter.trim())
                      : true
                  )
                  .map((p, index) => {
                    const isReorder = tool.id === 'reorder-pdf-pages';
                    const isConverter = tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png';

                    return (
                      <div
                        key={p.pageNumber}
                        draggable={isReorder}
                        onDragStart={(e) => {
                          if (isReorder) {
                            setDraggedPageIndex(index);
                            e.dataTransfer.effectAllowed = 'move';
                          }
                        }}
                        onDragOver={(e) => {
                          if (isReorder) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                          }
                        }}
                        onDrop={(e) => {
                          if (isReorder) {
                            e.preventDefault();
                            if (draggedPageIndex !== null && draggedPageIndex !== index) {
                              setPdfPagePreviews((prev) => {
                                const copy = [...prev];
                                const [moved] = copy.splice(draggedPageIndex, 1);
                                copy.splice(index, 0, moved);
                                return copy;
                              });
                              setDraggedPageIndex(null);
                            }
                          }
                        }}
                        onClick={() => {
                          if (isConverter) {
                            handleTogglePagePreview(p.pageNumber);
                          } else if (!isReorder) {
                            setPdfPagePreviews((prev) =>
                              prev.map((item) =>
                                item.pageNumber === p.pageNumber
                                  ? { ...item, selected: !item.selected }
                                  : item
                              )
                            );
                          }
                        }}
                        className={`group relative bg-white dark:bg-slate-900 rounded-xl border-2 p-2.5 transition-all select-none cursor-pointer ${
                          isReorder
                            ? 'border-slate-200 dark:border-slate-800 hover:border-[#00288e] dark:hover:border-blue-500 shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing'
                            : p.selected
                            ? 'border-[#00288e] dark:border-blue-500 shadow-sm ring-2 ring-[#00288e]/20 dark:ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20'
                            : 'border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-300'
                        } ${draggedPageIndex === index ? 'opacity-40 scale-95 border-dashed border-[#00288e]' : ''}`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          {isReorder ? (
                            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                              <GripVertical className="w-3.5 h-3.5 text-slate-400" />
                              <span className="bg-[#00288e] text-white text-[10px] px-1.5 py-0.2 rounded font-mono font-bold">
                                #{index + 1}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                                (Pg {p.pageNumber})
                              </span>
                            </div>
                          ) : isConverter ? (
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={p.selected}
                                  onChange={() => handleTogglePagePreview(p.pageNumber)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="accent-[#00288e] rounded cursor-pointer w-3.5 h-3.5"
                                />
                                <span className="text-slate-800 dark:text-slate-200">Page {p.pageNumber}</span>
                              </div>
                              {p.selected ? (
                                <span className="text-[10px] font-bold text-white bg-[#00288e] dark:bg-blue-600 px-1.5 py-0.2 rounded flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> {tool.id === 'pdf-to-jpg' ? 'JPG' : 'PNG'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                  Skip
                                </span>
                              )}
                            </div>
                          ) : (
                            <>
                              <span className="text-slate-800 dark:text-slate-200">Page {p.pageNumber}</span>
                              <input
                                type="checkbox"
                                checked={p.selected}
                                onChange={() => {}}
                                className="accent-[#00288e] rounded cursor-pointer"
                              />
                            </>
                          )}
                        </div>

                        {/* Thumbnail View with Zoom Overlay */}
                        <div className="relative h-40 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden rounded-md border border-slate-100 dark:border-slate-800">
                          <img
                            src={p.dataUrl}
                            alt={`Page ${p.pageNumber}`}
                            className="w-full h-full object-contain pointer-events-none"
                            style={{ transform: `rotate(${p.rotation}deg)` }}
                          />

                          {/* Hover Zoom / Inspect Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectingPagePreview(p);
                            }}
                            className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-[#00288e] text-white text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-xs flex items-center gap-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            title="Zoom and inspect page"
                          >
                            <ZoomIn className="w-3 h-3" />
                            <span>Zoom</span>
                          </button>
                        </div>

                        {/* Tool specific controls on thumbnail card */}
                        {isReorder && (
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMovePagePreview(index, 'prev');
                              }}
                              className={`py-1 text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors ${
                                index === 0
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-[#00288e] hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200'
                              }`}
                              title="Move left (earlier in document)"
                            >
                              <ArrowLeft className="w-3 h-3" />
                              <span>Prev</span>
                            </button>
                            <button
                              type="button"
                              disabled={index === pdfPagePreviews.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMovePagePreview(index, 'next');
                              }}
                              className={`py-1 text-xs font-bold rounded flex items-center justify-center gap-1 transition-colors ${
                                index === pdfPagePreviews.length - 1
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-[#00288e] hover:text-white dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200'
                              }`}
                              title="Move right (later in document)"
                            >
                              <span>Next</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}

                        {tool.id === 'rotate-pdf-pages' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPdfPagePreviews((prev) =>
                                prev.map((item) =>
                                  item.pageNumber === p.pageNumber
                                    ? { ...item, rotation: (item.rotation + 90) % 360 }
                                    : item
                                )
                              );
                            }}
                            className="mt-2 w-full py-1 text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded flex items-center justify-center gap-1"
                          >
                            <RotateCw className="w-3 h-3" />
                            Rotate
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Full-Page Inspection / Zoom Modal */}
          {inspectingPagePreview && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
              onClick={() => setInspectingPagePreview(null)}
            >
              <div
                className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      Page {inspectingPagePreview.pageNumber} of {pdfPagePreviews.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        handleTogglePagePreview(inspectingPagePreview.pageNumber);
                        setInspectingPagePreview((prev) =>
                          prev ? { ...prev, selected: !prev.selected } : null
                        );
                      }}
                      className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${
                        inspectingPagePreview.selected
                          ? 'bg-blue-100 dark:bg-blue-950 text-[#00288e] dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                      }`}
                    >
                      <Check
                        className={`w-3.5 h-3.5 ${
                          inspectingPagePreview.selected ? 'opacity-100' : 'opacity-30'
                        }`}
                      />
                      {inspectingPagePreview.selected ? 'Selected for Conversion' : 'Click to Select This Page'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectingPagePreview(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Close (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body / Large Image View */}
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100/70 dark:bg-slate-950/70">
                  <img
                    src={inspectingPagePreview.dataUrl}
                    alt={`Page ${inspectingPagePreview.pageNumber} Full Preview`}
                    className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 bg-white"
                    style={{ transform: `rotate(${inspectingPagePreview.rotation}deg)` }}
                  />
                </div>

                {/* Modal Footer / Navigation */}
                <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
                  {(() => {
                    const currentIdx = pdfPagePreviews.findIndex(
                      (p) => p.pageNumber === inspectingPagePreview.pageNumber
                    );
                    return (
                      <>
                        <button
                          type="button"
                          disabled={currentIdx <= 0}
                          onClick={() => {
                            if (currentIdx > 0) setInspectingPagePreview(pdfPagePreviews[currentIdx - 1]);
                          }}
                          className="px-3 py-1.5 rounded-lg font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          <span>Previous Page</span>
                        </button>

                        <span className="text-slate-400 dark:text-slate-500 hidden sm:inline text-[11px]">
                          Press <strong>←</strong> / <strong>→</strong> to navigate · <strong>Esc</strong> to close
                        </span>

                        <button
                          type="button"
                          disabled={currentIdx >= pdfPagePreviews.length - 1}
                          onClick={() => {
                            if (currentIdx < pdfPagePreviews.length - 1)
                              setInspectingPagePreview(pdfPagePreviews[currentIdx + 1]);
                          }}
                          className="px-3 py-1.5 rounded-lg font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 transition-colors"
                        >
                          <span>Next Page</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Plain Text input for TXT to PDF */}
          {tool.id === 'txt-to-pdf' && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Document Text Content</span>
                <span className="text-xs text-slate-400">
                  {txtContent.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <textarea
                value={txtContent}
                onChange={(e) => setTxtContent(e.target.value)}
                placeholder="Paste or type text here to convert into a clean PDF document..."
                rows={12}
                className="w-full p-4 text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e]"
              />
            </div>
          )}

          {/* Merge PDF Files Workbench */}
          {tool.id === 'merge-pdf' && (
            <div className="flex flex-col gap-4">
              {/* Action Bar */}
              <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">PDFs in Merge Sequence</span>
                  <span className="bg-[#00288e] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {mergePdfList.length} {mergePdfList.length === 1 ? 'file' : 'files'}
                  </span>
                  {mergePdfList.length > 0 && (
                    <span className="text-xs text-slate-400 font-medium">
                      ({totalMergePages} {totalMergePages === 1 ? 'page total' : 'pages total'})
                    </span>
                  )}
                </div>
                {mergePdfList.length > 0 && (
                  <button
                    onClick={handleClearMergePdfs}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear List
                  </button>
                )}
              </div>

              {/* Guidance banner when only 1 PDF has been uploaded */}
              {mergePdfList.length === 1 && (
                <div className="flex items-center gap-2.5 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-[#00288e] shrink-0" />
                  <span>
                    <strong>1 document ready.</strong> Add at least one more PDF file below to create your combined document.
                  </span>
                </div>
              )}

              {/* PDF items list */}
              {mergePdfList.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {mergePdfList.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Order badge */}
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#00288e] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                          #{idx + 1}
                        </div>

                        {/* File icon & details */}
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-[#00288e] shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>{formatBytes(item.size)}</span>
                            <span>•</span>
                            <span>{item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#00288e] border border-blue-100">
                              Output pp. {mergeRanges[idx]?.start}{mergeRanges[idx]?.end !== mergeRanges[idx]?.start ? `–${mergeRanges[idx]?.end}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reorder and Delete controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveMergePdf(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveMergePdf(idx, 'down')}
                          disabled={idx === mergePdfList.length - 1}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveMergePdf(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                          title="Remove PDF"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add More PDFs Dropzone */}
              <Dropzone
                accept=".pdf"
                multiple={true}
                onFilesSelected={handleFilesSelected}
                title={mergePdfList.length === 0 ? "Select PDF Files to Merge" : "Add More PDF Files"}
                subtitle={mergePdfList.length === 0 ? "Upload at least 2 PDF files to combine" : "Drop additional PDFs here or click to browse"}
                badges={['PDF']}
                className={mergePdfList.length > 0 ? "mt-1" : ""}
              />
            </div>
          )}

          {/* PDF File Card when loaded and not in multi-page preview mode */}
          {pdfFile && pdfPagePreviews.length === 0 && tool.id !== 'merge-pdf' && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#00288e] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate text-sm">{pdfFile.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{formatBytes(pdfFile.size)}</span>
                    <span>•</span>
                    <span className="text-[#00288e] font-semibold">PDF Document</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setPdfFile(null);
                  setResultBlob(null);
                  setCompressionResultInfo(null);
                }}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Remove file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Office File Card when loaded */}
          {officeFile && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#00288e] flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 truncate text-sm">{officeFile.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span>{formatBytes(officeFile.size)}</span>
                    <span>•</span>
                    <span className="text-[#00288e] font-semibold">
                      {officeFile.name.split('.').pop()?.toUpperCase() || 'Office'} Document
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setOfficeFile(null);
                  setResultBlob(null);
                }}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Remove file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Upload Dropzone if no file selected yet for single PDF tools */}
          {!pdfFile &&
            tool.id !== 'merge-pdf' &&
            tool.acceptedFormats.includes('.pdf') &&
            tool.id !== 'jpg-to-pdf' &&
            tool.id !== 'png-to-pdf' &&
            tool.id !== 'images-to-pdf' && (
              <Dropzone
                accept=".pdf"
                multiple={false}
                onFilesSelected={handleFilesSelected}
                title="Select or Drop PDF File"
                subtitle="Upload document to configure and process"
                badges={['PDF']}
              />
            )}

          {/* Upload Dropzone for Office conversion tools */}
          {!officeFile &&
            (tool.id === 'excel-to-pdf' ||
              tool.id === 'word-to-pdf' ||
              tool.id === 'powerpoint-to-pdf') && (
              <Dropzone
                accept={tool.acceptedFormats.join(',')}
                multiple={false}
                onFilesSelected={handleFilesSelected}
                title={`Select or Drop ${tool.name.replace(' to PDF', '')} File`}
                subtitle={`Upload ${tool.acceptedFormats.join(', ')} to convert into PDF`}
                badges={tool.acceptedFormats.map((f) => f.replace('.', '').toUpperCase())}
              />
            )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SUCCESS & DOWNLOAD SECTION matching Stitch layout */}
          {resultBlob && (
            <div
              className={`bg-white rounded-2xl border-2 p-6 sm:p-8 shadow-md flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out] ${
                compressionResultInfo?.isAlreadyOptimized
                  ? 'border-amber-300'
                  : 'border-teal-500/40'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0 shadow-sm ${
                      compressionResultInfo?.isAlreadyOptimized
                        ? 'bg-amber-500'
                        : 'bg-teal-500'
                    }`}
                  >
                    {compressionResultInfo?.isAlreadyOptimized ? (
                      <AlertCircle className="w-7 h-7" />
                    ) : (
                      <CheckCircle2 className="w-7 h-7" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 mb-1">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          compressionResultInfo?.isAlreadyOptimized
                            ? 'text-amber-800 bg-amber-100'
                            : 'text-teal-800 bg-teal-50'
                        }`}
                      >
                        {compressionResultInfo?.isAlreadyOptimized
                          ? 'Already Optimized'
                          : 'Complete'}
                      </span>
                      <span className="text-xs text-slate-400">Processed in browser</span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900">
                      {compressionResultInfo?.isAlreadyOptimized
                        ? 'Compression did not reduce this file'
                        : compressionResultInfo?.targetSizeBytes
                        ? compressionResultInfo.withinTolerance
                          ? 'Target Size Achieved (±3% Tolerance)!'
                          : compressionResultInfo.targetAchieved
                          ? 'Target Size Achieved!'
                          : 'Best Target Size Result'
                        : 'Your file is ready!'}
                    </h3>

                    {compressionResultInfo?.isAlreadyOptimized ? (
                      <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                        {compressionResultInfo.message ||
                          'This PDF may already be optimized or may contain content that cannot be compressed further without degrading vector text. Your original file is preserved to avoid creating a larger document.'}
                      </p>
                    ) : compressionResultInfo?.targetSizeBytes ? (
                      <div className="space-y-1.5 pt-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              compressionResultInfo.withinTolerance
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : compressionResultInfo.targetAchieved
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {compressionResultInfo.withinTolerance
                              ? `Exact Target Match (±3% Precision)`
                              : compressionResultInfo.targetAchieved
                              ? `Target Reached (≤ ${formatBytes(compressionResultInfo.targetSizeBytes)})`
                              : `Target Limit Reached (${formatBytes(compressionResultInfo.newSize)})`}
                          </span>

                          {compressionResultInfo.tolerancePercent !== undefined &&
                            compressionResultInfo.tolerancePercent !== 0 && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#00288e] border border-blue-200">
                                {compressionResultInfo.tolerancePercent >= 0 ? '+' : ''}
                                {compressionResultInfo.tolerancePercent}% variance
                              </span>
                            )}

                          {compressionResultInfo.compressionMethodNotice && (
                            <span className="text-slate-400 text-[11px]">
                              via {compressionResultInfo.compressionMethodNotice}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {compressionResultInfo.message}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Generated <span className="font-semibold text-slate-800">{resultFileName}</span>
                        {compressionResultInfo?.compressionMethodNotice && (
                          <span className="text-slate-400"> ({compressionResultInfo.compressionMethodNotice})</span>
                        )}.
                      </p>
                    )}

                    {/* Size Delta metrics */}
                    {originalSize > 0 && resultSize > 0 && (
                      <div
                        className={`grid gap-2 pt-2 ${
                          compressionResultInfo?.targetSizeBytes
                            ? 'grid-cols-2 sm:grid-cols-5'
                            : 'grid-cols-2 sm:grid-cols-4'
                        }`}
                      >
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Original</span>
                          <span className="text-xs font-bold text-slate-800">{formatBytes(originalSize)}</span>
                        </div>
                        {compressionResultInfo?.targetSizeBytes && (
                          <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-2.5 text-center">
                            <span className="text-[10px] uppercase font-bold text-[#00288e] block">Target Goal</span>
                            <span className="text-xs font-bold text-[#00288e]">
                              {formatBytes(compressionResultInfo.targetSizeBytes)}
                            </span>
                          </div>
                        )}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">
                            {compressionResultInfo?.isAlreadyOptimized ? 'Output' : 'Compressed'}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{formatBytes(resultSize)}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Saved</span>
                          <span
                            className={`text-xs font-bold ${
                              reductionPercent > 0 ? 'text-teal-700' : 'text-slate-500'
                            }`}
                          >
                            {reductionPercent > 0 ? formatBytes(originalSize - resultSize) : '0 B'}
                          </span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 text-center">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Reduction</span>
                          <span
                            className={`text-xs font-bold ${
                              reductionPercent > 0 ? 'text-teal-700' : 'text-slate-500'
                            }`}
                          >
                            {reductionPercent > 0 ? `${reductionPercent}%` : '0%'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Download / Action Button */}
                <div className="flex flex-col sm:flex-row md:flex-col gap-2 w-full md:w-auto shrink-0">
                  <button
                    onClick={handleDownload}
                    className="px-6 py-3.5 rounded-xl bg-[#00288e] text-white font-bold text-sm hover:bg-blue-800 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {compressionResultInfo?.isAlreadyOptimized
                        ? `Download Original (${formatBytes(originalSize)})`
                        : `Download (${formatBytes(resultSize)})`}
                    </span>
                  </button>

                  {compressionResultInfo?.isAlreadyOptimized && compressSettings.preset !== 'maximum' && (
                    <button
                      onClick={() => {
                        setCompressSettings((prev) => ({
                          ...prev,
                          preset: 'maximum',
                          quality: 0.50,
                          dpi: 96,
                        }));
                        setResultBlob(null);
                        setCompressionResultInfo(null);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold text-xs hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Try Maximum Preset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Converted Image Gallery for PDF to JPG / PNG */}
              {renderedImagesResult.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        Converted Image Outputs ({renderedImagesResult.length})
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {renderedImagesResult.length === 1
                          ? 'Single page converted directly into a standalone image file.'
                          : 'Download any individual page below, or use the primary button above to download all pages in a ZIP archive.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-1">
                    {renderedImagesResult.map((img) => {
                      const ext = tool.id === 'pdf-to-png' ? 'png' : 'jpg';
                      const imgName = `${pdfFile?.name.replace(/\.pdf$/i, '') || 'page'}_page_${img.pageNumber}.${ext}`;
                      return (
                        <div
                          key={img.pageNumber}
                          className="flex flex-col bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-2 gap-2"
                        >
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
                            <span>Page {img.pageNumber}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              {formatBytes(img.blob.size)}
                            </span>
                          </div>
                          <div className="h-32 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden border border-slate-100 dark:border-slate-800">
                            <img
                              src={img.dataUrl}
                              alt={`Page ${img.pageNumber}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadFile(img.blob, imgName)}
                            className="w-full py-1.5 px-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 text-[#00288e] dark:text-blue-400" />
                            <span>Download {ext.toUpperCase()}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Extracted Text Result Viewer (for OCR or Text Extraction tools) */}
              {extractedTextResult && (
                <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Extracted Text Content</span>
                    <button
                      onClick={handleCopyText}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#00288e] hover:underline"
                    >
                      {copySuccess ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copySuccess ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 max-h-64 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {extractedTextResult}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Aside: Document Setup & Action Panel (4 cols) */}
        <aside className="lg:col-span-4 sticky top-20 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col gap-5 transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#00288e] dark:text-blue-400 flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Document Setup</h2>
              </div>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                PDF 1.7 Standard
              </span>
            </div>

            {/* Config: Merge PDF Setup */}
            {tool.id === 'merge-pdf' && (
              <div className="flex flex-col gap-4">
                {/* Output Filename Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Combined Output Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={mergeOutputName}
                      onChange={(e) => setMergeOutputName(e.target.value)}
                      placeholder="merged_document.pdf"
                      className="w-full h-10 px-3 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00288e]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                      .pdf
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Your merged PDF document will be saved with this filename.
                  </span>
                </div>

                {/* Summary Card */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2">
                  <span className="text-xs font-bold text-slate-800">Merge Queue Summary</span>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                      <p className="text-[10px] text-slate-400 font-medium">Files</p>
                      <p className="text-sm font-bold text-[#00288e]">{mergePdfList.length}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                      <p className="text-[10px] text-slate-400 font-medium">Total Pages</p>
                      <p className="text-sm font-bold text-[#00288e]">{totalMergePages}</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                      <p className="text-[10px] text-slate-400 font-medium">Input Size</p>
                      <p className="text-sm font-bold text-[#00288e]">{formatBytes(totalMergeBytes)}</p>
                    </div>
                  </div>
                </div>

                {/* Quick Sort Controls */}
                {mergePdfList.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-bold text-slate-700">Quick Sequence Sorting</span>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleSortMergeAlphabetical(true)}
                        className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-1"
                        title="Sort by filename A to Z"
                      >
                        A → Z
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSortMergeAlphabetical(false)}
                        className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-1"
                        title="Sort by filename Z to A"
                      >
                        Z → A
                      </button>
                      <button
                        type="button"
                        onClick={handleReverseMergeOrder}
                        className="py-1.5 px-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-all flex items-center justify-center gap-1"
                        title="Reverse current sequence"
                      >
                        Reverse
                      </button>
                    </div>
                  </div>
                )}

                {/* Duplex Blank Page Option */}
                <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="duplex-blank-page"
                    checked={insertBlankPageForDuplex}
                    onChange={(e) => setInsertBlankPageForDuplex(e.target.checked)}
                    className="mt-0.5 accent-[#00288e] rounded w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="duplex-blank-page" className="text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                    <span className="font-semibold block text-slate-900">Duplex Printing Padding</span>
                    Insert blank page if a document ends on an odd page.
                  </label>
                </div>
              </div>
            )}

            {/* Config: Image to PDF options */}
            {(tool.id === 'jpg-to-pdf' ||
              tool.id === 'png-to-pdf' ||
              tool.id === 'images-to-pdf') && (
              <>
                {/* Orientation */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Page Orientation</span>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        orientation === 'portrait'
                          ? 'bg-white text-[#00288e] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        orientation === 'landscape'
                          ? 'bg-white text-[#00288e] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>

                {/* Page Geometry */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Page Geometry</label>
                  <select
                    value={pageSize}
                    onChange={(e: any) => setPageSize(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00288e]"
                  >
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="US-Letter">US Letter (8.5 × 11 in)</option>
                    <option value="Fit">Fit to Image Size</option>
                    <option value="A3">A3 (297 × 420 mm)</option>
                  </select>
                </div>

                {/* Margins */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Margin Spacing</span>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    {(['none', 'small', 'big'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMargin(m)}
                        className={`py-1.5 px-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                          margin === m
                            ? 'bg-white text-[#00288e] shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {m === 'none' ? 'None' : m === 'small' ? '10mm' : '20mm'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Config: Compression Settings (Compress PDF & Custom) */}
            {(tool.id === 'compress-pdf' || tool.id === 'custom-pdf-compression') && (
              <div className="flex flex-col gap-4">
                {/* 4 Presets Selection */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Compression Preset</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() =>
                        setCompressSettings((prev) => ({
                          ...prev,
                          preset: 'recommended',
                          quality: 0.75,
                          dpi: 150,
                          colorMode: 'full',
                          protectVectors: true,
                        }))
                      }
                      className={`py-2 px-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                        compressSettings.preset === 'recommended'
                          ? 'bg-white text-[#00288e] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Recommended
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCompressSettings((prev) => ({
                          ...prev,
                          preset: 'maximum',
                          quality: 0.50,
                          dpi: 96,
                          protectVectors: true,
                        }))
                      }
                      className={`py-2 px-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                        compressSettings.preset === 'maximum'
                          ? 'bg-white text-[#00288e] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Maximum
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCompressSettings((prev) => ({
                          ...prev,
                          preset: 'high-quality',
                          quality: 0.88,
                          dpi: 200,
                          colorMode: 'full',
                          protectVectors: true,
                        }))
                      }
                      className={`py-2 px-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                        compressSettings.preset === 'high-quality'
                          ? 'bg-white text-[#00288e] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      High Quality
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCompressSettings((prev) => ({
                          ...prev,
                          preset: 'target-size',
                          targetSizeValue: prev.targetSizeValue || 250,
                          targetSizeUnit: prev.targetSizeUnit || 'KB',
                          protectVectors: true,
                        }))
                      }
                      className={`py-2 px-1.5 rounded-lg text-xs font-semibold text-center transition-all ${
                        compressSettings.preset === 'target-size'
                          ? 'bg-white text-[#00288e] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Target Size
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCompressSettings((prev) => ({
                        ...prev,
                        preset: prev.preset === 'custom' ? 'recommended' : 'custom',
                      }))
                    }
                    className="text-[11px] font-semibold text-[#00288e] hover:underline self-end pt-0.5 cursor-pointer"
                  >
                    {compressSettings.preset === 'custom'
                      ? '← Switch to Standard Presets'
                      : 'Show Custom Tuning Controls →'}
                  </button>
                </div>

                {/* Preset Explanatory Notes & Warnings */}
                {compressSettings.preset === 'recommended' && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed">
                    <span className="font-bold block text-[#00288e] mb-0.5">Balanced Compression</span>
                    Preserves readable text, vectors, and layouts with moderate image optimization. Avoids unnecessary rasterization.
                  </div>
                )}

                {compressSettings.preset === 'maximum' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                    <span className="font-bold block text-amber-800 mb-0.5">Maximum Compression Notice</span>
                    Applies stronger image downsampling and lossy compression. Visual quality of photos and drawings will decrease. Does not guarantee a specific file size.
                  </div>
                )}

                {compressSettings.preset === 'high-quality' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed">
                    <span className="font-bold block text-slate-900 mb-0.5">High Quality Optimization</span>
                    Preserves image quality as much as possible. Applies safe structural optimization, object stream compaction, and metadata cleaning.
                  </div>
                )}

                {/* Target Size Dedicated Input Bar */}
                {compressSettings.preset === 'target-size' && (
                  <div className="flex flex-col gap-3 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800">Target File Size</label>
                      <span className="text-[11px] font-semibold text-[#00288e]">
                        Original: {formatBytes(originalSize || pdfFile?.size || 0)}
                      </span>
                    </div>

                    {/* Numeric Input & Unit Selector */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min={1}
                          step={10}
                          value={compressSettings.targetSizeValue ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setCompressSettings((prev) => ({
                              ...prev,
                              targetSizeValue: isNaN(val) ? 0 : val,
                            }));
                          }}
                          placeholder="250"
                          className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-[#00288e]"
                        />
                      </div>
                      <div className="grid grid-cols-2 p-1 bg-slate-200/70 rounded-xl text-xs font-bold w-28 shrink-0">
                        <button
                          type="button"
                          onClick={() => setCompressSettings((prev) => ({ ...prev, targetSizeUnit: 'KB' }))}
                          className={`py-1.5 rounded-lg transition-all ${
                            compressSettings.targetSizeUnit !== 'MB'
                              ? 'bg-white text-[#00288e] shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          KB
                        </button>
                        <button
                          type="button"
                          onClick={() => setCompressSettings((prev) => ({ ...prev, targetSizeUnit: 'MB' }))}
                          className={`py-1.5 rounded-lg transition-all ${
                            compressSettings.targetSizeUnit === 'MB'
                              ? 'bg-white text-[#00288e] shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          MB
                        </button>
                      </div>
                    </div>

                    {/* Validation Message */}
                    {(!compressSettings.targetSizeValue || compressSettings.targetSizeValue <= 0) && (
                      <p className="text-[11px] font-semibold text-red-600">
                        Please enter a valid target size greater than 0.
                      </p>
                    )}

                    {/* Quick Preset Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-semibold text-slate-400">Quick:</span>
                      {[
                        { val: 250, unit: 'KB' },
                        { val: 500, unit: 'KB' },
                        { val: 1, unit: 'MB' },
                        { val: 2, unit: 'MB' },
                        { val: 5, unit: 'MB' },
                      ].map((chip) => (
                        <button
                          key={`${chip.val}-${chip.unit}`}
                          type="button"
                          onClick={() =>
                            setCompressSettings((prev) => ({
                              ...prev,
                              targetSizeValue: chip.val,
                              targetSizeUnit: chip.unit as 'KB' | 'MB',
                            }))
                          }
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white hover:bg-blue-100 text-[#00288e] border border-blue-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          {chip.val} {chip.unit}
                        </button>
                      ))}
                    </div>

                    {/* Target Feasibility & Math Notice */}
                    {originalSize > 0 &&
                      compressSettings.targetSizeValue !== undefined &&
                      compressSettings.targetSizeValue > 0 && (
                        <div className="text-[11px] text-slate-600 border-t border-blue-200/60 pt-2 leading-relaxed">
                          {(() => {
                            const targetBytes =
                              compressSettings.targetSizeValue *
                              (compressSettings.targetSizeUnit === 'MB' ? 1024 * 1024 : 1024);
                            if (originalSize <= targetBytes) {
                              return (
                                <span className="text-teal-700 font-semibold">
                                  Your file ({formatBytes(originalSize)}) is already smaller than the target (
                                  {formatBytes(targetBytes)}). Compression is optional.
                                </span>
                              );
                            }
                            const pct = Math.round(((originalSize - targetBytes) / originalSize) * 100);
                            return (
                              <span>
                                Target requires ~<strong>{pct}% reduction</strong>. Progressive compression will
                                apply multi-stage optimization to reach it without unnecessary rasterization.
                              </span>
                            );
                          })()}
                        </div>
                      )}
                  </div>
                )}

                {/* Custom Fine-Tuning Controls (when custom is selected) */}
                {compressSettings.preset === 'custom' && (
                  <div className="flex flex-col gap-3.5 pt-1 border-t border-slate-100">
                    {/* Target File Reduction (Guideline, not a guarantee) */}
                    <div className="flex flex-col gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">Target File Reduction Goal</span>
                        <span className="font-bold text-[#00288e]">
                          {compressSettings.targetReductionPercent}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={85}
                        value={compressSettings.targetReductionPercent}
                        onChange={(e) =>
                          setCompressSettings((prev) => ({
                            ...prev,
                            targetReductionPercent: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-[#00288e]"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Minimal (5%)</span>
                        <span>Target Goal (not guaranteed)</span>
                        <span>Max (85%)</span>
                      </div>
                    </div>

                    {/* Raster Sampling (DPI) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-700">Image Sampling (DPI)</span>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        {[72, 96, 150, 200, 300].map((dpiVal) => (
                          <button
                            key={dpiVal}
                            type="button"
                            onClick={() =>
                              setCompressSettings((prev) => ({ ...prev, dpi: dpiVal }))
                            }
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                              compressSettings.dpi === dpiVal
                                ? 'bg-[#00288e] text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {dpiVal}
                          </button>
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Applies to embedded images being downsampled. Selectable vector text is preserved.
                      </span>
                    </div>

                    {/* Color mode */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-700">Color Processing</span>
                      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl text-center">
                        {(['full', 'gray', 'mono'] as const).map((cm) => (
                          <button
                            key={cm}
                            type="button"
                            onClick={() =>
                              setCompressSettings((prev) => ({ ...prev, colorMode: cm }))
                            }
                            className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                              compressSettings.colorMode === cm
                                ? 'bg-white text-[#00288e] shadow-2xs'
                                : 'text-slate-600'
                            }`}
                          >
                            {cm === 'full' ? 'Color' : cm === 'gray' ? 'Grayscale' : 'Mono'}
                          </button>
                        ))}
                      </div>
                      {compressSettings.colorMode !== 'full' && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                          Notice: Grayscale and Monochrome conversion will alter the colors of your document.
                        </div>
                      )}
                    </div>

                    {/* Vector Protection */}
                    <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <input
                        type="checkbox"
                        id="protect-vectors"
                        checked={compressSettings.protectVectors}
                        onChange={(e) =>
                          setCompressSettings((prev) => ({ ...prev, protectVectors: e.target.checked }))
                        }
                        className="mt-0.5 accent-[#00288e] rounded"
                      />
                      <label htmlFor="protect-vectors" className="text-xs text-slate-700 cursor-pointer select-none">
                        <span className="font-semibold block text-slate-900">Preserve Selectable Text & Vectors</span>
                        Prevents converting document pages into uncompressed bitmap images.
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Config: OCR Language options */}
            {(tool.id === 'ocr-images' || tool.id === 'ocr-scanned-pdf') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">OCR Recognition Language</label>
                <select
                  value={ocrLanguage}
                  onChange={(e) => setOcrLanguage(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00288e]"
                >
                  <option value="eng">English (Latin)</option>
                  <option value="spa">Spanish (Español)</option>
                  <option value="fra">French (Français)</option>
                  <option value="deu">German (Deutsch)</option>
                  <option value="ita">Italian (Italiano)</option>
                </select>
              </div>
            )}

            {/* Config: Split PDF options */}
            {tool.id === 'split-pdf' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Split Method</span>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setSplitMode('custom-ranges')}
                      className={`py-1.5 text-xs font-semibold rounded-lg ${
                        splitMode === 'custom-ranges'
                          ? 'bg-white text-[#00288e] shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Page Ranges
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitMode('all-pages')}
                      className={`py-1.5 text-xs font-semibold rounded-lg ${
                        splitMode === 'all-pages'
                          ? 'bg-white text-[#00288e] shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      All Pages
                    </button>
                  </div>
                </div>

                {splitMode === 'custom-ranges' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">Page Sequences</label>
                    <input
                      type="text"
                      value={splitRanges}
                      onChange={(e) => setSplitRanges(e.target.value)}
                      placeholder="e.g. 1-2, 4, 6-8"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                    />
                    <span className="text-[11px] text-slate-400">
                      Comma-separated ranges or single page numbers.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Config: Page Numbering options */}
            {tool.id === 'add-page-numbers' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Position</label>
                  <select
                    value={pageNumberOptions.position}
                    onChange={(e: any) =>
                      setPageNumberOptions((p) => ({ ...p, position: e.target.value }))
                    }
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Numbering Format</label>
                  <select
                    value={pageNumberOptions.format}
                    onChange={(e: any) =>
                      setPageNumberOptions((p) => ({ ...p, format: e.target.value }))
                    }
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  >
                    <option value="page-x-of-y">Page X of Y (e.g. Page 1 of 10)</option>
                    <option value="page-x">Page X (e.g. Page 1)</option>
                    <option value="x">Number Only (e.g. 1)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Config: Watermark options */}
            {tool.id === 'add-watermark' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Watermark Text</label>
                  <input
                    type="text"
                    value={watermarkOptions.text}
                    onChange={(e) =>
                      setWatermarkOptions((w) => ({ ...w, text: e.target.value }))
                    }
                    placeholder="CONFIDENTIAL"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Opacity</span>
                    <span>{Math.round(watermarkOptions.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={80}
                    value={Math.round(watermarkOptions.opacity * 100)}
                    onChange={(e) =>
                      setWatermarkOptions((w) => ({
                        ...w,
                        opacity: parseInt(e.target.value, 10) / 100,
                      }))
                    }
                    className="w-full accent-[#00288e]"
                  />
                </div>
              </div>
            )}

            {/* Config: Excel to PDF & Word to PDF options */}
            {(tool.id === 'excel-to-pdf' || tool.id === 'word-to-pdf') && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700">Page Orientation</span>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setOrientation('portrait')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        orientation === 'portrait'
                          ? 'bg-white text-[#00288e] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrientation('landscape')}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        orientation === 'landscape'
                          ? 'bg-white text-[#00288e] shadow-2xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-700">Page Size</label>
                  <select
                    value={pageSize}
                    onChange={(e: any) => setPageSize(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00288e]"
                  >
                    <option value="A4">A4 (210 × 297 mm)</option>
                    <option value="US-Letter">US Letter (8.5 × 11 in)</option>
                    <option value="A3">A3 (297 × 420 mm)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Config: PowerPoint to PDF */}
            {tool.id === 'powerpoint-to-pdf' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed">
                <span className="font-bold block text-[#00288e] mb-0.5">Widescreen 16:9 Presentation</span>
                Slides will be converted into high-definition landscape presentation pages preserving slide headers, bullet points, and figures.
              </div>
            )}

            {/* Config: PDF to Word (DOCX) */}
            {tool.id === 'pdf-to-word' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed">
                <span className="font-bold block text-[#00288e] mb-0.5">Native DOCX Reconstruction</span>
                Extracts text hierarchies and reconstructs fluid Word paragraphs and headings into an editable .docx file.
              </div>
            )}

            {/* Config: PDF to HTML */}
            {tool.id === 'pdf-to-html' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 leading-relaxed">
                <span className="font-bold block text-[#00288e] mb-0.5">Semantic Web HTML5</span>
                Transforms PDF pages into responsive HTML markup with modern CSS typography and mobile/desktop styling.
              </div>
            )}

            {/* Config: Protect PDF with Password */}
            {tool.id === 'protect-pdf' && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Document Password</label>
                  <input
                    type="password"
                    value={protectPassword}
                    onChange={(e) => setProtectPassword(e.target.value)}
                    placeholder="Enter secure password"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#00288e]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type password"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#00288e]"
                  />
                  {protectPassword && confirmPassword && protectPassword !== confirmPassword && (
                    <span className="text-[11px] text-red-600 font-semibold mt-0.5">
                      Passwords do not match.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1 border-t border-slate-100">
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPrinting}
                      onChange={(e) => setAllowPrinting(e.target.checked)}
                      className="accent-[#00288e] rounded"
                    />
                    <span>Allow Printing</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowCopying}
                      onChange={(e) => setAllowCopying(e.target.checked)}
                      className="accent-[#00288e] rounded"
                    />
                    <span>Allow Copying Text</span>
                  </label>
                </div>
              </div>
            )}

            {/* Config: Unlock PDF */}
            {tool.id === 'unlock-pdf' && (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-700">Document Password</label>
                  <input
                    type="password"
                    value={unlockPassword}
                    onChange={(e) => setUnlockPassword(e.target.value)}
                    placeholder="Enter document password"
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#00288e]"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Enter the password for this file to permanently decrypt it and remove all editing, printing, and copying restrictions.
                </p>
              </div>
            )}

            {/* Config: PDF to JPG / PNG Configuration */}
            {(tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') && (
              <div className="flex flex-col gap-3.5">
                {/* Pages Selected Summary Card */}
                <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-950 dark:text-blue-100">
                    <span>Pages to Convert</span>
                    <span className="bg-[#00288e] text-white px-2 py-0.5 rounded-full text-[11px]">
                      {selectedPageNumbers.length} of {pdfPagePreviews.length || 0}
                    </span>
                  </div>

                  {/* Range text input */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      Page Sequence / Range
                    </label>
                    <input
                      type="text"
                      value={pageRangeInput}
                      onChange={(e) => handleRangeInputChange(e.target.value)}
                      placeholder="e.g. 1-3, 5, 8"
                      className="w-full h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#00288e]"
                    />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      Syncs bidirectionally with thumbnail selections.
                    </span>
                  </div>

                  {/* Quick Select Buttons */}
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    <button
                      type="button"
                      onClick={handleSelectAllPages}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#00288e] dark:text-blue-300 rounded border border-blue-200 dark:border-slate-700 transition-colors"
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllPages}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectOddPages}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#00288e] dark:text-blue-300 rounded border border-blue-200 dark:border-slate-700 transition-colors"
                    >
                      Odd
                    </button>
                    <button
                      type="button"
                      onClick={handleSelectEvenPages}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#00288e] dark:text-blue-300 rounded border border-blue-200 dark:border-slate-700 transition-colors"
                    >
                      Even
                    </button>
                    <button
                      type="button"
                      onClick={handleInvertSelection}
                      className="px-2 py-0.5 text-[10px] font-bold bg-white dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#00288e] dark:text-blue-300 rounded border border-blue-200 dark:border-slate-700 transition-colors"
                    >
                      Invert
                    </button>
                  </div>
                </div>

                {/* Output Resolution (DPI) */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Output Resolution</span>
                    <span className="text-[#00288e] dark:text-blue-400 font-bold">{renderDpi} DPI</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    {[
                      { dpi: 72, label: '72 DPI', desc: 'Screen / Fast' },
                      { dpi: 150, label: '150 DPI', desc: 'Standard' },
                      { dpi: 300, label: '300 DPI', desc: 'Ultra Sharp' },
                    ].map((opt) => (
                      <button
                        key={opt.dpi}
                        type="button"
                        onClick={() => setRenderDpi(opt.dpi)}
                        className={`py-2 px-1 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                          renderDpi === opt.dpi
                            ? 'bg-white dark:bg-slate-900 text-[#00288e] dark:text-blue-400 shadow-2xs font-bold'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span>{opt.label}</span>
                        <span className="text-[9px] opacity-75">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Delivery format note */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedPageNumbers.length === 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Please select at least 1 page above or type in the range box to convert.
                    </span>
                  ) : selectedPageNumbers.length === 1 ? (
                    <span>
                      <strong>1 page selected:</strong> Will be directly downloaded as a high-quality{' '}
                      <strong>.{tool.id === 'pdf-to-jpg' ? 'jpg' : 'png'}</strong> image.
                    </span>
                  ) : (
                    <span>
                      <strong>{selectedPageNumbers.length} pages selected:</strong> Will be packaged into a{' '}
                      <strong>.zip</strong> archive with all images, plus individual downloads.
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Progress indicator during execution */}
            {isProcessing && (
              <div className="flex flex-col gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between text-xs font-semibold text-[#00288e]">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {progressMessage || 'Processing...'}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-blue-200/50 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#00288e] h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            {(() => {
              const isActionDisabled =
                isProcessing ||
                (tool.id === 'merge-pdf' && mergePdfList.length < 2) ||
                ((tool.id === 'excel-to-pdf' ||
                  tool.id === 'word-to-pdf' ||
                  tool.id === 'powerpoint-to-pdf') &&
                  !officeFile) ||
                (tool.id === 'protect-pdf' &&
                  (!pdfFile || !protectPassword.trim() || protectPassword !== confirmPassword)) ||
                (tool.id === 'unlock-pdf' && (!pdfFile || !unlockPassword.trim())) ||
                ((tool.id === 'compress-pdf' || tool.id === 'custom-pdf-compression') &&
                  (!pdfFile ||
                    (compressSettings.preset === 'target-size' &&
                      (!compressSettings.targetSizeValue || compressSettings.targetSizeValue <= 0)))) ||
                ((tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') &&
                  pdfFile &&
                  pdfPagePreviews.length > 0 &&
                  selectedPageNumbers.length === 0) ||
                (!pdfFile &&
                  tool.acceptedFormats.includes('.pdf') &&
                  tool.id !== 'merge-pdf' &&
                  !tool.acceptedFormats.includes('.jpg'));

              return (
                <button
                  onClick={handleExecuteOperation}
                  disabled={isActionDisabled}
                  className="w-full py-3.5 px-5 bg-[#00288e] text-white rounded-xl font-bold text-sm hover:bg-blue-800 shadow-md hover:shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : tool.id === 'merge-pdf' ? (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>
                        {mergePdfList.length === 0
                          ? 'Select PDFs to Merge'
                          : mergePdfList.length === 1
                          ? 'Add 1 More PDF to Merge'
                          : `Merge ${mergePdfList.length} PDFs (${totalMergePages} Pages)`}
                      </span>
                    </>
                  ) : (tool.id === 'pdf-to-jpg' || tool.id === 'pdf-to-png') ? (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>
                        {selectedPageNumbers.length === 0
                          ? 'Select Pages to Convert'
                          : selectedPageNumbers.length === 1
                          ? `Convert Page ${selectedPageNumbers[0]} to ${tool.id === 'pdf-to-jpg' ? 'JPG' : 'PNG'}`
                          : `Convert ${selectedPageNumbers.length} Pages to ${tool.id === 'pdf-to-jpg' ? 'JPG' : 'PNG'}`}
                      </span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Start {tool.name}</span>
                    </>
                  )}
                </button>
              );
            })()}

            {/* Trust Footer */}
            <div className="flex items-center justify-center gap-3 text-slate-400 text-[11px] pt-1">
              <span>Encrypted</span>
              <span>•</span>
              <span>Memory Only</span>
              <span>•</span>
              <span>Instant</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
