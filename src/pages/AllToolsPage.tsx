import React, { useState } from 'react';
import { Search, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { TOOLS, CATEGORIES } from '../config/tools';
import { ToolDef } from '../types';

interface AllToolsPageProps {
  onNavigate: (path: string) => void;
  initialCategory?: string;
}

export const AllToolsPage: React.FC<AllToolsPageProps> = ({
  onNavigate,
  initialCategory = 'all',
}) => {
  const [selectedCat, setSelectedCat] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = TOOLS.filter((t) => {
    const matchesCat = selectedCat === 'all' || t.category === selectedCat;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-[#00288e] font-bold">
            Catalog Matrix
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            All Document Tools
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Browse our full suite of 28 conversion, organization, compression, and text extraction utilities.
          </p>
        </div>

        {/* Live Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search all 28 tools..."
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00288e]/20 focus:border-[#00288e] shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCat === cat.id
                ? 'bg-[#00288e] text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tool) => (
          <div
            key={tool.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-[#00288e]">
                  {tool.categoryLabel}
                </span>

                {tool.status === 'ready' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded">
                    <CheckCircle2 className="w-3 h-3 text-teal-600" />
                    Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Coming Soon
                  </span>
                )}
              </div>

              <h3 className="text-base font-bold text-slate-900">{tool.name}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {tool.description}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
              {tool.status === 'ready' ? (
                <button
                  onClick={() => onNavigate(tool.route)}
                  className="text-xs font-bold text-[#00288e] hover:text-blue-800 flex items-center gap-1 group"
                >
                  <span>Use tool</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
              ) : (
                <span className="text-xs text-slate-400 font-medium">
                  Requires Server Engine
                </span>
              )}

              <span className="text-[11px] text-slate-400 font-mono">
                {tool.acceptedFormats.join(', ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
