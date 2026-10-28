import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Layers,
  Split,
  Minimize2,
  ScanText,
  RotateCw,
  Sliders,
  CheckCircle2,
  Lock,
  Clock,
  Shield,
  ArrowRight,
  Search,
  ChevronRight,
  FileSearch,
  Upload,
  Sparkles,
  Zap
} from 'lucide-react';
import { Dropzone } from '../components/Dropzone';
import { TOOLS, CATEGORIES } from '../config/tools';
import { ToolDef } from '../types';

interface HomePageProps {
  onNavigate: (path: string) => void;
  onFilesDropped: (files: File[]) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onFilesDropped }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 12 Popular tools matching Stitch design
  const popularTools = [
    {
      id: 'jpg-to-pdf',
      name: 'JPG to PDF',
      desc: 'Convert single or bulk JPG images into clean, standardized multi-page PDF documents.',
      badge: 'Image → Doc',
      icon: ImageIcon,
      route: '/tool/jpg-to-pdf',
    },
    {
      id: 'pdf-to-jpg',
      name: 'PDF to JPG',
      desc: 'Render high-resolution raster images from every page of your PDF without loss of quality.',
      badge: '300 DPI Rendering',
      icon: FileText,
      route: '/tool/pdf-to-jpg',
    },
    {
      id: 'merge-pdf',
      name: 'Merge PDF',
      desc: 'Concatenate multiple PDF files into one neat package with drag reordering.',
      badge: 'Visual Reorder',
      icon: Layers,
      route: '/tool/merge-pdf',
    },
    {
      id: 'split-pdf',
      name: 'Split PDF',
      desc: 'Extract specific page sequences or break documents into single individual pages.',
      badge: 'Page Ranges',
      icon: Split,
      route: '/tool/split-pdf',
    },
    {
      id: 'compress-pdf',
      name: 'Compress PDF',
      desc: 'Reduce file size up to 85% while keeping vector text sharp and images clear.',
      badge: 'Smart Stream Optimizer',
      icon: Minimize2,
      route: '/tool/compress-pdf',
    },
    {
      id: 'custom-pdf-compression',
      name: 'Custom Compression',
      desc: 'Granular downsampling, DPI selection, and color mode tuning with live reduction metrics.',
      badge: 'Precision Studio',
      icon: Sliders,
      route: '/tool/custom-pdf-compression',
    },
    {
      id: 'ocr-images',
      name: 'Image to Text (OCR)',
      desc: 'Grab editable typography directly from phone photos, receipts, and screenshots.',
      badge: 'Neural WASM',
      icon: ScanText,
      route: '/tool/ocr-images',
    },
    {
      id: 'ocr-scanned-pdf',
      name: 'OCR Scanned PDF',
      desc: 'Transform paper scans and flattened document sheets into selectable text layers.',
      badge: 'Scanned Document OCR',
      icon: FileSearch,
      route: '/tool/ocr-scanned-pdf',
    },
    {
      id: 'png-to-pdf',
      name: 'PNG to PDF',
      desc: 'Convert transparent PNGs or UI mockups cleanly into vector-friendly PDF slides.',
      badge: 'Alpha Channel Support',
      icon: ImageIcon,
      route: '/tool/png-to-pdf',
    },
    {
      id: 'rotate-pdf-pages',
      name: 'Rotate PDF',
      desc: 'Fix orientation issues permanently by rotating 90, 180, or 270 degrees clockwise.',
      badge: 'Selective Rotation',
      icon: RotateCw,
      route: '/tool/rotate-pdf-pages',
    },
    {
      id: 'extract-text',
      name: 'Extract Text',
      desc: 'Extract embedded unicode text from searchable documents into clean text strings.',
      badge: 'Unicode Layer',
      icon: FileText,
      route: '/tool/extract-text',
    },
    {
      id: 'images-to-pdf',
      name: 'Multiple Images to PDF',
      desc: 'Combine mixed photos, drawings, and charts into a single unified PDF binder.',
      badge: 'Full Canvas Grid',
      icon: Layers,
      route: '/tool/images-to-pdf',
    },
  ];

  // Filter tools directory
  const filteredTools = TOOLS.filter((t) => {
    const matchesCat = selectedCategory === 'all' || t.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.categoryLabel.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q));

    return matchesCat && matchesQuery;
  });

  return (
    <div className="w-full flex flex-col">
      {/* Macro Hero Section matching Stitch layout */}
      <section className="relative w-full px-4 sm:px-6 max-w-7xl mx-auto pt-8 pb-12 sm:pt-12 sm:pb-16 overflow-hidden">
        {/* Ambient subtle background glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[340px] bg-gradient-to-b from-blue-100/60 via-blue-50/30 dark:from-blue-900/20 dark:via-transparent to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

        <div className="flex flex-col items-center text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100/80 dark:border-blue-900/60 text-[#00288e] dark:text-blue-400 shadow-xs">
            <Shield className="w-3.5 h-3.5 text-[#00288e] dark:text-blue-400" />
            <span className="text-xs uppercase tracking-wider font-bold">
              Zero-Log Document Architecture
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 font-sans">
            Everything You Need to Work with PDFs
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Convert, compress, merge, split, and manage your documents with simple tools. Built for instant browser processing and high-precision outputs.
          </p>
        </div>

        {/* Active Dropzone */}
        <div className="mt-8 max-w-4xl mx-auto">
          <Dropzone
            multiple={true}
            onFilesSelected={onFilesDropped}
            title="Drag & drop files here"
            subtitle="or select from your local drive to start converting instantly"
            badges={['PDF', 'JPG', 'PNG', 'DOCX', 'XLSX', 'TXT']}
          />

          {/* Trust Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-slate-500 dark:text-slate-400 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>In-browser local processing</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Zero server upload for core tools</span>
            </div>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <span>Private &amp; client-side sanitized</span>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Tools Grid Section */}
      <section className="w-full bg-slate-50/70 dark:bg-slate-900/50 border-y border-slate-200/80 dark:border-slate-800 py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#00288e] dark:text-blue-400 font-bold">
                Instant Utilities
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
                Popular Document Tools
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Direct browser transformations powered by fast in-memory execution and client-side PDF engines.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {popularTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => onNavigate(tool.route)}
                  className="group bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between text-left"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-[#00288e] dark:text-blue-400 group-hover:bg-[#00288e] group-hover:text-white dark:group-hover:bg-blue-600 transition-colors shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#00288e] dark:group-hover:text-blue-400 transition-colors leading-snug">
                        {tool.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {tool.desc}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[#00288e] dark:text-blue-400">{tool.badge}</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-[#00288e] dark:text-blue-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center max-w-2xl mx-auto space-y-2 mb-12">
          <span className="text-xs uppercase tracking-wider text-[#00288e] dark:text-blue-400 font-bold">
            Workflow Simplicity
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Effortless In 3 Fast Steps
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No account required for standard conversions. High-speed execution directly inside your browser session.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Step 1 */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-7xl font-extrabold text-slate-100 dark:text-slate-800/40 absolute -right-2 -bottom-4 select-none leading-none pointer-events-none">
              01
            </span>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-blue-100/70 dark:bg-blue-950/60 text-[#00288e] dark:text-blue-400 flex items-center justify-center mb-4 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5">1. Upload your file</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Drag files directly from your workspace or device. Documents stay strictly inside browser memory.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 relative z-10">
              <Lock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Client-side pre-sanitized</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-7xl font-extrabold text-slate-100 dark:text-slate-800/40 absolute -right-2 -bottom-4 select-none leading-none pointer-events-none">
              02
            </span>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mb-4 shadow-xs">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5">2. Choose settings</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Select geometry presets, page ranges, custom compression, or OCR extraction options.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 relative z-10">
              <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Instant preview updates</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col justify-between relative overflow-hidden">
            <span className="text-7xl font-extrabold text-slate-100 dark:text-slate-800/40 absolute -right-2 -bottom-4 select-none leading-none pointer-events-none">
              03
            </span>
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-xl bg-teal-100/70 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 flex items-center justify-center mb-4 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5">3. Download your result</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Fetch your processed document instantly or save multiple pages as a packaged ZIP archive.
              </p>
            </div>
            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 relative z-10">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Real size reduction metrics</span>
            </div>
          </div>
        </div>
      </section>

      {/* Complete Categorized Directory Section */}
      <section className="w-full bg-slate-50/50 dark:bg-slate-900/40 border-t border-slate-200/80 dark:border-slate-800 py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
            <div>
              <span className="text-xs uppercase tracking-wider text-[#00288e] dark:text-blue-400 font-bold">
                Catalog Matrix
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
                All Document Tools
              </h2>
            </div>

            {/* Live Search Box */}
            <div className="relative w-full md:w-80">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools (e.g. compress, ocr, split)..."
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] shadow-xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          {/* Sticky Category Filter Ribbon */}
          <div className="sticky top-16 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md py-3 -mx-4 px-4 sm:-mx-6 sm:px-6 mb-6 overflow-x-auto border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 min-w-max">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-[#00288e] text-white shadow-sm'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-[#00288e] dark:text-blue-300">
                      {tool.categoryLabel}
                    </span>
                    {tool.status === 'ready' ? (
                      <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded">
                        Ready
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{tool.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  {tool.status === 'ready' ? (
                    <button
                      onClick={() => onNavigate(tool.route)}
                      className="text-xs font-bold text-[#00288e] dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 group"
                    >
                      <span>Use tool</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                      Requires Conversion Engine
                    </span>
                  )}

                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    {tool.acceptedFormats.join(', ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
