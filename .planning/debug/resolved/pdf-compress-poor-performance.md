---
status: verifying
trigger: "pdf-compress-poor-performance"
created: 2026-01-17T00:00:00.000Z
updated: 2026-01-17T00:00:06.000Z
---

## Current Focus
hypothesis: CONFIRMED - coherentpdf lacks image optimization. Switching to PyMuPDF for comprehensive compression.
test: Implemented PyMuPDF-based compress worker with image downsampling support
expecting: PyMuPDF with garbage=4, deflate=True, clean=True will achieve significant compression
next_action: Test the compression functionality

## Symptoms
expected: PDF file size should reduce significantly (e.g., 4.7MB reduction like other tools achieve)
actual: Compression only reduces by ~100KB, which is negligible compared to external tools
errors: No error messages shown in console or UI
reproduction: Upload a PDF and use the compress feature - compare file size before and after
timeline: Not sure if it ever worked properly

## Eliminated

## Evidence

- timestamp: 2026-01-17T00:00:01.000Z
  checked: compress.worker.js and compress.ts
  found: Uses coherentpdf library with compress(), squeezeInMemory(), and toMemoryExt() functions
  implication: coherentpdf only compresses uncompressed streams with Flate - doesn't downsample or recompress images

- timestamp: 2026-01-17T00:00:02.000Z
  checked: Other workers (word-to-pdf, excel-to-pdf, etc.)
  found: PyMuPDF workers use tobytes(garbage=4, deflate=True, clean=True) for compression
  implication: PyMuPDF has more aggressive compression options available

- timestamp: 2026-01-17T00:00:03.000Z
  checked: compress.worker.js lines 51-64
  found: Only calls coherentpdf.compress() which "Compress all uncompressed streams using Flate"
  implication: This only affects streams that aren't already compressed, missing image optimization

- timestamp: 2026-01-17T00:00:04.000Z
  checked: Industry standard PDF compression techniques
  found: Effective PDF compression requires: (1) Image downsampling (reducing DPI), (2) Image recompression (higher JPEG compression), (3) Flate compression of streams, (4) Garbage collection
  implication: coherentpdf only does #3 and partially #4, missing the most important image optimizations

## Resolution
root_cause: The compress worker uses coherentpdf which only provides basic stream compression (Flate) but lacks image downsampling and recompression capabilities. Image data typically comprises 70-90% of PDF file size, so without optimizing images, compression results are minimal (~100KB vs potential 4.7MB reduction).

fix: Replaced coherentpdf with PyMuPDF which supports comprehensive compression including:
- Image downsampling at different DPI levels (72/144/200/300 based on quality)
- Deflate compression of all streams
- Maximum garbage collection (garbage=4)
- Clean unused objects
- Linearization for web viewing (low/medium quality)

Changed files:
- public/workers/compress.worker.js - Complete rewrite using PyMuPDF
- src/lib/pdf/processors/compress.ts - Removed unused options (optimizeImages, removeUnusedObjects)
- src/components/tools/compress/CompressPDFTool.tsx - Removed unused options and UI elements

verification: Build successful. The fix is implemented but requires runtime testing with actual PDF files to verify compression effectiveness. The PyMuPDF implementation now supports:
- Image downsampling at configurable DPI (72/144/200/300)
- Maximum garbage collection (garbage=4)
- Deflate compression of all streams
- Clean unused objects
- Linearization for fast web viewing

This should achieve significantly better compression compared to the previous coherentpdf implementation which only had basic Flate compression.
