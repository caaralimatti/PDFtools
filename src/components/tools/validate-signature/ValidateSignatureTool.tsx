'use client';

import React, { useCallback, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FileUploader } from '../FileUploader';

export interface ValidateSignatureToolProps {
  className?: string;
}

interface SignatureFinding {
  fieldName: string;
  hasValue: boolean;
  byteRangeCount: number;
  hasContents: boolean;
}

interface ValidationReport {
  filename: string;
  pageCount: number;
  signatureFields: SignatureFinding[];
  rawByteRangeMatches: number;
  rawContentsMatches: number;
  summary: string;
}

export function ValidateSignatureTool({ className = '' }: ValidateSignatureToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleValidate = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setReport(null);

    try {
      const bytes = await file.arrayBuffer();
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const latinText = new TextDecoder('latin1').decode(new Uint8Array(bytes));
      const rawByteRangeMatches = (latinText.match(/\/ByteRange\s*\[[^\]]+\]/g) ?? []).length;
      const rawContentsMatches = (latinText.match(/\/Contents\s*(<[^>]+>|\([^)]+\))/g) ?? []).length;

      const form = doc.getForm();
      const signatureFields = form
        .getFields()
        .filter((field: any) => field?.constructor?.name === 'PDFSignature')
        .map((field: any) => {
          const dict = field.acroField?.dict;
          const value = dict?.lookup?.('V');
          const valueString = value?.toString?.() ?? '';
          const byteRanges = valueString.match(/\/ByteRange\s*\[[^\]]+\]/g) ?? [];
          return {
            fieldName: field.getName(),
            hasValue: Boolean(value),
            byteRangeCount: byteRanges.length,
            hasContents: /\/Contents/.test(valueString),
          };
        });

      const summary = signatureFields.length === 0
        ? 'No signature fields were found in this PDF.'
        : signatureFields.some((finding) => finding.hasValue)
          ? 'At least one signature field contains signature data. Review the byte range and contents indicators below.'
          : 'Signature fields exist, but no embedded signature value was detected.';

      setReport({
        filename: file.name,
        pageCount: doc.getPageCount(),
        signatureFields,
        rawByteRangeMatches,
        rawContentsMatches,
        summary,
      });
    } catch (validationError) {
      console.error('Validate signature failed', validationError);
      setError(validationError instanceof Error ? validationError.message : 'Could not inspect this PDF.');
    } finally {
      setIsProcessing(false);
    }
  }, [file]);

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      {!file && (
        <FileUploader
          accept={['application/pdf', '.pdf']}
          multiple={false}
          maxFiles={1}
          onFilesSelected={(files) => {
            setFile(files[0] ?? null);
            setReport(null);
            setError(null);
          }}
          label="Upload signed PDF"
          description="Inspect a PDF for embedded signature fields, byte range markers, and signature payload hints."
        />
      )}

      {file && (
        <Card variant="outlined" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-[hsl(var(--color-muted-foreground))]">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setFile(null); setReport(null); setError(null); }}>
                Clear
              </Button>
              <Button onClick={handleValidate} loading={isProcessing}>
                Validate Signature
              </Button>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            This report is browser-side structural validation. It checks signature fields and byte-range markers locally, but it does not establish CA trust or long-term timestamp trust the way a dedicated desktop validator would.
          </div>
        </Card>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {report && (
        <Card variant="outlined" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Validation Summary</h3>
            <p className="mt-2 text-sm text-[hsl(var(--color-muted-foreground))]">{report.summary}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[var(--radius-md)] bg-[hsl(var(--color-secondary)/0.4)] p-4">
              <p className="text-xs uppercase tracking-wide text-[hsl(var(--color-muted-foreground))]">Pages</p>
              <p className="mt-1 text-2xl font-semibold">{report.pageCount}</p>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[hsl(var(--color-secondary)/0.4)] p-4">
              <p className="text-xs uppercase tracking-wide text-[hsl(var(--color-muted-foreground))]">Signature fields</p>
              <p className="mt-1 text-2xl font-semibold">{report.signatureFields.length}</p>
            </div>
            <div className="rounded-[var(--radius-md)] bg-[hsl(var(--color-secondary)/0.4)] p-4">
              <p className="text-xs uppercase tracking-wide text-[hsl(var(--color-muted-foreground))]">ByteRange markers</p>
              <p className="mt-1 text-2xl font-semibold">{report.rawByteRangeMatches}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[hsl(var(--color-border))] text-left">
                  <th className="px-3 py-2 font-medium">Field</th>
                  <th className="px-3 py-2 font-medium">Embedded value</th>
                  <th className="px-3 py-2 font-medium">ByteRange refs</th>
                  <th className="px-3 py-2 font-medium">Contents marker</th>
                </tr>
              </thead>
              <tbody>
                {report.signatureFields.length > 0 ? report.signatureFields.map((finding) => (
                  <tr key={finding.fieldName} className="border-b border-[hsl(var(--color-border)/0.6)]">
                    <td className="px-3 py-2">{finding.fieldName}</td>
                    <td className="px-3 py-2">{finding.hasValue ? 'Present' : 'Missing'}</td>
                    <td className="px-3 py-2">{finding.byteRangeCount}</td>
                    <td className="px-3 py-2">{finding.hasContents ? 'Present' : 'Missing'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-[hsl(var(--color-muted-foreground))]">
                      No signature fields found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[hsl(var(--color-muted-foreground))]">
            Raw signature payload matches found in file bytes: {report.rawContentsMatches}
          </p>
        </Card>
      )}
    </div>
  );
}

export default ValidateSignatureTool;
