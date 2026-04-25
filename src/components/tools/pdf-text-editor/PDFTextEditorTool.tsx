'use client';

import React from 'react';
import { PDFEditorWorkbench } from '../edit-pdf/PDFEditorWorkbench';

export interface PDFTextEditorToolProps {
  className?: string;
}

export function PDFTextEditorTool({ className = '' }: PDFTextEditorToolProps) {
  return (
    <PDFEditorWorkbench
      className={className}
      title="PDF Text Editor"
      description="Launch a text-focused editing workbench for corrections, callouts, and review-driven wording updates."
      instructions={[
        'The text tool opens first so you can start placing corrections immediately.',
        'Add replacement text, reviewer notes, or text overlays anywhere on the page.',
        'Use the viewer export action to download the edited PDF when your review pass is complete.',
      ]}
      primaryControlId="editorFreeText"
      visibleControlIds={['editorFreeText', 'editorHighlight']}
      viewerTitle="PDF Text Editor"
    />
  );
}

export default PDFTextEditorTool;
