import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  RefreshCw,
  X,
  FlipHorizontal,
  AlertCircle,
  Scan,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File, previewUrl: string) => void;
  onOpenNativeCamera?: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onOpenNativeCamera,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scanFrameRef = useRef<HTMLDivElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Dynamic adaptive framing:
  // "EVRAĞA YAKLAŞTIKÇA EVRAĞA GÖRE TARAMA ALANINI GENİŞLER UZAKLAŞTIKÇA EVRAĞA GÖRE DARALT"
  const [frameWidthPercent, setFrameWidthPercent] = useState<number>(80);
  const [isAutoAdapting, setIsAutoAdapting] = useState<boolean>(true);
  const [distanceStatus, setDistanceStatus] = useState<'near' | 'optimal' | 'far'>('optimal');

  // Start camera stream
  const startCamera = async () => {
    setIsStarting(true);
    setError(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      // Fallback without specific facingMode if back camera fails
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        setStream(fallbackStream);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          await videoRef.current.play();
        }
      } catch (fallbackErr: any) {
        setError('Kameraya erişilemedi. Lütfen tarayıcı kamera izinlerini kontrol ediniz.');
      }
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Real-time Adaptive Edge / Scale Detection
  // "EVRAĞA YAKLAŞTIKÇA EVRAĞA GÖRE TARAMA ALANINI GENİŞLER UZAKLAŞTIKÇA EVRAĞA GÖRE DARALT"
  useEffect(() => {
    if (!isOpen || !stream || !isAutoAdapting) return;

    let isRunning = true;
    let animId: number;
    let lastCheckTime = 0;

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 80;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let currentW = frameWidthPercent;

    const detectLoop = (now: number) => {
      if (!isRunning) return;

      if (now - lastCheckTime > 140 && videoRef.current && ctx) {
        lastCheckTime = now;
        const video = videoRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
          ctx.drawImage(video, 0, 0, 120, 80);
          const imgData = ctx.getImageData(0, 0, 120, 80);
          const data = imgData.data;

          // 1. Calculate pixel luminance map
          const lum = new Float32Array(120 * 80);
          let sum = 0;
          for (let i = 0, p = 0; i < data.length; i += 4, p++) {
            const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            lum[p] = l;
            sum += l;
          }
          const avgLum = sum / (120 * 80);

          // 2. Identify document paper body vs background:
          // Checks usually have high brightness contrast relative to background or sharp edge bounds
          let minX = 120, maxX = 0;
          let docPixels = 0;
          const thresh = Math.max(75, Math.min(215, avgLum * 1.12));

          for (let y = 10; y < 70; y++) {
            for (let x = 6; x < 114; x++) {
              const val = lum[y * 120 + x];
              if (val > thresh) {
                docPixels++;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
              }
            }
          }

          let targetPercent = 80;
          if (docPixels > 300 && maxX > minX + 25) {
            // Document detected in frame!
            // When camera is close -> document spans across a larger width in the video -> frame widens!
            // When camera is far away -> document occupies fewer pixels -> frame narrows!
            const detectedSpan = maxX - minX;
            const computedPercent = Math.round((detectedSpan / 120) * 100 * 1.08);
            targetPercent = Math.max(52, Math.min(94, computedPercent));
          } else {
            // Default check framing
            targetPercent = 80;
          }

          // Smooth lerp transition so resizing feels organic and stable
          currentW = currentW * 0.72 + targetPercent * 0.28;
          const roundedW = Math.round(currentW);
          setFrameWidthPercent(roundedW);

          if (roundedW >= 84) {
            setDistanceStatus('near');
          } else if (roundedW <= 66) {
            setDistanceStatus('far');
          } else {
            setDistanceStatus('optimal');
          }
        }
      }

      animId = requestAnimationFrame(detectLoop);
    };

    animId = requestAnimationFrame(detectLoop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
    };
  }, [isOpen, stream, isAutoAdapting]);

  // SADECE O TARANAN ALANI AL VEYA TAM GÖRÜNTÜYÜ AL (DİKEY YATAY ONAY İSTEME)
  const handleCaptureScannedArea = (fullFrame: boolean = false) => {
    if (!videoRef.current) return;

    setIsScanning(true);
    if (navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch (e) {
        // ignore
      }
    }

    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!vw || !vh) {
      setIsScanning(false);
      return;
    }

    let cropX = 0;
    let cropY = 0;
    let cropW = vw;
    let cropH = vh;

    // Eğer tam kare değilse ve çerçeve varsa koordinatları hesapla
    if (!fullFrame && scanFrameRef.current && containerRef.current) {
      const videoRect = video.getBoundingClientRect();
      const frameRect = scanFrameRef.current.getBoundingClientRect();

      // Video element rendered with object-cover inside videoRect
      const scale = Math.max(videoRect.width / vw, videoRect.height / vh);
      const drawnW = vw * scale;
      const drawnH = vh * scale;

      const offsetX = (videoRect.width - drawnW) / 2;
      const offsetY = (videoRect.height - drawnH) / 2;

      const fx = frameRect.left - videoRect.left;
      const fy = frameRect.top - videoRect.top;
      const fw = frameRect.width;
      const fh = frameRect.height;

      const imgX = fx - offsetX;
      const imgY = fy - offsetY;

      // Map back to native camera source pixels
      const srcX = imgX / scale;
      const srcY = imgY / scale;
      const srcW = fw / scale;
      const srcH = fh / scale;

      // Safe bounds: Çok cömert %30 pay bırak ki üstteki DENİZBANK logosu ve alttaki seri no ASLA kesilmesin
      const padX = srcW * 0.30;
      const padY = srcH * 0.30;
      cropX = Math.max(0, srcX - padX);
      cropY = Math.max(0, srcY - padY);
      cropW = Math.min(vw - cropX, srcW + padX * 2);
      cropH = Math.min(vh - cropY, srcH + padY * 2);

      // Güvenlik Kontrolü: Mobilde dikey ekranda object-cover nedeniyle yatay çekin yanları kesilmesin
      // Eğer hesaplanan alan toplam kameranın %50'sinden darsa, tam genişliği al
      if (cropW < vw * 0.55 || cropH < vh * 0.30) {
        cropX = 0;
        cropY = 0;
        cropW = vw;
        cropH = vh;
      }
    }

    // Mobil tarayıcılarda aşırı bellek tüketimini önlemek için max 2000px ölçekleme
    const maxDim = 2000;
    let finalW = Math.round(cropW);
    let finalH = Math.round(cropH);
    if (finalW > maxDim || finalH > maxDim) {
      if (finalW > finalH) {
        finalH = Math.round((finalH * maxDim) / finalW);
        finalW = maxDim;
      } else {
        finalW = Math.round((finalW * maxDim) / finalH);
        finalH = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = finalW;
    canvas.height = finalH;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsScanning(false);
      return;
    }

    // SADECE TARANAN ALAN: Orijinal netlikte ve renkte kırpılarak aktarılır
    ctx.drawImage(
      video,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      canvas.width,
      canvas.height
    );

    // OTOMATİK EVRAK NETLEŞTİRME & KONTRAST MOTORU (NETLEŞTİRSİN)
    // Taranan çek üzerindeki seri numarasını, banka logosunu ve metinleri netleştirir
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const len = data.length;

      // 1. Dinamik Belge Kontrast & Arka Plan Temizleme
      const contrast = 32;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      const brightness = 8;

      for (let i = 0; i < len; i += 4) {
        data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128 + brightness));
        data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128 + brightness));
        data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128 + brightness));
      }
      ctx.putImageData(imgData, 0, 0);

      // 2. Convolution Sharpening (Harf ve rakam kenarlarını keskinleştir)
      if (canvas.width > 120 && canvas.height > 120) {
        const copyData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const src = copyData.data;
        const dst = imgData.data;
        const w = canvas.width;
        const h = canvas.height;
        const weight = 0.35;

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
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
      }
    } catch (enhErr) {
      console.warn('Otomatik evrak netleştirme uyarısı:', enhErr);
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const timestamp = Date.now();
          const rawUrl = URL.createObjectURL(blob);
          const file = new File([blob], `evrak_taranan_net_${timestamp}.jpg`, { type: 'image/jpeg' });

          // Doğrudan taranan ve netleştirilen evrağı aktar ve modalı kapat
          onCapture(file, rawUrl);
          onClose();
        }
        setIsScanning(false);
      },
      'image/jpeg',
      0.92
    );
  };

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleManualExpand = () => {
    setIsAutoAdapting(false);
    setFrameWidthPercent((prev) => Math.min(94, prev + 6));
  };

  const handleManualShrink = () => {
    setIsAutoAdapting(false);
    setFrameWidthPercent((prev) => Math.max(50, prev - 6));
  };

  const handleToggleAuto = () => {
    setIsAutoAdapting((prev) => !prev);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-0 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex h-full sm:h-auto sm:max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-none sm:rounded-3xl border-0 sm:border border-slate-800 bg-slate-950 shadow-2xl justify-between">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/95 px-3.5 py-3 text-white sm:px-6 sm:py-3.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-inner shrink-0">
              <Scan className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-xs sm:text-base text-slate-100 uppercase tracking-wide truncate">
                  Canlı Evrak Tarayıcı
                </h3>
                <span className="bg-emerald-500/15 text-emerald-300 text-[9px] sm:text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase font-bold flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-emerald-400" />
                  Otomatik Netleştirme Aktif
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-300 mt-0.5 truncate">
                Evrağı çerçeveye tutunuz; otomatik algılanır, netleştirilir, çek seri no ve banka analiz edilir.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer shrink-0"
            title="Kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Viewport Area - Document Camera Feed with Cutout Mask */}
        <div
          ref={containerRef}
          className="relative flex-1 sm:aspect-[16/10] md:aspect-[16/9] w-full bg-black flex items-center justify-center overflow-hidden select-none min-h-[300px]"
        >
          {error ? (
            <div className="flex flex-col items-center gap-3 p-6 text-center text-rose-400">
              <AlertCircle className="h-10 w-10" />
              <p className="text-sm font-medium text-slate-200">{error}</p>
              <button
                onClick={startCamera}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Tekrar Dene
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
              />

              {/* SADECE TARANAN ALAN ÇERÇEVESİ (SCAN FRAME) - DİNAMİK UYARLAMALI */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3 sm:p-6">
                <div
                  ref={scanFrameRef}
                  style={{
                    width: `${frameWidthPercent}%`,
                    maxWidth: `${Math.round(frameWidthPercent * 7.8)}px`,
                    transition: 'width 0.22s ease-out, max-width 0.22s ease-out',
                  }}
                  className="relative aspect-[2.15/1] rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.68)] flex flex-col justify-between p-3 sm:p-4 overflow-hidden"
                >
                  {/* Glowing 4-Corners Target Brackets */}
                  <div className="absolute -top-1.5 -left-1.5 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl shadow-lg" />
                  <div className="absolute -top-1.5 -right-1.5 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl shadow-lg" />
                  <div className="absolute -bottom-1.5 -left-1.5 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl shadow-lg" />
                  <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-xl shadow-lg" />

                  {/* Dynamic Laser Scanning Line (moves back and forth) */}
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[bounce_3s_infinite] pointer-events-none opacity-80" />

                  {/* Frame Header Badges */}
                  <div className="flex justify-between items-center z-10 gap-1.5">
                    <span className="rounded-md bg-emerald-600/95 px-2.5 py-1 text-[10px] sm:text-xs font-black text-white uppercase tracking-wider shadow border border-emerald-400/40">
                      TARANACAK ALAN
                    </span>

                    {/* Real-time distance / adaptive badge */}
                    <span className="rounded-md bg-slate-950/90 px-2.5 py-1 text-[9px] sm:text-xs font-mono font-bold border shadow flex items-center gap-1 text-emerald-300 border-emerald-500/50">
                      {distanceStatus === 'near' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                          <span>YAKIN: GENİŞLETİLDİ (%{frameWidthPercent})</span>
                        </>
                      ) : distanceStatus === 'far' ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                          <span>UZAK: DARALTILDI (%{frameWidthPercent})</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-emerald-300" />
                          <span>OTOMATİK UYARLANIYOR (%{frameWidthPercent})</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Frame Center Helper (fades in) */}
                  <div className="flex justify-center items-center pointer-events-none z-10">
                    <div className="w-12 h-12 rounded-full border border-dashed border-emerald-400/40 flex items-center justify-center opacity-40">
                      <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
                    </div>
                  </div>

                  {/* Frame Bottom Guide */}
                  <div className="flex justify-center z-10">
                    <span className="rounded-full bg-slate-950/90 px-3 py-0.5 font-mono text-[9px] sm:text-[11px] text-slate-200 border border-slate-700/80 backdrop-blur-md shadow-md text-center">
                      Yaklaştıkça genişler, uzaklaştıkça daralır
                    </span>
                  </div>
                </div>
              </div>

              {/* Scan flash effect */}
              {isScanning && (
                <div className="absolute inset-0 bg-white animate-out fade-out duration-200 pointer-events-none z-30" />
              )}
            </>
          )}

          {isStarting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/75 text-rose-400">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          )}
        </div>

        {/* Dynamic Controls Bar: Manual fine-tuning & Camera Switch */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-800 bg-slate-900/90 px-3.5 py-2 sm:px-6 gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleToggleAuto}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition cursor-pointer border ${
                isAutoAdapting
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Evrağa göre otomatik boyut uyarlamayı aç/kapat"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isAutoAdapting ? 'Otomatik Takip: AÇIK' : 'Otomatik Takip: KAPALI'}</span>
            </button>

            <button
              type="button"
              onClick={handleManualExpand}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold cursor-pointer"
              title="Tarama alanını manuel genişlet"
            >
              <Maximize2 className="w-3 h-3 text-emerald-400" />
              <span>Genişlet</span>
            </button>

            <button
              type="button"
              onClick={handleManualShrink}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold cursor-pointer"
              title="Tarama alanını manuel daralt"
            >
              <Minimize2 className="w-3 h-3 text-amber-400" />
              <span>Daralt</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleCamera}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700 transition cursor-pointer"
              title="Ön / Arka Kamerayı Değiştir"
            >
              <FlipHorizontal className="w-3.5 h-3.5 text-rose-300" />
              <span className="hidden xs:inline">Kamera Değiştir</span>
            </button>
          </div>
        </div>

        {/* Bottom Action Footer - Direct Capture Without Approval Prompts */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-800 bg-slate-900 px-3.5 py-3 sm:px-6 sm:py-4 gap-2.5 shrink-0">
          <div className="text-[11px] font-mono text-slate-400 hidden sm:block">
            Alan Boyutu: <span className="font-bold text-emerald-300">%{frameWidthPercent}</span> (Otomatik Netleştirme Aktif)
          </div>

          <div className="flex flex-wrap items-center gap-2.5 ml-auto w-full sm:w-auto">
            {/* Secondary Action: Capture Full Uncropped Camera Frame */}
            <button
              type="button"
              onClick={() => handleCaptureScannedArea(true)}
              disabled={Boolean(error) || isStarting || isScanning}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold uppercase tracking-wider transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[46px]"
              title="Çerçevenin dışını da kapsayan tam kamera görüntüsünü tarar ve netleştirir"
            >
              <Maximize2 className="w-4 h-4 text-emerald-400" />
              <span>Tam Alan Tara</span>
            </button>

            {/* Primary Action: Direct scan & clarify */}
            <button
              type="button"
              onClick={() => handleCaptureScannedArea(false)}
              disabled={Boolean(error) || isStarting || isScanning}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-6 sm:px-9 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-600 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-emerald-950/70 border-2 border-emerald-400/60 ring-2 ring-emerald-500/30 transition active:scale-95 disabled:opacity-50 cursor-pointer min-h-[50px]"
            >
              <Sparkles className="w-5 h-5 text-emerald-100" />
              <span>EVRAĞI TARA & NETLEŞTİR</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-800 bg-slate-800/80 px-4 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-700 hover:text-white transition uppercase cursor-pointer min-h-[46px]"
            >
              İptal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
