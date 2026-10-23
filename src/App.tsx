import React, { useState, useEffect } from 'react';
import { SettingsProvider } from './context/SettingsContext';
import { BatchQueueProvider } from './context/BatchQueueContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StartupScreen } from './components/StartupScreen';
import { SearchModal } from './components/SearchModal';
import { BatchQueueDrawer } from './components/BatchQueueDrawer';
import { HomePage } from './pages/HomePage';
import { AllToolsPage } from './pages/AllToolsPage';
import { ToolStudioPage } from './pages/ToolStudioPage';
import { SettingsPage } from './pages/SettingsPage';
import { TOOLS } from './config/tools';
import { ToolDef } from './types';

export default function App() {
  const [startupDone, setStartupDone] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolDef | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [homeQuickCategory, setHomeQuickCategory] = useState<string>('all');

  // Sync navigation
  const navigate = (path: string, files?: File[]) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentPath(path);

    if (files && files.length > 0) {
      setPendingFiles(files);
    } else {
      setPendingFiles([]);
    }

    if (path.startsWith('/tool/')) {
      const toolId = path.replace('/tool/', '');
      const found = TOOLS.find((t) => t.id === toolId);
      if (found) setActiveTool(found);
    } else if (path.startsWith('/category/')) {
      const catId = path.replace('/category/', '');
      setHomeQuickCategory(catId);
    }
  };

  // Listen to browser popstate if user navigates back
  useEffect(() => {
    const handlePopState = () => {
      // In hash or path
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Global hotkey for quick search (Ctrl+K, Cmd+K, or '/')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle files dropped on Homepage dropzone
  const handleHomeFilesDropped = (files: File[]) => {
    if (files.length === 0) return;
    const first = files[0];
    const isImage =
      first.type.startsWith('image/') ||
      first.name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
    const isPdf =
      first.type === 'application/pdf' || first.name.match(/\.pdf$/i);
    const isTxt =
      first.type === 'text/plain' || first.name.match(/\.(txt|md|log)$/i);

    if (isImage) {
      navigate('/tool/jpg-to-pdf', files);
    } else if (isPdf) {
      navigate('/tool/compress-pdf', files);
    } else if (isTxt) {
      navigate('/tool/txt-to-pdf', files);
    } else {
      navigate('/all-tools', files);
    }
  };

  return (
    <SettingsProvider>
      <BatchQueueProvider>
        {/* Startup Screen on initial app mount */}
        {!startupDone && <StartupScreen onComplete={() => setStartupDone(true)} />}

        <div className="min-h-screen flex flex-col bg-slate-50/40 text-slate-900 font-sans antialiased selection:bg-[#00288e] selection:text-white">
          {/* Main Top Header */}
          <Header
            currentPath={currentPath}
            onNavigate={(path) => navigate(path)}
            onOpenSearch={() => setSearchOpen(true)}
          />

          {/* Main View Area */}
          <main className="flex-1 w-full">
            {currentPath === '/' && (
              <HomePage
                onNavigate={(path) => navigate(path)}
                onFilesDropped={handleHomeFilesDropped}
              />
            )}

            {currentPath === '/all-tools' && (
              <AllToolsPage onNavigate={(path) => navigate(path)} />
            )}

            {currentPath.startsWith('/category/') && (
              <AllToolsPage
                onNavigate={(path) => navigate(path)}
                initialCategory={homeQuickCategory}
              />
            )}

            {currentPath.startsWith('/tool/') && activeTool && (
              <ToolStudioPage
                tool={activeTool}
                initialFiles={pendingFiles}
                onNavigate={(path) => navigate(path)}
              />
            )}

            {currentPath === '/settings' && <SettingsPage />}
          </main>

          {/* Footer */}
          <Footer onNavigate={(path) => navigate(path)} />

          {/* Search Modal */}
          <SearchModal
            isOpen={searchOpen}
            onClose={() => setSearchOpen(false)}
            onSelectTool={(tool) => navigate(tool.route)}
          />

          {/* Batch Queue Drawer */}
          <BatchQueueDrawer />
        </div>
      </BatchQueueProvider>
    </SettingsProvider>
  );
}
