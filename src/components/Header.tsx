import React, { useState } from 'react';
import { Search, Menu, X, Settings as SettingsIcon, Package, FileText, ArrowRight } from 'lucide-react';
import { useBatchQueue } from '../context/BatchQueueContext';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate, onOpenSearch }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { items, setIsOpen: setQueueOpen } = useBatchQueue();

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'All Tools', path: '/all-tools' },
    { label: 'Convert PDF', path: '/category/convert-from' },
    { label: 'Convert to PDF', path: '/category/convert-to' },
    { label: 'Compress PDF', path: '/tool/compress-pdf' },
    { label: 'OCR & Extract', path: '/category/ocr' },
    { label: 'Edit PDF', path: '/category/edit' },
    { label: 'Settings', path: '/settings' },
  ];

  const handleLinkClick = (path: string) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-8 shrink-0">
          <button
            onClick={() => handleLinkClick('/')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-xl bg-[#00288e] flex items-center justify-center text-white shadow-sm group-hover:bg-blue-800 transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-slate-900 tracking-tight leading-none font-sans group-hover:text-[#00288e] transition-colors">
                Lovable PDF Converter
              </span>
              <span className="text-[11px] text-slate-400 font-medium leading-none mt-1">
                Your Documents, Simplified.
              </span>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-1 text-sm font-medium">
            {navLinks.map((link) => {
              const isActive =
                currentPath === link.path ||
                (link.path !== '/' && currentPath.startsWith(link.path));
              return (
                <button
                  key={link.path}
                  onClick={() => handleLinkClick(link.path)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-[#00288e] font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick Search */}
          <button
            onClick={onOpenSearch}
            className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            title="Search all tools (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
              /
            </span>
          </button>

          {/* Working Batch Queue Trigger */}
          <button
            onClick={() => setQueueOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors relative"
            title="Open conversion batch queue"
          >
            <Package className="w-4 h-4 text-[#00288e]" />
            <span className="hidden md:inline">Batch Queue</span>
            {items.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#00288e] text-white text-[10px] flex items-center justify-center font-bold">
                {items.length}
              </span>
            )}
          </button>

          {/* Settings Shortcut */}
          <button
            onClick={() => handleLinkClick('/settings')}
            className={`p-2 rounded-lg transition-colors ${
              currentPath === '/settings'
                ? 'bg-blue-50 text-[#00288e]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            title="App Settings & Defaults"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Convert Now Primary CTA */}
          <button
            onClick={() => handleLinkClick('/all-tools')}
            className="hidden sm:inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#00288e] text-white text-xs font-semibold hover:bg-blue-800 transition-all active:scale-[0.98] shadow-sm shadow-blue-900/10"
          >
            <span>All Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-6 space-y-1 shadow-lg">
          {navLinks.map((link) => {
            const isActive =
              currentPath === link.path ||
              (link.path !== '/' && currentPath.startsWith(link.path));
            return (
              <button
                key={link.path}
                onClick={() => handleLinkClick(link.path)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-[#00288e] font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
