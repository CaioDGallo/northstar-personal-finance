'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type Props = {
  onFileContent: (content: string) => void;
  accept?: string;
};

export function FileDropzone({ onFileContent, accept = '.csv' }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('fileDropzone');

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.csv')) {
        setError(t('invalidFileType'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onFileContent(content);
        setError(null);
      };
      reader.onerror = () => setError(t('failedToRead'));
      reader.readAsText(file);
    },
    [onFileContent, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center transition',
        isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-300 dark:border-gray-700'
      )}
    >
      <input
        type="file"
        accept={accept}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
        id="file-input"
      />
      <label htmlFor="file-input" className="cursor-pointer">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t('dragAndDropText')}
        </p>
      </label>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}
