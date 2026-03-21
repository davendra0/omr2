import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight, Crop, Check, X, Loader2, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfQuestionExtractorProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
  currentQuestion: number;
}

export const PdfQuestionExtractor: React.FC<PdfQuestionExtractorProps> = ({ onCapture, onClose, currentQuestion }) => {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [scale, setScale] = useState(2.0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<HTMLDivElement>(null);
  
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [selection, setSelection] = useState({ x: 0, y: 0, width: 0, height: 0 });

  const loadPdf = async (file: File) => {
    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      setPdf(pdfDoc);
      setNumPages(pdfDoc.numPages);
      setPageNum(1);
      toast.success('PDF loaded successfully');
    } catch (error) {
      console.error('Error loading PDF:', error);
      toast.error('Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  }, [pdf, pageNum, scale]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsSelecting(true);
    setStartPos({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Clamp to canvas boundaries
    const boundedX = Math.max(0, Math.min(currentX, rect.width));
    const boundedY = Math.max(0, Math.min(currentY, rect.height));
    
    const startBoundedX = Math.max(0, Math.min(startPos.x, rect.width));
    const startBoundedY = Math.max(0, Math.min(startPos.y, rect.height));
    
    const x = Math.min(startBoundedX, boundedX);
    const y = Math.min(startBoundedY, boundedY);
    const width = Math.abs(startBoundedX - boundedX);
    const height = Math.abs(startBoundedY - boundedY);
    
    setSelection({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const captureSelection = useCallback(() => {
    if (!canvasRef.current || selection.width === 0 || selection.height === 0) return;

    const sourceCanvas = canvasRef.current;
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = selection.width;
    captureCanvas.height = selection.height;
    
    const ctx = captureCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      sourceCanvas,
      selection.x, selection.y, selection.width, selection.height,
      0, 0, selection.width, selection.height
    );

    const dataUrl = captureCanvas.toDataURL('image/png');
    onCapture(dataUrl);
    
    // Reset selection for next question
    setSelection({ x: 0, y: 0, width: 0, height: 0 });
    toast.success(`Question ${currentQuestion} captured!`);
  }, [selection, onCapture, currentQuestion]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selection.width > 0 && selection.height > 0) {
        captureSelection();
      } else if (e.key === 'ArrowRight' && !isSelecting) {
        setPageNum(p => Math.min(numPages, p + 1));
      } else if (e.key === 'ArrowLeft' && !isSelecting) {
        setPageNum(p => Math.max(1, p - 1));
      } else if (e.key === 'Escape') {
        setSelection({ x: 0, y: 0, width: 0, height: 0 });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection, currentQuestion, numPages, isSelecting, captureSelection]);

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden">
      <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
          <div className="font-mono font-bold text-sm">
            PDF Extractor <span className="text-primary ml-2">Q{currentQuestion}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!pdf ? (
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                id="pdf-upload"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadPdf(file);
                }}
              />
              <Button asChild variant="default" size="sm">
                <label htmlFor="pdf-upload" className="cursor-pointer flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Open PDF
                </label>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1 bg-muted rounded-md p-1 mr-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => setPageNum(p => Math.max(1, p - 1))}
                  disabled={pageNum <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-mono px-2">
                  Page {pageNum} / {numPages}
                </span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={() => setPageNum(p => Math.min(numPages, p + 1))}
                  disabled={pageNum >= numPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="flex items-center gap-2 border-l border-border pl-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setScale(s => Math.max(0.5, s - 0.5))}
                >
                  -
                </Button>
                <span className="text-xs font-mono w-12 text-center">{Math.round(scale * 100)}%</span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setScale(s => Math.min(5, s + 0.5))}
                >
                  +
                </Button>
              </div>

              <Button 
                variant="default" 
                size="sm" 
                className="ml-4 bg-success hover:bg-success/90"
                onClick={captureSelection}
                disabled={selection.width === 0}
              >
                <Check className="w-4 h-4 mr-2" /> Capture (Enter)
              </Button>
              
              {selection.width > 0 && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="ml-1 h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setSelection({ x: 0, y: 0, width: 0, height: 0 })}
                  title="Clear Selection (Esc)"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative bg-muted/30">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-50">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!pdf && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <FileText className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg">No PDF Selected</h3>
              <p className="text-sm text-muted-foreground">Open a PDF to start extracting questions</p>
            </div>
          </div>
        )}

        {pdf && (
          <div 
            ref={containerRef}
            className="flex-1 overflow-auto p-8 flex justify-center relative cursor-crosshair select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="relative shadow-2xl bg-white">
              <canvas ref={canvasRef} />
              
              {/* Selection Rectangle */}
              {(selection.width > 0 || selection.height > 0) && (
                <div
                  className="absolute border-2 border-primary bg-primary/10 pointer-events-none"
                  style={{
                    left: selection.x,
                    top: selection.y,
                    width: selection.width,
                    height: selection.height,
                  }}
                >
                  <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Crop size={10} /> Q{currentQuestion}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="h-10 bg-card border-t border-border flex items-center px-4 justify-between text-[10px] text-muted-foreground font-mono">
        <div>Drag to select question area • Press Enter to capture</div>
        <div className="flex gap-4">
          <span>Scale: {scale.toFixed(1)}x</span>
          <span>Page: {pageNum}/{numPages}</span>
        </div>
      </div>
    </div>
  );
};
