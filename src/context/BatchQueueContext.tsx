import React, { createContext, useContext, useState } from 'react';
import { BatchQueueItem } from '../types';
import { downloadFile, downloadZip } from '../utils/download';

interface BatchQueueContextType {
  items: BatchQueueItem[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  addItem: (item: Omit<BatchQueueItem, 'id' | 'createdAt'>) => void;
  updateItem: (id: string, updates: Partial<BatchQueueItem>) => void;
  removeItem: (id: string) => void;
  clearQueue: () => void;
  downloadItem: (id: string) => void;
  downloadAllCompleted: () => void;
}

const BatchQueueContext = createContext<BatchQueueContextType | undefined>(undefined);

export const BatchQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<BatchQueueItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const addItem = (item: Omit<BatchQueueItem, 'id' | 'createdAt'>) => {
    const newItem: BatchQueueItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      createdAt: Date.now(),
    };
    setItems((prev) => [newItem, ...prev]);
  };

  const updateItem = (id: string, updates: Partial<BatchQueueItem>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...updates } : it))
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const clearQueue = () => {
    setItems([]);
  };

  const downloadItem = (id: string) => {
    const it = items.find((i) => i.id === id);
    if (it && it.outputBlob && it.outputName) {
      downloadFile(it.outputBlob, it.outputName);
    }
  };

  const downloadAllCompleted = async () => {
    const completed = items.filter((i) => i.status === 'completed' && i.outputBlob);
    if (completed.length === 1) {
      downloadFile(completed[0].outputBlob!, completed[0].outputName || 'converted_document.pdf');
    } else if (completed.length > 1) {
      const files = completed.map((c) => ({
        name: c.outputName || `${c.file.name}_converted.pdf`,
        data: c.outputBlob!,
      }));
      await downloadZip(files, 'lovable_batch_output.zip');
    }
  };

  return (
    <BatchQueueContext.Provider
      value={{
        items,
        isOpen,
        setIsOpen,
        addItem,
        updateItem,
        removeItem,
        clearQueue,
        downloadItem,
        downloadAllCompleted,
      }}
    >
      {children}
    </BatchQueueContext.Provider>
  );
};

export const useBatchQueue = () => {
  const ctx = useContext(BatchQueueContext);
  if (!ctx) throw new Error('useBatchQueue must be used within BatchQueueProvider');
  return ctx;
};
