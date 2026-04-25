'use client';

import React from 'react';
import { PDFEditorWorkbench } from '../edit-pdf/PDFEditorWorkbench';

export interface AddTextToolProps {
  className?: string;
}

export function AddTextTool({ className = '' }: AddTextToolProps) {
  return (
    <PDFEditorWorkbench
      className={className}
      title="Add Text"
      description="Type new labels, callouts, or corrections onto your PDF with a focused free-text editing mode."
      instructions={[
        'The editor opens with the text tool selected.',
        'Click anywhere on the page to place a text box, then type your content.',
        'Use the in-viewer export action to save the updated PDF when finished.',
      ]}
      primaryControlId="editorFreeText"
      visibleControlIds={['editorFreeText']}
      viewerTitle="PDF Add Text"
    />
  );
}

export default AddTextTool;
