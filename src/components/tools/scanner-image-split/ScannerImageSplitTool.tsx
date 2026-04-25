'use client';

import React, { useCallback, useMemo, useState } from 'react';
import JSZip from 'jszip';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DownloadButton } from '../DownloadButton';
import { FileUploader } from '../FileUploader';

export interface ScannerImageSplitToolProps {
  className?: string;
}

type SplitMode = 'auto' | 'vertical' | 'horizontal';

type CropRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load image ${file.name}`));
    };
    image.src = url;
  });
}

function clampRegion(region: CropRegion, width: number, height: number): CropRegion {
  return {
    x: Math.max(0, Math.floor(region.x)),
    y: Math.max(0, Math.floor(region.y)),
    width: Math.max(1, Math.min(width - region.x, Math.floor(region.width))),
    height: Math.max(1, Math.min(height - region.y, Math.floor(region.height))),
  };
}

export function ScannerImageSplitTool({ className = '' }: ScannerImageSplitToolProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [splitMode, setSplitMode] = useState<SplitMode>('auto');
  const [margin, setMargin] = useState(12);
  const [whitespaceThreshold, setWhitespaceThreshold] = useState(245);

  const outputName = useMemo(() => {
    if (files.length === 1) {
      return `${files[0].name.replace(/\.[^.]+$/, '')}-split.zip`;
    }
    return 'scanner-image-split.zip';
  }, [files]);

  const splitImage = useCallback(
    async (file: File, zip: JSZip) => {
      const image = await loadImage(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas is not available in this browser.');
      }

      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.drawImage(image, 0, 0);

      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rowInk = new Array(height).fill(0);
      const colInk = new Array(width).fill(0);

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
          if (brightness < whitespaceThreshold) {
            rowInk[y] += 1;
            colInk[x] += 1;
          }
        }
      }

      const findSegments = (counts: number[], minInk: number) => {
        const segments: Array<{ start: number; end: number }> = [];
        let start = -1;

        for (let index = 0; index < counts.length; index += 1) {
          if (counts[index] > minInk && start === -1) start = index;
          if ((counts[index] <= minInk || index === counts.length - 1) && start !== -1) {
            const end = counts[index] > minInk && index === counts.length - 1 ? index : index - 1;
            if (end - start > 20) {
              segments.push({ start, end });
            }
            start = -1;
          }
        }

        return segments;
      };

      const orientation = splitMode === 'auto'
        ? width >= height ? 'vertical' : 'horizontal'
        : splitMode;

      const minInk = orientation === 'vertical'
        ? Math.max(8, Math.floor(height * 0.03))
        : Math.max(8, Math.floor(width * 0.03));

      const segments = orientation === 'vertical'
        ? findSegments(colInk, minInk).map(({ start, end }) => ({
            x: Math.max(0, start - margin),
            y: 0,
            width: Math.min(width, end - start + 1 + margin * 2),
            height,
          }))
        : findSegments(rowInk, minInk).map(({ start, end }) => ({
            x: 0,
            y: Math.max(0, start - margin),
            width,
            height: Math.min(height, end - start + 1 + margin * 2),
          }));

      const finalRegions = segments.length >= 2
        ? segments
        : [
            {
              x: margin,
              y: margin,
              width: width - margin * 2,
              height: height - margin * 2,
            },
          ];

      await Promise.all(
        finalRegions.map(async (region, index) => {
          const safeRegion = clampRegion(region, width, height);
          const fragmentCanvas = document.createElement('canvas');
          fragmentCanvas.width = safeRegion.width;
          fragmentCanvas.height = safeRegion.height;
          const fragmentContext = fragmentCanvas.getContext('2d');
          if (!fragmentContext) return;

          fragmentContext.drawImage(
            canvas,
            safeRegion.x,
            safeRegion.y,
            safeRegion.width,
            safeRegion.height,
            0,
            0,
            safeRegion.width,
            safeRegion.height
          );

          const blob = await new Promise<Blob | null>((resolve) => fragmentCanvas.toBlob(resolve, 'image/png'));
          if (!blob) return;

          zip.file(
            `${file.name.replace(/\.[^.]+$/, '')}-part-${index + 1}.png`,
            blob
          );
        })
      );
    },
    [margin, splitMode, whitespaceThreshold]
  );

  const handleProcess = useCallback(async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const zip = new JSZip();
      for (const file of files) {
        // Sequential on purpose to avoid large in-browser memory spikes.
        // eslint-disable-next-line no-await-in-loop
        await splitImage(file, zip);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      setResult(blob);
    } catch (processingError) {
      console.error('Scanner split failed', processingError);
      setError(processingError instanceof Error ? processingError.message : 'Failed to split the scanned images.');
    } finally {
      setIsProcessing(false);
    }
  }, [files, splitImage]);

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      <FileUploader
        accept={['image/*', '.jpg', '.jpeg', '.png', '.webp', '.bmp']}
        multiple
        maxFiles={20}
        onFilesSelected={(selectedFiles) => {
          setFiles(selectedFiles);
          setResult(null);
          setError(null);
        }}
        label="Upload scanned images"
        description="Drop scans that contain multiple receipts, cards, or document halves. PDFCraft will detect the content bands and export each segment."
      />

      {files.length > 0 && (
        <Card variant="outlined" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {files.map((file) => (
              <span key={file.name} className="rounded-full bg-[hsl(var(--color-secondary)/0.5)] px-3 py-1 text-xs font-medium">
                {file.name}
              </span>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <label className="space-y-2 text-sm">
              <span className="font-medium">Split direction</span>
              <select
                value={splitMode}
                onChange={(event) => setSplitMode(event.target.value as SplitMode)}
                className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--color-border))] bg-white px-3 py-2"
              >
                <option value="auto">Auto detect</option>
                <option value="vertical">Split vertical bands</option>
                <option value="horizontal">Split horizontal bands</option>
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Margin ({margin}px)</span>
              <input
                type="range"
                min="0"
                max="40"
                value={margin}
                onChange={(event) => setMargin(Number(event.target.value))}
                className="w-full"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium">Whitespace threshold ({whitespaceThreshold})</span>
              <input
                type="range"
                min="200"
                max="252"
                value={whitespaceThreshold}
                onChange={(event) => setWhitespaceThreshold(Number(event.target.value))}
                className="w-full"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" onClick={handleProcess} disabled={isProcessing || files.length === 0} loading={isProcessing}>
              Split scanned images
            </Button>
            {result && (
              <DownloadButton file={result} filename={outputName} label="Download split images ZIP" />
            )}
          </div>
        </Card>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

export default ScannerImageSplitTool;
