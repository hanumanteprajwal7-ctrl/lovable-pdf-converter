import React, { useState } from 'react';
import {
  Search,
  Menu,
  X,
  Settings as SettingsIcon,
  Package,
  FileText,
  ArrowRight,
  Sun,
  Moon,
} from 'lucide-react';
import { useBatchQueue } from '../context/BatchQueueContext';
import { useSettings } from '../context/SettingsContext';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenSearch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentPath, onNavigate, onOpenSearch }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { items, setIsOpen: setQueueOpen } = useBatchQueue();
  const { isDark, toggleTheme } = useSettings();

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
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Lockup */}
        <div className="flex items-center gap-8 shrink-0">
          <button
            onClick={() => handleLinkClick('/')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            aria-label="Lovable PDF Converter Home"
          >
            <div className="w-9 h-9 rounded-xl bg-[#00288e] dark:bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-800 dark:group-hover:bg-blue-500 transition-colors">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none font-sans group-hover:text-[#00288e] dark:group-hover:text-blue-400 transition-colors">
                Lovable PDF Converter
              </span>
              <span className="text-[11px] text-slate-400 dark:text-slate-400 font-medium leading-none mt-1">
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
                      ? 'bg-blue-50 dark:bg-blue-950/70 text-[#00288e] dark:text-blue-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/60'
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
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            title="Search all tools (Ctrl+K)"
            aria-label="Search tools"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
              /
            </span>
          </button>

          {/* Theme Toggle Button (Light/Dark Mode) */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 animate-[fadeIn_0.2s_ease-out]" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600 animate-[fadeIn_0.2s_ease-out]" />
            )}
          </button>

          {/* Working Batch Queue Trigger */}
          <button
            onClick={() => setQueueOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative"
            title="Open conversion batch queue"
          >
            <Package className="w-4 h-4 text-[#00288e] dark:text-blue-400" />
            <span className="hidden md:inline">Batch Queue</span>
            {items.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-[#00288e] dark:bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {items.length}
              </span>
            )}
          </button>

          {/* Settings Shortcut */}
          <button
            onClick={() => handleLinkClick('/settings')}
            className={`p-2 rounded-lg transition-colors ${
              currentPath === '/settings'
                ? 'bg-blue-50 dark:bg-blue-950/70 text-[#00288e] dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="App Settings & Defaults"
            aria-label="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* Convert Now Primary CTA */}
          <button
            onClick={() => handleLinkClick('/all-tools')}
            className="hidden sm:inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#00288e] dark:bg-blue-600 text-white text-xs font-semibold hover:bg-blue-800 dark:hover:bg-blue-500 transition-all active:scale-[0.98] shadow-sm shadow-blue-900/10"
          >
            <span>All Tools</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-6 space-y-1 shadow-lg">
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
                    ? 'bg-blue-50 dark:bg-blue-950/70 text-[#00288e] dark:text-blue-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
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
