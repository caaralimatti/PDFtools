'use client';

import React from 'react';
import { PDFEditorWorkbench } from './PDFEditorWorkbench';

export interface EditPDFToolProps {
  className?: string;
}

export function EditPDFTool({ className = '' }: EditPDFToolProps) {
  return (
    <PDFEditorWorkbench
      className={className}
      title="Edit PDF"
      description="Open a PDF in the browser editor to annotate, highlight, add notes, draw, and place images."
      instructions={[
        'Use the toolbar to switch between highlight, text, draw, and image placement.',
        'Click directly on the page to place annotations or start drawing.',
        'Use the export action inside the viewer when you are done editing.',
      ]}
      viewerTitle="PDF Editor"
    />
  );
}

export default EditPDFTool;
