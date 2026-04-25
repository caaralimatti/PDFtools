'use client';

import React from 'react';
import { PDFEditorWorkbench } from '../edit-pdf/PDFEditorWorkbench';

export interface AddImageToolProps {
  className?: string;
}

export function AddImageTool({ className = '' }: AddImageToolProps) {
  return (
    <PDFEditorWorkbench
      className={className}
      title="Add Image"
      description="Place logos, signatures, stickers, or supporting images on top of your PDF pages."
      instructions={[
        'The image placement tool opens first so you can add a logo or screenshot immediately.',
        'Choose Add image inside the viewer toolbar, then position and resize it on the page.',
        'Export the edited PDF from the viewer once the placement looks right.',
      ]}
      primaryControlId="editorStamp"
      visibleControlIds={['editorStamp']}
      viewerTitle="PDF Add Image"
    />
  );
}

export default AddImageTool;
