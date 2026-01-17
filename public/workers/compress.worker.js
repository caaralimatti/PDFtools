/**
 * Compress PDF Worker (via Pyodide + PyMuPDF)
 * Uses PyMuPDF for PDF compression optimized for browser WASM environment
 *
 * Compression strategy:
 * - Deflate compression: Compress all streams
 * - Garbage collection: Remove unused objects
 * - Metadata removal: Optional metadata stripping
 * - Linearization: Optimize for web viewing
 */

import { loadPyodide } from '/pymupdf-wasm/pyodide.js';

let pyodide = null;
let initPromise = null;

async function init() {
  if (pyodide) return pyodide;

  self.postMessage({ status: 'progress', progress: 5 });

  pyodide = await loadPyodide({
    indexURL: '/pymupdf-wasm/',
    fullStdLib: false
  });

  self.postMessage({ status: 'progress', progress: 10 });

  const install = async (url) => {
    await pyodide.loadPackage(url);
  };

  const basePath = '/pymupdf-wasm/';
  await install(basePath + 'pymupdf-1.26.3-cp313-none-pyodide_2025_0_wasm32.whl');

  self.postMessage({ status: 'progress', progress: 15 });

  // Define the compression function in Python
  pyodide.runPython(`
import pymupdf
import io
from typing import Dict, Any

def compress_pdf_with_pymupdf(input_bytes, options: Dict[str, Any]):
    """
    Compress PDF using PyMuPDF with optimization.

    Args:
        input_bytes: PDF file bytes
        options: Compression options dict
            - quality: 'low', 'medium', 'high', 'maximum'
            - removeMetadata: bool

    Returns:
        Compressed PDF bytes
    """
    quality = options.get('quality', 'medium')
    remove_metadata = options.get('removeMetadata', False)

    # Open the PDF document
    doc = pymupdf.open(stream=input_bytes, filetype="pdf")

    # Remove metadata if requested
    if remove_metadata:
        try:
            doc.set_metadata({})
        except:
            pass

    # Define compression settings based on quality level
    # Note: In WASM environment, we use basic compression options
    # that don't require rendering capabilities
    if quality == 'low':
        # Maximum compression
        garbage_level = 4  # Maximum garbage collection
        deflate = True
        clean = True
        linear = True  # Linearize for fast web view
    elif quality == 'medium':
        # Balanced compression
        garbage_level = 3
        deflate = True
        clean = True
        linear = True
    elif quality == 'high':
        # Light compression
        garbage_level = 2
        deflate = True
        clean = True
        linear = False
    else:  # maximum
        # Minimal compression: preserve quality
        garbage_level = 1
        deflate = True
        clean = True
        linear = False

    # Save with compression settings
    save_options = {
        'garbage': garbage_level,
        'deflate': deflate,
        'clean': clean,
        'linear': linear,
    }

    # Convert to compressed PDF
    compressed_bytes = doc.tobytes(**save_options)
    doc.close()

    return compressed_bytes
`);

  return pyodide;
}

self.onmessage = async (event) => {
  const { command, pdfData, options } = event.data;

  if (command !== 'compress') {
    return;
  }

  try {
    if (!initPromise) {
      initPromise = init();
    }
    await initPromise;

    self.postMessage({ status: 'progress', progress: 20 });

    // Convert ArrayBuffer to bytes for Python
    const uint8Array = new Uint8Array(pdfData);
    const inputBytes = pyodide.toPy(uint8Array);

    self.postMessage({ status: 'progress', progress: 30 });

    // Call the compression function
    const compressedBytes = pyodide.runPython(`
compressed_pdf = compress_pdf_with_pymupdf(${inputBytes}, ${pyodide.toPy(options)})
compressed_pdf
`);

    self.postMessage({ status: 'progress', progress: 90 });

    // Convert result back to JavaScript
    const resultBuffer = compressedBytes.getBuffer();

    self.postMessage({ status: 'progress', progress: 100 });

    // Send back the compressed PDF
    self.postMessage(
      {
        status: 'success',
        pdfBytes: resultBuffer.buffer,
        originalSize: pdfData.byteLength,
        compressedSize: resultBuffer.byteLength,
      },
      [resultBuffer.buffer]
    );
  } catch (error) {
    console.error('Compression error:', error);

    // Check for encryption error
    if (error.message && error.message.includes('encrypt')) {
      self.postMessage({
        status: 'error',
        message: 'The PDF file is encrypted. Please decrypt it first.',
      });
      return;
    }

    self.postMessage({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during compression.',
    });
  }
};
