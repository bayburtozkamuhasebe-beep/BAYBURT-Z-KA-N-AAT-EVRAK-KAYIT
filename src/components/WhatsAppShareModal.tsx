import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Download,
  CheckCircle2,
  FileText,
  ExternalLink,
  MessageCircle,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface WhatsAppShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlob: Blob | null;
  pdfPublicUrl?: string | null;
  checkNumber: string;
  tabName: string;
  savedFileName: string;
  santiye?: string;
}

export const WhatsAppShareModal: React.FC<WhatsAppShareModalProps> = ({
  isOpen,
  onClose,
  pdfBlob,
  pdfPublicUrl,
  checkNumber,
  tabName,
  savedFileName,
  santiye,
}) => {
  const [countdown, setCountdown] = useState<number>(25);
  const [isAutoClosePaused, setIsAutoClosePaused] = useState<boolean>(false);
  const [shareStatus, setShareStatus] = useState<'idle' | 'success' | 'shared' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Generate object URL for PDF preview and download
  useEffect(() => {
    if (pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setBlobUrl(null);
    }
  }, [pdfBlob]);

  // Reset countdown and status when opened
  useEffect(() => {
    if (isOpen) {
      setCountdown(25);
      setIsAutoClosePaused(false);
      setShareStatus('idle');
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Auto-close countdown timer ("gönderimden sonra whatsapp kapansın")
  useEffect(() => {
    if (!isOpen || isAutoClosePaused) return;

    if (countdown <= 0) {
      onClose();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, isAutoClosePaused, countdown, onClose]);

  if (!isOpen) return null;

  const todayStr = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const cleanCheckNo = checkNumber.replace(/\.[^/.]+$/, '').trim();
  const pdfDownloadName = `${cleanCheckNo || 'Cek'}_Teslim_Belgesi.pdf`;

  // Pre-formatted message for WhatsApp
  const shareMessageText = [
    `📋 *FİRMA ÇEK TESLİM BELGESİ*`,
    `🏢 *Firma:* ${tabName}`,
    santiye ? `🏗️ *Şantiye:* ${santiye}` : '',
    `🔢 *Çek No:* ${cleanCheckNo}`,
    `📅 *Tarih:* ${todayStr}`,
    `✓ Çek taraması sisteme kaydedildi.`,
    pdfPublicUrl ? `📄 *Teslim Belgesi PDF Bağlantısı:*\n${pdfPublicUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const encodedMessage = encodeURIComponent(shareMessageText);
  const whatsappWebUrl = `https://web.whatsapp.com/send?text=${encodedMessage}`;
  const whatsappMobileUrl = `https://api.whatsapp.com/send?text=${encodedMessage}`;

  // Handle Native Share (Mobile Safari / Android Chrome / Supported Desktop)
  // Direct file transfer into WhatsApp contact selector!
  const handleNativeShare = async () => {
    setIsAutoClosePaused(true);
    setErrorMessage(null);

    if (!pdfBlob) {
      setErrorMessage('PDF dosyası henüz hazır değil.');
      return;
    }

    try {
      const pdfFile = new File([pdfBlob], pdfDownloadName, {
        type: 'application/pdf',
      });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: `${tabName} - Çek Teslim Belgesi`,
          text: `${tabName} Çek Teslim Belgesi (Çek No: ${cleanCheckNo}) ektedir.`,
          files: [pdfFile],
        });
        setShareStatus('shared');
        // Once shared, allow quick auto-close after 3 seconds
        setCountdown(4);
        setIsAutoClosePaused(false);
      } else if (navigator.share) {
        // Fallback share without file if file sharing not permitted
        await navigator.share({
          title: `${tabName} - Çek Teslim Belgesi`,
          text: shareMessageText,
          url: pdfPublicUrl || undefined,
        });
        setShareStatus('shared');
        setCountdown(4);
        setIsAutoClosePaused(false);
      } else {
        // Trigger download and open WhatsApp Web
        handleDownloadPdf();
        setShareStatus('shared');
        window.open(whatsappWebUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Share error:', err);
        setErrorMessage('Paylaşım sırasında bir hata oluştu veya desteklenmiyor.');
      }
    }
  };

  const handleDownloadPdf = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = pdfDownloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border-2 border-emerald-500/50 rounded-3xl shadow-2xl shadow-emerald-950/80 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header with WhatsApp Green Accent */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#075E54] via-[#128C7E] to-[#25D366] text-white flex items-center justify-between shadow-lg shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shadow-inner">
              <MessageCircle className="w-6 h-6 text-white fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-wide">
                  WHATSAPP İLE GÖNDER
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-white/25 text-[10px] font-mono font-bold uppercase tracking-wider">
                  PDF Teslim Belgesi
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-medium">
                Evrak Supabase'e kaydedildi, Çek Teslim Belgesi hazırlandı
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Status Alert */}
          <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-slate-200 space-y-1">
              <p className="font-bold text-emerald-300">
                1. Adım Başarılı: Orijinal Evrak Supabase'e Kaydedildi!
              </p>
              <p className="text-slate-400 text-xs">
                2. Adım: <strong className="text-slate-200">ÖRNEK.jpg formatındaki resmi Çek Teslim Belgesi PDF</strong> oluşturuldu. Şimdi WhatsApp üzerinden dilediğiniz kişi veya gruplara seçip gönderebilirsiniz.
              </p>
            </div>
          </div>

          {/* Info Card */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Firma / Şube:</span>
              <span className="font-bold text-white font-mono bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
                {tabName}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Çek Seri No:</span>
              <span className="font-bold text-emerald-400 font-mono text-sm bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                {cleanCheckNo}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Hazırlanan Belge:</span>
              <span className="font-bold text-slate-300 font-mono text-[11px] truncate max-w-[260px]">
                {pdfDownloadName}
              </span>
            </div>
          </div>

          {/* PDF Preview Frame (Compact) */}
          {blobUrl && (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-2 overflow-hidden shadow-inner">
              <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <FileText className="w-3.5 h-3.5" />
                  Resmi Çek Teslim Belgesi (A4 Dikey PDF Önizleme)
                </span>
                <span className="text-[10px] text-slate-500">ÖRNEK.jpg Formatı</span>
              </div>
              <div className="h-44 sm:h-52 w-full mt-1.5 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                <iframe
                  src={`${blobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  title="PDF Çek Teslim Belgesi Önizleme"
                  className="w-full h-full border-0 pointer-events-none opacity-90"
                />
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="space-y-2.5 pt-1">
            {/* 1. Main Action: Direct Native Share to WhatsApp Contacts with Attached PDF */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full min-h-[52px] px-6 py-3.5 bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#075E54] hover:from-[#1EBE5D] hover:to-[#0F7669] text-white font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/80 hover:shadow-emerald-900/90 active:scale-95 transition-all cursor-pointer uppercase tracking-wider border border-emerald-400/50"
            >
              <MessageCircle className="w-6 h-6 fill-white" />
              <span>WhatsApp'a Bağlan & Kişi Seçip Gönder</span>
              <Share2 className="w-5 h-5 opacity-90 ml-auto shrink-0" />
            </button>

            {/* 2. Secondary Actions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* WhatsApp Web Direct Link */}
              <a
                href={whatsappWebUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  handleDownloadPdf();
                  setIsAutoClosePaused(true);
                  setShareStatus('shared');
                }}
                className="min-h-[46px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-700 hover:border-emerald-500/40 transition-all shadow-md text-center"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>WhatsApp Web ile Aç</span>
              </a>

              {/* Direct PDF Download */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="min-h-[46px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 border border-slate-700 hover:border-cyan-500/40 transition-all shadow-md cursor-pointer text-center"
              >
                <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>PDF Teslim Belgesini İndir</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Auto-Close Countdown & Dismiss Button */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
            {!isAutoClosePaused ? (
              <span>
                Gönderim sonrası otomatik kapanış:{' '}
                <strong className="text-emerald-400 font-mono font-bold">{countdown} sn</strong>
              </span>
            ) : (
              <span>Otomatik sayaç duraklatıldı</span>
            )}
            <button
              type="button"
              onClick={() => setIsAutoClosePaused((p) => !p)}
              className="text-[11px] underline text-slate-500 hover:text-slate-300 ml-1 cursor-pointer"
            >
              {isAutoClosePaused ? 'Devam Et' : 'Durdur'}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 hover:border-rose-500/50 transition-all cursor-pointer tracking-wide uppercase"
          >
            Gönderim Tamamlandı / Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
