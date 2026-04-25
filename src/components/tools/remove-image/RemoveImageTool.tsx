'use client';

import React from 'react';
import { PDFEditorWorkbench } from '../edit-pdf/PDFEditorWorkbench';

export interface RemoveImageToolProps {
  className?: string;
}

export function RemoveImageTool({ className = '' }: RemoveImageToolProps) {
  return (
    <PDFEditorWorkbench
      className={className}
      title="Remove Image"
      description="Open a guided cleanup view to cover or replace unwanted images before exporting the updated PDF."
      instructions={[
        'Use the image tool to place a covering image or switch to text/draw tools to mask a graphic.',
        'Zoom in and confirm the unwanted image is fully obscured on each page.',
        'Export the updated PDF once the cleanup review is complete.',
      ]}
      primaryControlId="editorStamp"
      visibleControlIds={['editorStamp', 'editorFreeText', 'editorInk']}
      viewerTitle="PDF Remove Image Workbench"
    />
  );
}

export default RemoveImageTool;
