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

const SITE_NAME = 'Lovable PDF Converter';
const SITE_URL = 'https://lovable-pdf-converter.onrender.com';

const updatePageSEO = (path: string, tool: ToolDef | null) => {
  let title = 'Free Online PDF Tools | Compress, Merge & Split PDFs';
  let description =
    'Use free online PDF tools to compress, merge, split, convert, edit, and organize PDF files.';

  if (tool) {
    title = `${tool.name} Online Free | ${SITE_NAME}`;
    description = `${tool.description} ${tool.tagline}`;
  } else if (path === '/all-tools') {
    title = `All PDF Tools Online Free | ${SITE_NAME}`;
    description =
      'Explore free online PDF tools to convert, compress, merge, split, edit, and organize documents.';
  } else if (path.startsWith('/category/')) {
    const category = path.slice('/category/'.length).replace(/-/g, ' ');
    title = `${category.replace(/\b\w/g, (char) => char.toUpperCase())} PDF Tools | ${SITE_NAME}`;
    description = `Explore online PDF tools for ${category}. Convert, organize, and manage your documents.`;
  }

  document.title = title;

  const setMeta = (selector: string, attribute: string, value: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(selector);

    if (!element) {
      element = document.createElement('meta');
      if (selector.includes('name=')) {
        element.name = selector.match(/name="([^"]+)"/)?.[1] ?? '';
      } else if (selector.includes('property=')) {
        element.setAttribute(
          'property',
          selector.match(/property="([^"]+)"/)?.[1] ?? ''
        );
      }
      document.head.appendChild(element);
    }

    element.setAttribute(attribute, value);
  };

  setMeta('meta[name="description"]', 'content', description);
  setMeta('meta[property="og:title"]', 'content', title);
  setMeta('meta[property="og:description"]', 'content', description);

  let canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );

  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }

  canonical.href = `${SITE_URL}${path}`;
};

export default function App() {
  const [startupDone, setStartupDone] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>(
  window.location.pathname || '/'
);
const [searchOpen, setSearchOpen] = useState(false);

const [activeTool, setActiveTool] = useState<ToolDef | null>(() => {
  const pathname = window.location.pathname;
  if (!pathname.startsWith('/tool/')) return null;

  const toolId = pathname.slice('/tool/'.length);
  return TOOLS.find((tool) => tool.id === toolId) ?? null;
});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [homeQuickCategory, setHomeQuickCategory] = useState<string>('all');
  useEffect(() => {
  updatePageSEO(currentPath, activeTool);
}, [currentPath, activeTool]);

  // Sync navigation
  // Sync navigation
const navigate = (path: string, files?: File[]) => {
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (window.location.pathname !== normalizedPath) {
    window.history.pushState({}, '', normalizedPath);
  }

  setCurrentPath(normalizedPath);

  if (files && files.length > 0) {
    setPendingFiles(files);
  } else {
    setPendingFiles([]);
  }

  if (normalizedPath.startsWith('/tool/')) {
    const toolId = normalizedPath.slice('/tool/'.length);
    const found = TOOLS.find((tool) => tool.id === toolId);
    setActiveTool(found ?? null);
  } else if (normalizedPath.startsWith('/category/')) {
    const catId = normalizedPath.slice('/category/'.length);
    setHomeQuickCategory(catId);
    setActiveTool(null);
  } else {
    setActiveTool(null);
  }
};

  // Listen to browser popstate if user navigates back
  useEffect(() => {
  const handlePopState = () => {
    const path = window.location.pathname || '/';

    setCurrentPath(path);
    setPendingFiles([]);

    if (path.startsWith('/tool/')) {
      const toolId = path.slice('/tool/'.length);
      const found = TOOLS.find((tool) => tool.id === toolId);
      setActiveTool(found ?? null);
    } else {
      setActiveTool(null);

      if (path.startsWith('/category/')) {
        setHomeQuickCategory(path.slice('/category/'.length));
      }
    }
  };

  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
  };
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
