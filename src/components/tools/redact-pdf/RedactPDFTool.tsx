'use client';

import React from 'react';
import { PDFEditorWorkbench } from '../edit-pdf/PDFEditorWorkbench';

export interface RedactPDFToolProps {
  className?: string;
}

export function RedactPDFTool({ className = '' }: RedactPDFToolProps) {
  return (
    <PDFEditorWorkbench
      className={className}
      title="Redact PDF"
      description="Use the focused editor to cover sensitive content before exporting a cleaned review copy."
      instructions={[
        'Use highlight and free-text together to mark and cover sensitive regions.',
        'For image-heavy pages, switch to Add Image or draw mode from the toolbar if needed.',
        'Export a reviewed copy after confirming the covered content is no longer visible.',
      ]}
      primaryControlId="editorHighlight"
      visibleControlIds={['editorHighlight', 'editorFreeText', 'editorInk']}
      viewerTitle="PDF Redaction Workbench"
    />
  );
}

export default RedactPDFTool;
