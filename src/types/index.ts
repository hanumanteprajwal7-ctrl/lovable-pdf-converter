export type ToolCategory =
  | 'convert-to'
  | 'convert-from'
  | 'organize'
  | 'compress'
  | 'ocr'
  | 'edit'
  | 'security';

export interface ToolDef {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  categoryLabel: string;
  badge?: string;
  iconName: string;
  route: string;
  status: 'ready' | 'coming-soon';
  acceptedFormats: string[]; // e.g. ['.jpg', '.png', '.jpeg'] or ['.pdf']
  multiFile?: boolean;
  requiresEngineNotice?: string;
  keywords: string[];
}

export interface UploadedFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
  rotation?: number;
  pageCount?: number;
}

export type CompressionPreset = 'recommended' | 'maximum' | 'high-quality' | 'target-size' | 'custom';

export interface CompressSettings {
  preset: CompressionPreset;
  targetReductionPercent: number; // e.g. 45 (target goal, not guarantee)
  targetSizeValue?: number; // e.g. 250
  targetSizeUnit?: 'KB' | 'MB'; // 'KB' | 'MB'
  quality: number; // 0.1 to 1.0 (e.g. 0.75)
  dpi: number; // 72, 96, 150, 200, 300
  colorMode: 'full' | 'gray' | 'mono';
  protectVectors: boolean;
}

export interface CompressResult {
  data: Uint8Array;
  originalSize: number;
  newSize: number;
  reductionPercent: number;
  bytesSaved: number;
  modeUsed: 'structural-deflate' | 'image-downsample' | 'scanned-raster' | 'target-progressive' | 'already-optimized';
  isAlreadyOptimized: boolean;
  pageCount: number;
  hasSelectableText: boolean;
  message?: string;
  targetSizeBytes?: number;
  targetAchieved?: boolean;
  withinTolerance?: boolean; // True if output size is within +-3% of target
  tolerancePercent?: number; // Exact percentage variance from target
  compressionMethodNotice?: string;
}

export interface ProtectPdfOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
}

export interface UnlockPdfOptions {
  password: string;
}


export interface PageNumberOptions {
  position: 'bottom-center' | 'bottom-right' | 'top-right' | 'bottom-left';
  format: 'page-x-of-y' | 'x' | 'page-x';
  fontSize: number;
  startNumber: number;
}

export interface WatermarkOptions {
  text: string;
  fontSize: number;
  opacity: number; // 0.1 to 1.0
  color: string;
  rotation: number; // degrees e.g. 45
}

export interface TextAnnotationOptions {
  text: string;
  fontSize: number;
  color: string;
  pageNumber: number;
  xPercent: number; // 0 - 100
  yPercent: number; // 0 - 100
}

export interface AppSettings {
  defaultPageSize: 'A4' | 'US-Letter' | 'Fit' | 'A3';
  defaultImageFormat: 'jpg' | 'png';
  defaultImageQuality: number; // 10 to 100
  defaultDpi: number; // 72, 96, 150, 200, 300
  defaultCompressionMode: 'standard' | 'custom';
  theme: 'light' | 'dark' | 'system';
}

export interface BatchQueueItem {
  id: string;
  toolId: string;
  toolName: string;
  file: File;
  status: 'queued' | 'processing' | 'completed' | 'error';
  progress: number;
  outputBlob?: Blob;
  outputName?: string;
  outputSize?: number;
  errorMessage?: string;
  createdAt: number;
}
