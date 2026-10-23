import React, { useState } from 'react';
import { Settings as SettingsIcon, ShieldCheck, Trash2, Check, RefreshCw } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';

export const SettingsPage: React.FC = () => {
  const { settings, updateSetting, resetSettings } = useSettings();
  const [resetNotice, setResetNotice] = useState(false);

  const handleReset = () => {
    resetSettings();
    setResetNotice(true);
    setTimeout(() => setResetNotice(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#00288e] flex items-center justify-center">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Settings &amp; Preferences
          </h1>
          <p className="text-xs text-slate-500">
            Customize default tool parameters, geometry presets, and compression behaviors.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs flex flex-col gap-6">
        {/* Default Page Geometry */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <span className="text-sm font-bold text-slate-900">Default PDF Page Geometry</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard paper dimensions used when converting images or text into PDFs.
            </p>
          </div>
          <select
            value={settings.defaultPageSize}
            onChange={(e: any) => updateSetting('defaultPageSize', e.target.value)}
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00288e] min-w-[160px]"
          >
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="US-Letter">US Letter (8.5 × 11 in)</option>
            <option value="Fit">Fit to Image Size</option>
            <option value="A3">A3 (297 × 420 mm)</option>
          </select>
        </div>

        {/* Default Image Output Format */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <span className="text-sm font-bold text-slate-900">Default Image Format</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Target image encoding format when exporting pages from PDFs.
            </p>
          </div>
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => updateSetting('defaultImageFormat', 'jpg')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.defaultImageFormat === 'jpg'
                  ? 'bg-white text-[#00288e] shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              JPG (Smaller size)
            </button>
            <button
              onClick={() => updateSetting('defaultImageFormat', 'png')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.defaultImageFormat === 'png'
                  ? 'bg-white text-[#00288e] shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              PNG (Lossless)
            </button>
          </div>
        </div>

        {/* Default DPI Resolution */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <span className="text-sm font-bold text-slate-900">Default Rendering Resolution (DPI)</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Raster resolution used for rendering PDF sheets and image compression.
            </p>
          </div>
          <select
            value={settings.defaultDpi}
            onChange={(e) => updateSetting('defaultDpi', parseInt(e.target.value, 10))}
            className="h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#00288e] min-w-[160px]"
          >
            <option value={72}>72 DPI (Web/Email)</option>
            <option value={96}>96 DPI (Screen Read)</option>
            <option value={150}>150 DPI (Recommended)</option>
            <option value={200}>200 DPI (E-Book)</option>
            <option value={300}>300 DPI (Print Proof)</option>
          </select>
        </div>

        {/* Theme Preference */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <span className="text-sm font-bold text-slate-900">Application Theme</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Visual styling mode for high-contrast document operations.
            </p>
          </div>
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => updateSetting('theme', 'light')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.theme === 'light'
                  ? 'bg-white text-[#00288e] shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              Light
            </button>
            <button
              onClick={() => updateSetting('theme', 'dark')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                settings.theme === 'dark'
                  ? 'bg-white text-[#00288e] shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              Dark
            </button>
          </div>
        </div>

        {/* Clear Preferences */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <span className="text-sm font-bold text-slate-900">Reset Local Preferences</span>
            <p className="text-xs text-slate-500 mt-0.5">
              Restores factory default geometries and clears localStorage config.
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors flex items-center gap-1.5 w-fit"
          >
            {resetNotice ? <Check className="w-3.5 h-3.5 text-red-600" /> : <Trash2 className="w-3.5 h-3.5" />}
            <span>{resetNotice ? 'Preferences Reset' : 'Reset Defaults'}</span>
          </button>
        </div>
      </div>

      {/* Privacy Architecture Notice */}
      <div className="bg-blue-50/60 rounded-2xl border border-blue-100 p-6 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-[#00288e] shrink-0 mt-0.5" />
        <div className="text-xs text-slate-700 leading-relaxed space-y-2">
          <p className="font-bold text-slate-900 text-sm">Privacy &amp; Security Architecture</p>
          <p>
            Lovable PDF Converter is built on a client-side execution paradigm. Your files are processed in-memory directly in your browser using WebAssembly and client JavaScript sandboxes. Documents are never transmitted to external cloud servers or stored in persistent storage.
          </p>
          <p className="text-slate-500">
            Preferences stored in your browser's localStorage are strictly limited to non-sensitive configuration keys (e.g. default page size, DPI preferences). Document contents and images are never saved to localStorage.
          </p>
        </div>
      </div>
    </div>
  );
};
