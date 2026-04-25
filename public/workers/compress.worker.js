/**
 * Compress PDF Worker (via Pyodide + PyMuPDF)
 * Uses PyMuPDF for PDF compression optimized for browser WASM environment
 *
 * Compression strategy:
 * - Lossless reduction via object streams / deflate / garbage collection
 * - Optional lossy image rewriting for meaningful size reduction
 * - Metadata removal when requested
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

    # Real size reduction requires more than deflating existing streams.
    # PyMuPDF recommends:
    # - lossless: garbage + deflate + use_objstms
    # - lossy: rewrite_images() for resampling / JPEG recompression
    if quality == 'low':
        garbage_level = 4
        deflate = True
        deflate_images = True
        deflate_fonts = True
        use_objstms = 1
        compression_effort = 100
        image_settings = {
            'dpi_threshold': 160,
            'dpi_target': 96,
            'quality': 35,
        }
    elif quality == 'medium':
        garbage_level = 3
        deflate = True
        deflate_images = True
        deflate_fonts = True
        use_objstms = 1
        compression_effort = 75
        image_settings = {
            'dpi_threshold': 220,
            'dpi_target': 144,
            'quality': 50,
        }
    elif quality == 'high':
        garbage_level = 2
        deflate = True
        deflate_images = True
        deflate_fonts = True
        use_objstms = 1
        compression_effort = 50
        image_settings = {
            'dpi_threshold': 300,
            'dpi_target': 200,
            'quality': 70,
        }
    else:  # maximum
        # Best visual quality with only lossless reduction
        garbage_level = 3
        deflate = True
        deflate_images = True
        deflate_fonts = True
        use_objstms = 1
        compression_effort = 25
        image_settings = None

    if image_settings and hasattr(doc, 'rewrite_images'):
        try:
            doc.rewrite_images(
                dpi_threshold=image_settings['dpi_threshold'],
                dpi_target=image_settings['dpi_target'],
                quality=image_settings['quality'],
                lossy=True,
                lossless=True,
                bitonal=True,
                color=True,
                gray=True,
            )
        except Exception:
            pass

    # Save with compression settings
    save_options = {
        'garbage': garbage_level,
        'deflate': deflate,
        'deflate_images': deflate_images,
        'deflate_fonts': deflate_fonts,
        'use_objstms': use_objstms,
        'compression_effort': compression_effort,
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

    // Pass binary data and options through globals. Interpolating PyProxy
    // objects into Python source creates invalid syntax like "<memory at ...>".
    pyodide.globals.set('input_pdf_data', new Uint8Array(pdfData));
    pyodide.globals.set('compression_options', pyodide.toPy(options));

    self.postMessage({ status: 'progress', progress: 30 });

    // Call the compression function
    const compressedBytes = pyodide.runPython(`
compressed_pdf = compress_pdf_with_pymupdf(bytes(input_pdf_data), compression_options)
compressed_pdf
`);

    self.postMessage({ status: 'progress', progress: 90 });

    // Convert result back to a plain transferable ArrayBuffer.
    const rawBytes = compressedBytes.toJs ? compressedBytes.toJs() : compressedBytes;
    const resultBytes = rawBytes instanceof Uint8Array
      ? rawBytes
      : ArrayBuffer.isView(rawBytes)
        ? new Uint8Array(rawBytes.buffer.slice(rawBytes.byteOffset, rawBytes.byteOffset + rawBytes.byteLength))
        : rawBytes instanceof ArrayBuffer
          ? new Uint8Array(rawBytes)
          : new Uint8Array(rawBytes);
    const transferableBuffer = resultBytes.slice().buffer;

    if (compressedBytes.destroy) {
      compressedBytes.destroy();
    }

    pyodide.globals.delete('input_pdf_data');
    pyodide.globals.delete('compression_options');

    self.postMessage({ status: 'progress', progress: 100 });

    // Send back the compressed PDF
    self.postMessage(
      {
        status: 'success',
        pdfBytes: transferableBuffer,
        originalSize: pdfData.byteLength,
        compressedSize: resultBytes.byteLength,
      },
      [transferableBuffer]
    );
  } catch (error) {
    console.error('Compression error:', error);

    if (pyodide) {
      try {
        pyodide.globals.delete('input_pdf_data');
        pyodide.globals.delete('compression_options');
      } catch {
        // Ignore cleanup errors after a failed Python call.
      }
    }

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
