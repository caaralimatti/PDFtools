'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileUploader } from '../FileUploader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface PDFEditorWorkbenchProps {
  className?: string;
  title: string;
  description: string;
  instructions: string[];
  primaryControlId?: string;
  visibleControlIds?: string[];
  viewerTitle: string;
}

const DEFAULT_VISIBLE_CONTROLS = ['editorHighlight', 'editorFreeText', 'editorInk', 'editorStamp'];

export function PDFEditorWorkbench({
  className = '',
  title,
  description,
  instructions,
  primaryControlId,
  visibleControlIds = DEFAULT_VISIBLE_CONTROLS,
  viewerTitle,
}: PDFEditorWorkbenchProps) {
  const t = useTranslations('common');
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const allowedControls = useMemo(
    () => new Set([...visibleControlIds, 'editorModeButtons']),
    [visibleControlIds]
  );

  const handleFilesSelected = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setError(null);
      setPdfUrl(URL.createObjectURL(selectedFile));
      setIsEditorReady(false);
    }
  }, []);

  const handleUploadError = useCallback((errorMessage: string) => {
    setError(errorMessage);
  }, []);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const configureViewer = useCallback(() => {
    try {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc) return;

      const downloadBtn = doc.getElementById('download');
      const secondaryDownloadBtn = doc.getElementById('secondaryDownload');
      if (downloadBtn) (downloadBtn as HTMLElement).style.display = 'none';
      if (secondaryDownloadBtn) (secondaryDownloadBtn as HTMLElement).style.display = 'none';

      const toolbarIds = ['editorHighlight', 'editorFreeText', 'editorInk', 'editorStamp'];
      for (const controlId of toolbarIds) {
        const control = doc.getElementById(controlId) as HTMLButtonElement | null;
        if (!control) continue;
        if (allowedControls.has(controlId)) {
          control.disabled = false;
          control.hidden = false;
          control.style.display = '';
        } else {
          control.hidden = true;
          control.style.display = 'none';
        }
      }

      const editorModeButtons = doc.getElementById('editorModeButtons');
      if (editorModeButtons) {
        (editorModeButtons as HTMLElement).style.display = 'flex';
      }

      if (primaryControlId) {
        window.setTimeout(() => {
          const primaryControl = doc.getElementById(primaryControlId) as HTMLButtonElement | null;
          primaryControl?.click();
        }, 300);
      }
    } catch (viewerError) {
      console.warn('Could not fully configure embedded editor', viewerError);
    }
  }, [allowedControls, primaryControlId]);

  const handleIframeLoad = useCallback(() => {
    setTimeout(() => {
      setIsEditorReady(true);
      configureViewer();
    }, 900);
  }, [configureViewer]);

  const handleClear = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setFile(null);
    setPdfUrl(null);
    setError(null);
    setIsEditorReady(false);
  }, [pdfUrl]);

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {!file && (
        <FileUploader
          accept={['application/pdf', '.pdf']}
          multiple={false}
          maxFiles={1}
          onFilesSelected={handleFilesSelected}
          onError={handleUploadError}
          label={title}
          description={description}
        />
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {file && pdfUrl && (
        <div className="space-y-4">
          <Card variant="outlined" size="sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <svg className="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                  <path d="M14 2v6h6" fill="white" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--color-foreground))]">{file.name}</p>
                  <p className="text-xs text-[hsl(var(--color-muted-foreground))]">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                {t('buttons.clear') || 'Clear'}
              </Button>
            </div>
          </Card>

          <Card variant="outlined" className="border-blue-200 bg-blue-50">
            <div className="space-y-2 text-sm text-blue-800">
              <p className="font-semibold">{title}</p>
              <ol className="list-decimal space-y-1 pl-5 text-blue-700">
                {instructions.map((instruction) => (
                  <li key={instruction}>{instruction}</li>
                ))}
              </ol>
            </div>
          </Card>

          <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[hsl(var(--color-border))] bg-gray-100">
            <iframe
              ref={iframeRef}
              src={`/pdfjs-annotation-viewer/web/vercel-viewer/?file=${encodeURIComponent(pdfUrl)}`}
              className="h-[720px] w-full border-0"
              title={viewerTitle}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
              onLoad={handleIframeLoad}
            />
            {!isEditorReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <div className="text-center">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-[hsl(var(--color-primary))]" />
                  <p className="text-sm text-[hsl(var(--color-muted-foreground))]">
                    {t('status.loading') || 'Loading...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PDFEditorWorkbench;
