'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DownloadButton } from '../DownloadButton';
import { FileUploader } from '../FileUploader';

export interface OverlayPDFsToolProps {
  className?: string;
}

type OverlayFit = 'stretch' | 'contain';

export function OverlayPDFsTool({ className = '' }: OverlayPDFsToolProps) {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [overlayFile, setOverlayFile] = useState<File | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [repeatOverlay, setRepeatOverlay] = useState(true);
  const [opacity, setOpacity] = useState(0.65);
  const [fitMode, setFitMode] = useState<OverlayFit>('contain');

  const filename = useMemo(() => {
    if (!baseFile) return 'overlay.pdf';
    const stem = baseFile.name.replace(/\.pdf$/i, '');
    return `${stem}-overlay.pdf`;
  }, [baseFile]);

  const onBaseSelected = useCallback((files: File[]) => {
    setBaseFile(files[0] ?? null);
    setResult(null);
    setError(null);
  }, []);

  const onOverlaySelected = useCallback((files: File[]) => {
    setOverlayFile(files[0] ?? null);
    setResult(null);
    setError(null);
  }, []);

  const handleOverlay = useCallback(async () => {
    if (!baseFile || !overlayFile) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const [baseBytes, overlayBytes] = await Promise.all([
        baseFile.arrayBuffer(),
        overlayFile.arrayBuffer(),
      ]);

      const output = await PDFDocument.load(baseBytes);
      const overlaySource = await PDFDocument.load(overlayBytes);
      const basePages = output.getPages();
      const overlayPages = overlaySource.getPages();

      if (basePages.length === 0 || overlayPages.length === 0) {
        throw new Error('Both PDFs need at least one page.');
      }

      for (let index = 0; index < basePages.length; index += 1) {
        const basePage = basePages[index];
        const overlayPage = overlayPages[repeatOverlay ? index % overlayPages.length : Math.min(index, overlayPages.length - 1)];
        if (!repeatOverlay && index >= overlayPages.length) {
          break;
        }

        const embeddedPage = await output.embedPage(overlayPage);
        const { width: targetWidth, height: targetHeight } = basePage.getSize();

        if (fitMode === 'stretch') {
          basePage.drawPage(embeddedPage, {
            x: 0,
            y: 0,
            width: targetWidth,
            height: targetHeight,
            opacity,
          });
          continue;
        }

        const scale = Math.min(targetWidth / overlayPage.getWidth(), targetHeight / overlayPage.getHeight());
        const width = overlayPage.getWidth() * scale;
        const height = overlayPage.getHeight() * scale;

        basePage.drawPage(embeddedPage, {
          x: (targetWidth - width) / 2,
          y: (targetHeight - height) / 2,
          width,
          height,
          opacity,
        });
      }

      const bytes = await output.save();
      const normalizedBytes = new Uint8Array(bytes);
      setResult(new Blob([normalizedBytes.buffer.slice(0)], { type: 'application/pdf' }));
    } catch (processingError) {
      console.error('Overlay PDFs failed', processingError);
      setError(processingError instanceof Error ? processingError.message : 'Failed to overlay PDFs.');
    } finally {
      setIsProcessing(false);
    }
  }, [baseFile, overlayFile, fitMode, opacity, repeatOverlay]);

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Base PDF</h3>
          {!baseFile ? (
            <FileUploader
              accept={['application/pdf', '.pdf']}
              multiple={false}
              maxFiles={1}
              onFilesSelected={onBaseSelected}
              label="Upload base PDF"
              description="This document stays underneath. The overlay will be applied on top of each page."
            />
          ) : (
            <Card variant="outlined">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{baseFile.name}</p>
                  <p className="text-sm text-[hsl(var(--color-muted-foreground))]">
                    {(baseFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setBaseFile(null)}>
                  Replace
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Overlay PDF</h3>
          {!overlayFile ? (
            <FileUploader
              accept={['application/pdf', '.pdf']}
              multiple={false}
              maxFiles={1}
              onFilesSelected={onOverlaySelected}
              label="Upload overlay PDF"
              description="Use this for letterheads, backgrounds, stamps, or a second document layer."
            />
          ) : (
            <Card variant="outlined">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{overlayFile.name}</p>
                  <p className="text-sm text-[hsl(var(--color-muted-foreground))]">
                    {(overlayFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button variant="ghost" onClick={() => setOverlayFile(null)}>
                  Replace
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      <Card variant="outlined" className="space-y-5">
        <div className="grid gap-5 md:grid-cols-3">
          <label className="space-y-2 text-sm">
            <span className="font-medium">Fit mode</span>
            <select
              value={fitMode}
              onChange={(event) => setFitMode(event.target.value as OverlayFit)}
              className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--color-border))] bg-white px-3 py-2"
            >
              <option value="contain">Contain within page</option>
              <option value="stretch">Stretch to full page</option>
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium">Opacity</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(event) => setOpacity(Number(event.target.value))}
              className="w-full"
            />
            <span className="text-xs text-[hsl(var(--color-muted-foreground))]">
              {(opacity * 100).toFixed(0)}%
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[hsl(var(--color-border))] p-3 text-sm">
            <input
              type="checkbox"
              checked={repeatOverlay}
              onChange={(event) => setRepeatOverlay(event.target.checked)}
              className="h-4 w-4"
            />
            <span>
              Repeat overlay pages across the full base document
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            onClick={handleOverlay}
            disabled={!baseFile || !overlayFile || isProcessing}
            loading={isProcessing}
          >
            Overlay PDFs
          </Button>
          {result && (
            <DownloadButton file={result} filename={filename} label="Download overlaid PDF" />
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

export default OverlayPDFsTool;
