import React from 'react';
import { X, Download, Trash2, CheckCircle2, AlertCircle, Loader2, FileText, Package } from 'lucide-react';
import { useBatchQueue } from '../context/BatchQueueContext';
import { formatBytes } from '../utils/download';

export const BatchQueueDrawer: React.FC = () => {
  const { items, isOpen, setIsOpen, removeItem, clearQueue, downloadItem, downloadAllCompleted } =
    useBatchQueue();

  if (!isOpen) return null;

  const completedCount = items.filter((i) => i.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/30 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-[slideInRight_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#00288e]" />
            <h2 className="text-base font-bold text-slate-900">Batch Processing Queue</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-[#00288e]">
              {items.length}
            </span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Package className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-semibold text-slate-700">Queue is currently empty</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                When you process batches or conversions across tools, files will appear here with instant download actions.
              </p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col gap-2 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                      <FileText className="w-4 h-4 text-[#00288e]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {item.toolName} · {formatBytes(item.file.size)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-slate-400 hover:text-red-600 p-1 rounded"
                    title="Remove from queue"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Status indicator */}
                <div className="flex items-center justify-between text-xs pt-1">
                  {item.status === 'processing' && (
                    <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Processing ({item.progress}%)
                    </span>
                  )}
                  {item.status === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 text-teal-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      Ready {item.outputSize ? `(${formatBytes(item.outputSize)})` : ''}
                    </span>
                  )}
                  {item.status === 'queued' && (
                    <span className="text-slate-500 font-medium">Queued</span>
                  )}
                  {item.status === 'error' && (
                    <span className="inline-flex items-center gap-1.5 text-red-600 font-medium truncate">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {item.errorMessage || 'Failed'}
                    </span>
                  )}

                  {item.status === 'completed' && (
                    <button
                      onClick={() => downloadItem(item.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-[#00288e] text-white hover:bg-blue-800 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer actions */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <button
              onClick={clearQueue}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Clear Queue
            </button>

            {completedCount > 0 && (
              <button
                onClick={downloadAllCompleted}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#00288e] hover:bg-blue-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Download All ({completedCount})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
