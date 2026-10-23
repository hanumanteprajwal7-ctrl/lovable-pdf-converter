import React from 'react';
import { FileText, ShieldCheck, Lock, Cpu } from 'lucide-react';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="w-full bg-white border-t border-slate-200 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12 border-b border-slate-100">
          {/* Brand Info */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00288e] flex items-center justify-center text-white">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight font-sans">
                Lovable PDF Converter
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Simple, modern, private document and image conversion toolkit. All core operations execute directly in your browser session with zero server retention.
            </p>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-600 w-fit">
              <Lock className="w-3.5 h-3.5 text-[#00288e]" />
              <span>In-memory processing · Never stored on servers</span>
            </div>
          </div>

          {/* Tools Columns */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Convert Tools
            </span>
            <nav className="flex flex-col gap-2 text-sm text-slate-500">
              <button
                onClick={() => onNavigate('/tool/jpg-to-pdf')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                JPG to PDF
              </button>
              <button
                onClick={() => onNavigate('/tool/pdf-to-jpg')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                PDF to JPG
              </button>
              <button
                onClick={() => onNavigate('/tool/images-to-pdf')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Images to PDF
              </button>
              <button
                onClick={() => onNavigate('/tool/txt-to-pdf')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                TXT to PDF
              </button>
              <button
                onClick={() => onNavigate('/tool/pdf-to-png')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                PDF to PNG
              </button>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Organize & Optimize
            </span>
            <nav className="flex flex-col gap-2 text-sm text-slate-500">
              <button
                onClick={() => onNavigate('/tool/merge-pdf')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Merge PDF
              </button>
              <button
                onClick={() => onNavigate('/tool/split-pdf')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Split PDF
              </button>
              <button
                onClick={() => onNavigate('/tool/compress-pdf')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Compress PDF
              </button>
              <button
                onClick={() => onNavigate('/tool/custom-pdf-compression')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Custom Compression
              </button>
              <button
                onClick={() => onNavigate('/tool/rotate-pdf-pages')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Rotate Pages
              </button>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Utilities & OCR
            </span>
            <nav className="flex flex-col gap-2 text-sm text-slate-500">
              <button
                onClick={() => onNavigate('/tool/extract-text')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Extract Text
              </button>
              <button
                onClick={() => onNavigate('/tool/ocr-images')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                OCR for Images
              </button>
              <button
                onClick={() => onNavigate('/tool/ocr-scanned-pdf')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                OCR Scanned PDF
              </button>
              <button
                onClick={() => onNavigate('/tool/add-page-numbers')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Page Numbers
              </button>
              <button
                onClick={() => onNavigate('/tool/add-watermark')}
                className="text-left hover:text-[#00288e] transition-colors"
              >
                Add Watermark
              </button>
            </nav>
          </div>
        </div>

        {/* Subfooter */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Zero-Log Document Architecture · Client-side Private Execution</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('/settings')}
              className="hover:text-slate-900 transition-colors"
            >
              Preferences & Privacy
            </button>
            <span>·</span>
            <span>Lovable PDF Converter</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
