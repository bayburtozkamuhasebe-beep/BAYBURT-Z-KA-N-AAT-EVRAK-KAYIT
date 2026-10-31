import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Sparkles,
  RotateCw,
  Check,
  X,
  Maximize2,
  Sliders,
  FileText,
  Palette,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { autoCropAndCleanCheck } from '../lib/autoCheckCropper';

export type EnhanceMode = 'enhance' | 'document' | 'vibrant' | 'bw' | 'original';

interface DocumentCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  fileName?: string;
  onClose: () => void;
  onConfirm: (processedFile: File, processedPreviewUrl: string) => void;
}

interface CropBox {
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  width: number; // percentage 0 - 100
  height: number; // percentage 0 - 100
}

export const DocumentCropModal: React.FC<DocumentCropModalProps> = ({
  isOpen,
  imageSrc,
  fileName = 'evrak_cek.jpg',
  onClose,
  onConfirm,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Crop box percentage of image: default selects standard check ratio (2.2 : 1)
  const [cropBox, setCropBox] = useState<CropBox>({
    x: 4,
    y: 12,
    width: 92,
    height: 42,
  });

  const [enhanceMode, setEnhanceMode] = useState<EnhanceMode>('original');
  const [rotation, setRotation] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aspectLock, setAspectLock] = useState<'free' | 'check'>('check');

  // Drag interaction state
  const dragRef = useRef<{
    isDragging: boolean;
    handle: string | null; // 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w'
    startX: number;
    startY: number;
    startCrop: CropBox;
  }>({
    isDragging: false,
    handle: null,
    startX: 0,
    startY: 0,
    startCrop: { x: 4, y: 12, width: 92, height: 42 },
  });

  // Function to initialize crop box to standard check ratio (2.2 : 1)
  const initCheckRatioBox = useCallback((imgW?: number, imgH?: number) => {
    let targetW = 92;
    let targetH = 42;

    if (imgW && imgH && imgW > 0 && imgH > 0) {
      const imgRatio = imgW / imgH; // e.g. 1.33 for 4:3, 1.77 for 16:9
      // Standard Check Aspect Ratio is 2.20 : 1
      // cropWidthPixels / cropHeightPixels = 2.2
      // targetH% = (targetW% * imgRatio) / 2.2
      targetH = Math.round((targetW * imgRatio) / 2.2);
      if (targetH > 80) {
        targetH = 80;
        targetW = Math.min(94, Math.round((targetH * 2.2) / imgRatio));
      }
      if (targetH < 20) targetH = 20;
    }

    const x = Math.max(2, Math.round((100 - targetW) / 2));
    const y = Math.max(4, Math.round((100 - targetH) / 2));
    setCropBox({
      x,
      y,
      width: Math.min(100 - x, targetW),
      height: Math.min(100 - y, targetH),
    });
  }, []);

  // Reset state when a new image is loaded
  useEffect(() => {
    if (isOpen) {
      const img = imageRef.current;
      initCheckRatioBox(img?.naturalWidth, img?.naturalHeight);
      setEnhanceMode('original'); // Doğal orijinal renkleri koru ("GÖRÜNTÜYÜ ORİJİNAL YÜKLE")
      setAspectLock('check');
      setRotation(0);
    }
  }, [isOpen, imageSrc, initCheckRatioBox]);

  // Handle Rotation 90° Clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Preset: Standard Check Ratio (~2.2 : 1)
  const handleSetCheckRatio = () => {
    const img = imageRef.current;
    initCheckRatioBox(img?.naturalWidth, img?.naturalHeight);
    setAspectLock('check');
  };

  // Preset: Full image
  const handleResetCrop = () => {
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
    setAspectLock('free');
  };

  // Preset: Trim margins (5% each side)
  const handleAutoTrimMargins = () => {
    setCropBox({ x: 4, y: 6, width: 92, height: 88 });
    setAspectLock('free');
  };

  // Helper to get bounding rect of the rendered image within the container
  const getImageRenderRect = () => {
    const img = imageRef.current;
    if (!img) return null;
    return img.getBoundingClientRect();
  };

  // Mouse & Touch down
  const startDrag = (handle: string, clientX: number, clientY: number) => {
    dragRef.current = {
      isDragging: true,
      handle,
      startX: clientX,
      startY: clientY,
      startCrop: { ...cropBox },
    };
  };

  const handlePointerDown = (e: React.PointerEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startDrag(handle, e.clientX, e.clientY);
  };

  // Pointer Move (Mouse / Touch)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return;
    const imgRect = getImageRenderRect();
    if (!imgRect || imgRect.width === 0 || imgRect.height === 0) return;

    const deltaPixelX = e.clientX - dragRef.current.startX;
    const deltaPixelY = e.clientY - dragRef.current.startY;

    const deltaPercentX = (deltaPixelX / imgRect.width) * 100;
    const deltaPercentY = (deltaPixelY / imgRect.height) * 100;

    const { handle, startCrop } = dragRef.current;
    let newCrop = { ...startCrop };

    const minSize = 10; // minimum 10% width/height

    if (handle === 'move') {
      newCrop.x = Math.max(0, Math.min(100 - startCrop.width, startCrop.x + deltaPercentX));
      newCrop.y = Math.max(0, Math.min(100 - startCrop.height, startCrop.y + deltaPercentY));
    } else {
      // Corner or edge resize
      if (handle?.includes('e')) {
        newCrop.width = Math.max(minSize, Math.min(100 - startCrop.x, startCrop.width + deltaPercentX));
      }
      if (handle?.includes('w')) {
        const potentialWidth = startCrop.width - deltaPercentX;
        if (potentialWidth >= minSize && startCrop.x + deltaPercentX >= 0) {
          newCrop.x = startCrop.x + deltaPercentX;
          newCrop.width = potentialWidth;
        }
      }
      if (handle?.includes('s')) {
        newCrop.height = Math.max(minSize, Math.min(100 - startCrop.y, startCrop.height + deltaPercentY));
      }
      if (handle?.includes('n')) {
        const potentialHeight = startCrop.height - deltaPercentY;
        if (potentialHeight >= minSize && startCrop.y + deltaPercentY >= 0) {
          newCrop.y = startCrop.y + deltaPercentY;
          newCrop.height = potentialHeight;
        }
      }
    }

    setCropBox(newCrop);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current.isDragging = false;
    dragRef.current.handle = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Image Enhancement Engine (Clarity, Contrast, Sharpen)
  const applyImageEnhancement = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    mode: EnhanceMode
  ) => {
    if (mode === 'original') return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    if (mode === 'bw') {
      // High contrast B&W Scan
      for (let i = 0; i < len; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Adaptive stretch
        const val = gray > 140 ? Math.min(255, gray * 1.25) : Math.max(0, gray * 0.75);
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    if (mode === 'document') {
      // Document scan mode: cleans paper background, darkens text/ink
      for (let i = 0; i < len; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        let factor = 1.0;
        if (gray > 145) {
          // background -> push to bright clean paper
          data[i] = Math.min(255, data[i] * 1.35 + 20);
          data[i + 1] = Math.min(255, data[i + 1] * 1.35 + 20);
          data[i + 2] = Math.min(255, data[i + 2] * 1.35 + 20);
        } else {
          // ink / stamp / text -> deepen
          data[i] = Math.max(0, data[i] * 0.72);
          data[i + 1] = Math.max(0, data[i + 1] * 0.72);
          data[i + 2] = Math.max(0, data[i + 2] * 0.72);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return;
    }

    // Default 'enhance' (Akıllı Netleştir) & 'vibrant'
    // 1. Contrast & Brightness adjustment
    const contrast = mode === 'enhance' ? 36 : 28;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const brightness = mode === 'enhance' ? 12 : 8;

    for (let i = 0; i < len; i += 4) {
      data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128 + brightness));
      data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128 + brightness));
      data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128 + brightness));
    }
    ctx.putImageData(imgData, 0, 0);

    // 2. Convolution Sharpening pass for 'enhance' mode
    if (mode === 'enhance' && width > 100 && height > 100) {
      try {
        const copyData = ctx.getImageData(0, 0, width, height);
        const src = copyData.data;
        const dst = imgData.data;

        // Sharpen kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0] with mild weight 0.35
        const w = width;
        const weight = 0.35;

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const current = src[idx + c];
              const top = src[((y - 1) * w + x) * 4 + c];
              const btm = src[((y + 1) * w + x) * 4 + c];
              const lft = src[(y * w + (x - 1)) * 4 + c];
              const rgt = src[(y * w + (x + 1)) * 4 + c];

              const sharpVal = 5 * current - top - btm - lft - rgt;
              dst[idx + c] = Math.max(
                0,
                Math.min(255, Math.round(current * (1 - weight) + sharpVal * weight))
              );
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      } catch (err) {
        console.warn('Sharpen convolution notice:', err);
      }
    }
  };

  // Process & Confirm: Crop and Enhance
  const handleApplyCropAndEnhance = async () => {
    setIsProcessing(true);

    try {
      const sourceImg = new Image();
      sourceImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        sourceImg.onload = () => resolve();
        sourceImg.onerror = (e) => reject(e);
        sourceImg.src = imageSrc;
      });

      // 1. First canvas: apply rotation if any
      let orientedCanvas = document.createElement('canvas');
      const rad = (rotation * Math.PI) / 180;
      const isSwapped = rotation === 90 || rotation === 270;

      const orientedW = isSwapped ? sourceImg.naturalHeight : sourceImg.naturalWidth;
      const orientedH = isSwapped ? sourceImg.naturalWidth : sourceImg.naturalHeight;

      orientedCanvas.width = orientedW;
      orientedCanvas.height = orientedH;
      const orientedCtx = orientedCanvas.getContext('2d');
      if (!orientedCtx) throw new Error('Canvas 2D context oluşturulamadı');

      if (rotation !== 0) {
        orientedCtx.translate(orientedW / 2, orientedH / 2);
        orientedCtx.rotate(rad);
        orientedCtx.drawImage(
          sourceImg,
          -sourceImg.naturalWidth / 2,
          -sourceImg.naturalHeight / 2
        );
      } else {
        orientedCtx.drawImage(sourceImg, 0, 0);
      }

      // 2. Crop to selected coordinates
      const cropPixelX = Math.round((cropBox.x / 100) * orientedW);
      const cropPixelY = Math.round((cropBox.y / 100) * orientedH);
      const cropPixelW = Math.max(20, Math.round((cropBox.width / 100) * orientedW));
      const cropPixelH = Math.max(20, Math.round((cropBox.height / 100) * orientedH));

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = cropPixelW;
      finalCanvas.height = cropPixelH;
      const finalCtx = finalCanvas.getContext('2d');
      if (!finalCtx) throw new Error('Final canvas context hatası');

      finalCtx.drawImage(
        orientedCanvas,
        cropPixelX,
        cropPixelY,
        cropPixelW,
        cropPixelH,
        0,
        0,
        cropPixelW,
        cropPixelH
      );

      // 3. Apply the selected enhancement filter (Netleştir)
      applyImageEnhancement(finalCtx, cropPixelW, cropPixelH, enhanceMode);

      // 4. Output as pristine high-res JPEG
      finalCanvas.toBlob(
        (blob) => {
          if (blob) {
            const timestamp = Date.now();
            const cleanBase = fileName.replace(/\.[^/.]+$/, '').replace(/_net$/, '');
            const finalFile = new File([blob], `${cleanBase}_net.jpg`, {
              type: 'image/jpeg',
            });
            const finalUrl = URL.createObjectURL(blob);
            onConfirm(finalFile, finalUrl);
            onClose();
          }
          setIsProcessing(false);
        },
        'image/jpeg',
        0.98
      );
    } catch (err: any) {
      console.error('Crop & Enhance error:', err);
      alert('Görüntü işlenirken bir sorun oluştu: ' + (err.message || 'Bilinmeyen hata'));
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex h-full max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 text-white sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Crop className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100 uppercase tracking-wide flex items-center gap-2">
                <span>Çek Kırpma (Elle Ayarlama)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  DİREK ELLE AYARLAMA
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5 hidden xs:block">
                Köşeleri veya kenarları sürükleyerek çek alanını elle ayarlayınız. Orijinal dosya depoya ham kaydedilir.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRotate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
              title="90 Derece Sağa Döndür"
            >
              <RotateCw className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Döndür (90°)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
              title="Kapat"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Toolbar: Netleştirme ve Hızlı Kesme Seçenekleri */}
        <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5 flex-wrap gap-2 text-xs">
          {/* Netleştirme Filtreleri */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Netleştirme:</span>
            </span>

            <button
              type="button"
              onClick={() => setEnhanceMode('enhance')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                enhanceMode === 'enhance'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60 ring-2 ring-rose-500/40'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Akıllı Netleştir</span>
            </button>

            <button
              type="button"
              onClick={() => setEnhanceMode('document')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                enhanceMode === 'document'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60 ring-2 ring-rose-500/40'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-300" />
              <span>Belge / Fatura</span>
            </button>

            <button
              type="button"
              onClick={() => setEnhanceMode('bw')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                enhanceMode === 'bw'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60 ring-2 ring-rose-500/40'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
              }`}
            >
              <span>Net Siyah-Beyaz</span>
            </button>

            <button
              type="button"
              onClick={() => setEnhanceMode('original')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
                enhanceMode === 'original'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/60 ring-2 ring-rose-500/40'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 border border-slate-700/80'
              }`}
            >
              <span>Orijinal</span>
            </button>
          </div>

          {/* Kırpma Hazır Ayarları */}
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            <button
              type="button"
              onClick={async () => {
                try {
                  setIsProcessing(true);
                  const res = await autoCropAndCleanCheck(imageSrc, fileName);
                  onConfirm(res.file, res.previewUrl);
                  onClose();
                } catch (e: any) {
                  alert('Otomatik kırpma hatası: ' + (e.message || ''));
                } finally {
                  setIsProcessing(false);
                }
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 transition cursor-pointer flex items-center gap-1"
              title="Çekin sınırlarını otomatik tespit edip yanlardaki beyaz alanları ve renkleri temizler"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Otomatik Kırp & Temizle</span>
            </button>
            <button
              type="button"
              onClick={handleSetCheckRatio}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-700/30 hover:bg-emerald-600/40 text-emerald-200 text-[11px] font-bold border border-emerald-500/50 transition cursor-pointer"
            >
              Çek Formatı (2.2 : 1)
            </button>
            <button
              type="button"
              onClick={handleAutoTrimMargins}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700/80 transition cursor-pointer"
            >
              Kenarları Kırp
            </button>
            <button
              type="button"
              onClick={handleResetCrop}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700/80 transition cursor-pointer"
            >
              Tamamı
            </button>
          </div>
        </div>

        {/* Workspace: Interactive Image + Crop Box */}
        <div
          ref={containerRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative flex-1 select-none overflow-hidden bg-black/95 flex items-center justify-center p-4 touch-none"
        >
          {/* Main Visual Image */}
          <div className="relative inline-block max-h-full max-w-full">
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Düzenlenecek Çek"
              onLoad={(e) => {
                initCheckRatioBox(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
              }}
              style={{
                transform: `rotate(${rotation}deg)`,
                filter:
                  enhanceMode === 'enhance'
                    ? 'contrast(1.3) brightness(1.06)'
                    : enhanceMode === 'document'
                    ? 'contrast(1.5) brightness(1.15)'
                    : enhanceMode === 'bw'
                    ? 'grayscale(1) contrast(1.4)'
                    : 'none',
              }}
              className="max-h-[62vh] sm:max-h-[68vh] w-auto max-w-full object-contain pointer-events-none transition-transform duration-200 shadow-2xl rounded-lg"
            />

            {/* Darkened Mask Layer Outside Crop Box */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(to right, rgba(0,0,0,0.7) ${cropBox.x}%, transparent ${cropBox.x}%, transparent ${cropBox.x + cropBox.width}%, rgba(0,0,0,0.7) ${cropBox.x + cropBox.width}%)`,
              }}
            />

            {/* INTERACTIVE CROP BOX */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'move')}
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.width}%`,
                height: `${cropBox.height}%`,
              }}
              className="absolute border-2 border-emerald-400 bg-emerald-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] cursor-move transition-shadow touch-none"
            >
              {/* Grid 3x3 Guide Lines */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>

              {/* Center Badge: Sadece Çek Alanı */}
              <div className="absolute top-2 left-2 pointer-events-none bg-emerald-600/90 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded shadow">
                SADECE ÇEK ALANI (ELLE AYARLAYIN)
              </div>

              {/* CORNER HANDLES */}
              {/* Top-Left */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'nw')}
                className="absolute -top-3.5 -left-3.5 h-7 w-7 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-xl cursor-nwse-resize active:scale-125 transition-transform flex items-center justify-center touch-none select-none z-20"
                title="Sol Üst Köşeyi Ayarla"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              </div>
              {/* Top-Right */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'ne')}
                className="absolute -top-3.5 -right-3.5 h-7 w-7 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-xl cursor-nesw-resize active:scale-125 transition-transform flex items-center justify-center touch-none select-none z-20"
                title="Sağ Üst Köşeyi Ayarla"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              </div>
              {/* Bottom-Left */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'sw')}
                className="absolute -bottom-3.5 -left-3.5 h-7 w-7 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-xl cursor-nesw-resize active:scale-125 transition-transform flex items-center justify-center touch-none select-none z-20"
                title="Sol Alt Köşeyi Ayarla"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              </div>
              {/* Bottom-Right */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'se')}
                className="absolute -bottom-3.5 -right-3.5 h-7 w-7 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-xl cursor-nwse-resize active:scale-125 transition-transform flex items-center justify-center touch-none select-none z-20"
                title="Sağ Alt Köşeyi Ayarla"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
              </div>

              {/* EDGE HANDLES */}
              {/* Top */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'n')}
                className="absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-12 rounded-full bg-emerald-400 border border-slate-950 shadow-md cursor-ns-resize touch-none flex items-center justify-center z-20"
                title="Üst Kenarı Ayarla"
              >
                <div className="w-5 h-1 rounded-full bg-slate-950/70" />
              </div>
              {/* Bottom */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 's')}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-4 w-12 rounded-full bg-emerald-400 border border-slate-950 shadow-md cursor-ns-resize touch-none flex items-center justify-center z-20"
                title="Alt Kenarı Ayarla"
              >
                <div className="w-5 h-1 rounded-full bg-slate-950/70" />
              </div>
              {/* Left */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'w')}
                className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-12 rounded-full bg-emerald-400 border border-slate-950 shadow-md cursor-ew-resize touch-none flex items-center justify-center z-20"
                title="Sol Kenarı Ayarla"
              >
                <div className="h-5 w-1 rounded-full bg-slate-950/70" />
              </div>
              {/* Right */}
              <div
                onPointerDown={(e) => handlePointerDown(e, 'e')}
                className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-12 rounded-full bg-emerald-400 border border-slate-950 shadow-md cursor-ew-resize touch-none flex items-center justify-center z-20"
                title="Sağ Kenarı Ayarla"
              >
                <div className="h-5 w-1 rounded-full bg-slate-950/70" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-900/95 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">
              Seçim: {Math.round(cropBox.width)}% × {Math.round(cropBox.height)}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              Vazgeç
            </button>

            <button
              type="button"
              onClick={handleApplyCropAndEnhance}
              disabled={isProcessing}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs sm:text-sm font-black transition shadow-xl shadow-emerald-950/70 border-2 border-emerald-400/70 active:scale-95 cursor-pointer uppercase tracking-wider"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>İşleniyor...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3] text-emerald-100" />
                  <span>ÇEK FORMATINDA KES VE ONAYLA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
