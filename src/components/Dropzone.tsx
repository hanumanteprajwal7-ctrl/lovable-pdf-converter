import React, { useState, useRef } from 'react';
import { UploadCloud, Plus, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { formatBytes } from '../utils/download';

interface DropzoneProps {
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  onFilesSelected: (files: File[]) => void;
  title?: string;
  subtitle?: string;
  badges?: string[];
  className?: string;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  accept,
  multiple = false,
  maxSizeMb = 100,
  onFilesSelected,
  title = 'Drag & drop files here',
  subtitle = 'or select from your local device',
  badges = ['PDF', 'JPG', 'PNG', 'DOCX', 'XLSX', 'TXT'],
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndPassFiles = (fileList: FileList | File[]) => {
    setErrorMessage(null);
    const validFiles: File[] = [];
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    const filesArray = Array.from(fileList);

    if (filesArray.length === 0) return;

    for (const file of filesArray) {
      if (file.size > maxSizeBytes) {
        setErrorMessage(`"${file.name}" exceeds the ${maxSizeMb}MB maximum file limit.`);
        return;
      }

      // Check extension if accept is specified
      if (accept) {
        const allowedExtensions = accept
          .split(',')
          .map((ext) => ext.trim().toLowerCase());
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        const mime = file.type.toLowerCase();

        const matches = allowedExtensions.some((allowed) => {
          if (allowed.startsWith('.')) return ext === allowed;
          if (allowed.includes('*')) {
            const prefix = allowed.split('/')[0];
            return mime.startsWith(prefix);
          }
          return mime === allowed;
        });

        if (!matches) {
          setErrorMessage(
            `"${file.name}" is not a supported file type (${accept}).`
          );
          return;
        }
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesSelected(multiple ? validFiles : [validFiles[0]]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFiles(e.dataTransfer.files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFiles(e.target.files);
      // Reset input value so same file can be selected again
      e.target.value = '';
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Interactive Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group bg-white rounded-2xl p-8 sm:p-12 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center min-h-[260px] border-2 border-dashed ${
          isDragging
            ? 'border-[#00288e] bg-blue-50/40 shadow-md'
            : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50/50 shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#00288e] flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-xs mb-4">
          <UploadCloud className="w-8 h-8" />
        </div>

        {/* Headline */}
        <p className="text-lg font-bold text-slate-900 tracking-tight font-sans">
          {title}
        </p>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          {subtitle}
        </p>

        {/* Action Button */}
        <div className="mt-5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-[#00288e] text-white text-sm font-semibold shadow-sm group-hover:bg-blue-800 transition-colors">
            <Plus className="w-4 h-4" />
            <span>Select {multiple ? 'Files' : 'File'}</span>
          </span>
        </div>

        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 max-w-lg">
            {badges.map((b) => (
              <span
                key={b}
                className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-[#00288e]"
              >
                {b}
              </span>
            ))}
            <span className="text-xs text-slate-400 pl-1">
              · Up to {maxSizeMb}MB
            </span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
