import React, { useState, useEffect, useMemo } from 'react';
import { TabConfig } from '../types';
import {
  listPersonelMailPdfs,
  downloadPersonelMailPdf,
  PersonelMailPdfItem,
  BUCKET_PERSONELMAIL,
  PERSONEL_EXACT_FOLDERS,
} from '../lib/personelPdfUploader';
import { listFolderFiles, getFilePublicUrl, supabase, BUCKET_CEKLER } from '../lib/supabase';
import jsPDF from 'jspdf';
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  Search,
  CheckCircle2,
  Calendar,
  HardDrive,
  Users,
  ExternalLink,
  X,
  FileDown,
  Loader2,
  FolderOpen,
  Sparkles,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';

interface CekTahsilatMakbuzuPanelProps {
  tab: TabConfig;
  currentUser?: string | null;
  refreshTrigger?: number;
}

const PERSONEL_TABS = [
  { key: 'ALL', label: 'TÜMÜ', folder: '' },
  { key: 'SAMETDURAK', label: 'SAMET DURAK', folder: 'SAMETDURAK' },
  { key: 'SALIHKAYA', label: 'SALİH KAYA', folder: 'SALIHKAYA' },
  { key: 'DINCERARDUC', label: 'DİNÇER ARDUÇ', folder: 'DINCERARDUC' },
  { key: 'OMERHARUN', label: 'ÖMER HARUN', folder: 'OMERHARUN' },
] as const;

export const CekTahsilatMakbuzuPanel: React.FC<CekTahsilatMakbuzuPanelProps> = ({
  tab,
  currentUser,
  refreshTrigger = 0,
}) => {
  const [activePersonelTab, setActivePersonelTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pdfList, setPdfList] = useState<PersonelMailPdfItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Preview Modal
  const [previewPdf, setPreviewPdf] = useState<{
    blobUrl: string;
    fileName: string;
    folder: string;
    personName: string;
  } | null>(null);

  // Batch PDF Generation from current folder checks
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // Fetch PDFs from personelmail storage
  const fetchPdfs = async () => {
    setLoading(true);
    try {
      const items = await listPersonelMailPdfs();
      setPdfList(items);
    } catch (err) {
      console.error('fetchPdfs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPdfs();
  }, [refreshTrigger]);

  // Clean up blob URL on close
  const handleClosePreview = () => {
    if (previewPdf?.blobUrl) {
      URL.revokeObjectURL(previewPdf.blobUrl);
    }
    setPreviewPdf(null);
  };

  // Handle View in Modal
  const handleViewPdf = async (item: PersonelMailPdfItem) => {
    setDownloadingId(item.id);
    try {
      const blob = await downloadPersonelMailPdf(item.folder, item.name);
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        setPreviewPdf({
          blobUrl,
          fileName: item.name,
          folder: item.folder,
          personName: item.personName,
        });
      } else {
        alert('Dosya indirilemedi veya bulunamadı.');
      }
    } catch (err: any) {
      alert('Dosya açılırken hata oluştu: ' + (err.message || ''));
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Direct File Download
  const handleDownloadPdf = async (item: PersonelMailPdfItem) => {
    setDownloadingId(item.id);
    try {
      const blob = await downloadPersonelMailPdf(item.folder, item.name);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      } else {
        alert('Dosya indirilemedi.');
      }
    } catch (err: any) {
      alert('İndirme hatası: ' + (err.message || ''));
    } finally {
      setDownloadingId(null);
    }
  };

  // Filtered list
  const filteredList = useMemo(() => {
    return pdfList.filter((item) => {
      // Tab filter
      if (activePersonelTab !== 'ALL' && item.folder !== activePersonelTab) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesPerson = item.personName.toLowerCase().includes(q);
        const matchesFolder = item.folder.toLowerCase().includes(q);
        if (!matchesName && !matchesPerson && !matchesFolder) return false;
      }
      return true;
    });
  }, [pdfList, activePersonelTab, searchQuery]);

  // Counts by folder
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: pdfList.length,
      SAMETDURAK: 0,
      SALIHKAYA: 0,
      DINCERARDUC: 0,
      OMERHARUN: 0,
    };
    for (const item of pdfList) {
      if (counts[item.folder] !== undefined) {
        counts[item.folder]++;
      }
    }
    return counts;
  }, [pdfList]);

  // Batch PDF Generator: Takes all checks currently saved in tab.ceklerFolder and builds a consolidated Tahsilat Makbuzu PDF
  const handleBatchGenerateCurrentFolderPdfs = async () => {
    setIsBatchGenerating(true);
    try {
      const result = await listFolderFiles(BUCKET_CEKLER, tab.ceklerFolder);
      const files = result.data || [];
      const resolvedFolder = result.resolvedFolder || tab.ceklerFolder;
      const imageFiles = files.filter(
        (f) =>
          f.name.toLowerCase().endsWith('.jpg') ||
          f.name.toLowerCase().endsWith('.jpeg') ||
          f.name.toLowerCase().endsWith('.png') ||
          f.name.toLowerCase().endsWith('.webp')
      );

      if (imageFiles.length === 0) {
        alert(`"${tab.name}" klasöründe henüz kayıtlı çek görüntüsü bulunmamaktadır.`);
        setIsBatchGenerating(false);
        return;
      }

      setBatchProgress({ current: 0, total: imageFiles.length });

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const canvasWidth = 1600;
      const canvasHeight = 2263;

      for (let i = 0; i < imageFiles.length; i++) {
        setBatchProgress({ current: i + 1, total: imageFiles.length });
        const f = imageFiles[i];

        // Download image blob
        let imgBlob: Blob | null = null;
        try {
          const { data } = await supabase.storage
            .from(BUCKET_CEKLER)
            .download(`${resolvedFolder}/${f.name}`);
          if (data) imgBlob = data;
        } catch {
          // fallback
        }

        if (!imgBlob) {
          try {
            const pub = getFilePublicUrl(BUCKET_CEKLER, resolvedFolder, f.name);
            const res = await fetch(pub);
            if (res.ok) imgBlob = await res.blob();
          } catch {
            // ignore
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // Frame
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 4;
        ctx.strokeRect(36, 36, canvasWidth - 72, canvasHeight - 72);

        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(44, 44, canvasWidth - 88, canvasHeight - 88);

        // Header band
        ctx.fillStyle = '#7A0C1E';
        ctx.fillRect(44, 44, canvasWidth - 88, 14);

        // Header title
        ctx.font = 'bold 36px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#7A0C1E';
        ctx.fillText('TÜM FİRMALAR', 68, 102);

        ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('MÜŞTERİ ÇEKİ & KIYMETLİ EVRAK TAHSİLAT MAKBUZU', 68, 132);

        ctx.font = '600 14px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#64748B';
        ctx.fillText(`EVRAK KAYIT ŞUBESİ: ${tab.name.toUpperCase()}`, 68, 156);

        // Top Check Section
        const imgBoxX = 68;
        const imgBoxY = 226;
        const imgBoxW = 1464;
        const imgBoxH = 665;

        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(imgBoxX, imgBoxY, imgBoxW, imgBoxH);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.strokeRect(imgBoxX, imgBoxY, imgBoxW, imgBoxH);

        // Draw check image
        if (imgBlob) {
          try {
            const dataUrl = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onloadend = () => res(reader.result as string);
              reader.readAsDataURL(imgBlob!);
            });
            const imgEl = new Image();
            await new Promise((res) => {
              imgEl.onload = res;
              imgEl.src = dataUrl;
            });

            const scale = Math.min(imgBoxW / imgEl.naturalWidth, imgBoxH / imgEl.naturalHeight);
            const drawW = imgEl.naturalWidth * scale;
            const drawH = imgEl.naturalHeight * scale;
            const drawX = imgBoxX + (imgBoxW - drawW) / 2;
            const drawY = imgBoxY + (imgBoxH - drawH) / 2;
            ctx.drawImage(imgEl, drawX, drawY, drawW, drawH);
          } catch {
            ctx.fillStyle = '#64748B';
            ctx.font = '16px "Segoe UI", Arial, sans-serif';
            ctx.fillText('Görsel yüklenemedi', imgBoxX + 20, imgBoxY + 40);
          }
        }

        // Tahsilat Makbuzu Title Banner
        const makbuzY = 918;
        ctx.fillStyle = '#7A0C1E';
        ctx.fillRect(imgBoxX, makbuzY, imgBoxW, 46);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ÇEK TAHSİLAT MAKBUZU', canvasWidth / 2, makbuzY + 30);
        ctx.textAlign = 'left';

        // Table details
        const tableY = 978;
        const rowH = 46;
        const colW = imgBoxW / 4;
        const cleanNo = f.name.replace(/\.[^/.]+$/, '').trim();

        // 3 rows table
        const rows = [
          [
            { label: 'EVRAK / ÇEK NO', val: cleanNo },
            { label: 'DÜZENLEME TARİHİ', val: new Date().toLocaleDateString('tr-TR') },
            { label: 'VADE TARİHİ', val: 'İbrazında / Vadeli' },
            { label: 'TUTAR', val: '..................... TL' },
          ],
          [
            { label: 'KEŞİDECİ (BORÇLU)', val: '.....................................' },
            { label: 'ÖDEME YERİ / BANKA', val: '.....................................' },
            { label: 'ŞUBE / HESAP NO', val: '.....................................' },
            { label: 'ÇEK SERİ NO', val: cleanNo },
          ],
          [
            { label: 'EVRAK TÜRÜ', val: 'Müşteri Çeki / Tahsilat Evrakı' },
            { label: 'KAYIT ŞUBESİ', val: tab.name },
            { label: 'TAHSİLAT TÜRÜ', val: 'Cari Hesaba Mahsuben Tahsilat' },
            { label: 'İŞLEM DURUMU', val: 'Kayıt Yapıldı / Portföyde' },
          ],
        ];

        rows.forEach((row, rIdx) => {
          const curY = tableY + rIdx * rowH;
          row.forEach((cell, cIdx) => {
            const curX = imgBoxX + cIdx * colW;
            ctx.fillStyle = rIdx % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
            ctx.fillRect(curX, curY, colW, rowH);
            ctx.strokeStyle = '#CBD5E1';
            ctx.strokeRect(curX, curY, colW, rowH);

            ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#475569';
            ctx.fillText(cell.label, curX + 12, curY + 18);

            ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#0F172A';
            ctx.fillText(cell.val, curX + 12, curY + 36);
          });
        });

        // Beyan & Signature Area
        const beyanY = tableY + rows.length * rowH + 20;
        ctx.fillStyle = '#F1F5F9';
        ctx.fillRect(imgBoxX, beyanY, imgBoxW, 70);
        ctx.strokeStyle = '#CBD5E1';
        ctx.strokeRect(imgBoxX, beyanY, imgBoxW, 70);

        ctx.font = 'bold 12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#1E293B';
        ctx.fillText('TAHSİLAT BEYANI & KABUL:', imgBoxX + 16, beyanY + 26);
        ctx.font = '12px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText(
          `Yukarıda bilgileri ve çek görüntüsü yer alan ${cleanNo} numaralı kıymetli evrak, cari hesabımıza mahsuben teslim alınmıştır.`,
          imgBoxX + 16,
          beyanY + 48
        );

        // Signatures
        const signY = beyanY + 94;
        const signW = (imgBoxW - 40) / 2;
        const signH = 140;

        // Teslim Eden
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(imgBoxX, signY, signW, signH);
        ctx.strokeStyle = '#94A3B8';
        ctx.strokeRect(imgBoxX, signY, signW, signH);
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText('TESLİM EDEN (MÜŞTERİ / VEKİLİ)', imgBoxX + 16, signY + 28);
        ctx.font = '11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#64748B';
        ctx.fillText('Kaşe / İmza:', imgBoxX + 16, signY + 54);

        // Teslim Alan
        const sign2X = imgBoxX + signW + 40;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(sign2X, signY, signW, signH);
        ctx.strokeStyle = '#94A3B8';
        ctx.strokeRect(sign2X, signY, signW, signH);
        ctx.fillStyle = '#7A0C1E';
        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillText('TESLİM ALAN (TÜM FİRMALAR YETKİLİSİ)', sign2X + 16, signY + 28);
        ctx.font = '11px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#64748B';
        ctx.fillText('Kaşe / İmza:', sign2X + 16, signY + 54);

        // Add page to doc
        if (i > 0) doc.addPage('a4', 'portrait');
        const pageUrl = canvas.toDataURL('image/jpeg', 0.94);
        doc.addImage(pageUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const outBlob = doc.output('blob');
      const dlUrl = URL.createObjectURL(outBlob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `Cek_Tahsilat_Makbuzlari_${tab.name}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 2000);
    } catch (err: any) {
      alert('Toplu makbuz oluşturulurken hata meydana geldi: ' + (err.message || ''));
    } finally {
      setIsBatchGenerating(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950 p-5 sm:p-7 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-300">
      {/* 1. BAŞLIK BÖLÜMÜ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-500/20 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg shadow-emerald-950/50 border border-emerald-400/40">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                ÇEK TAHSİLAT MAKBUZU
              </h3>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                TÜM FİRMALAR STANDARDI
              </span>
              <span className="rounded-full bg-blue-500/20 border border-blue-500/40 px-2.5 py-0.5 text-[10px] font-mono font-bold text-blue-300">
                personelmail DEPOSU
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Personellere aktarılan tahsilat makbuzu PDF dosyaları ve bu şubenin toplu makbuz dökümü
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları (Yenile & Toplu PDF İndir) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={fetchPdfs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Makbuz Listesini Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            <span>Yenile</span>
          </button>

          <button
            type="button"
            onClick={handleBatchGenerateCurrentFolderPdfs}
            disabled={isBatchGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-black transition-all shadow-lg shadow-emerald-950/60 active:scale-95 disabled:opacity-50 cursor-pointer border border-emerald-400/50 uppercase tracking-wide"
            title={`${tab.name} klasöründeki tüm çeklerden A4 standart Tahsilat Makbuzu PDF dosyası oluşturup indirir`}
          >
            {isBatchGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>
                  {batchProgress.total > 0
                    ? `Makbuzlar Hazırlanıyor (${batchProgress.current}/${batchProgress.total})...`
                    : 'PDF Hazırlanıyor...'}
                </span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-emerald-100" />
                <span>ŞUBE ÇEKLERİNDEN TOPLU MAKBUZ İNDİR (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. PERSONEL SEKMELERİ & KLASÖR FİLTRELERİ */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            {PERSONEL_TABS.map((pt) => {
              const isActive = activePersonelTab === pt.key;
              const count = folderCounts[pt.key] || 0;
              return (
                <button
                  key={pt.key}
                  type="button"
                  onClick={() => setActivePersonelTab(pt.key)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap border ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-950/50 ring-2 ring-emerald-500/30'
                      : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span>{pt.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-black ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-400 border border-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Arama Kutusu */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Çek No veya Personel Ara..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. PERSONELMAIL PDF DOSYALARI LİSTESİ */}
      <div className="mt-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <span className="text-xs font-mono font-medium">personelmail klasörleri taranıyor...</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8 text-center">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-300">
              {searchQuery ? 'Aramanıza uygun makbuz bulunamadı.' : 'Henüz kayıtlı tahsilat makbuzu bulunmuyor.'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Çek kaydederken ilgili personelleri (Samet, Salih, Dinçer, Ömer) işaretlediğinizde resmi tahsilat makbuzu PDF'i otomatik oluşturulup bu alana aktarılır.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredList.map((item) => {
              const isWorking = downloadingId === item.id;
              const dateStr = item.created_at
                ? new Date(item.created_at).toLocaleString('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Tarih belirtilmedi';

              const cleanDocNo = item.name.replace(/\.[^/.]+$/, '');

              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 hover:border-emerald-500/50 hover:bg-slate-900/90 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-mono text-sm font-black text-slate-100 truncate group-hover:text-emerald-300 transition-colors">
                            {cleanDocNo}
                          </h4>
                          <span className="text-[10px] font-mono text-emerald-400 font-bold flex items-center gap-1">
                            📁 {item.folder}
                          </span>
                        </div>
                      </div>

                      <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 shrink-0 border border-slate-700">
                        {(item.size / 1024).toFixed(0)} KB
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 font-mono border-t border-slate-800/80 pt-2.5">
                      <span className="text-slate-300 font-semibold truncate">{item.personName}</span>
                      <span className="text-slate-400 text-[10px]">{dateStr}</span>
                    </div>
                  </div>

                  {/* Kart Butonları */}
                  <div className="mt-3.5 flex items-center gap-2 pt-2 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => handleViewPdf(item)}
                      disabled={isWorking}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition border border-slate-700 cursor-pointer disabled:opacity-50"
                      title="PDF Makbuzunu Görüntüle"
                    >
                      {isWorking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                      )}
                      <span>Görüntüle</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(item)}
                      disabled={isWorking}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 hover:text-white text-xs font-bold transition border border-emerald-500/40 cursor-pointer disabled:opacity-50"
                      title="PDF Makbuzunu İndir"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-300" />
                      <span>İndir</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. PDF GÖRÜNTÜLEYİCİ MODAL */}
      {previewPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative flex h-full max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-emerald-500/40 bg-slate-950 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white sm:px-6">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-mono text-sm sm:text-base font-bold text-white truncate">
                    {previewPdf.fileName}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Klasör: <span className="font-mono text-emerald-400 font-bold">{previewPdf.folder}</span> ({previewPdf.personName})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewPdf.blobUrl}
                  download={previewPdf.fileName}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">İndir</span>
                </a>

                <button
                  type="button"
                  onClick={handleClosePreview}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded PDF */}
            <div className="flex-1 bg-slate-900 p-2 sm:p-4 overflow-hidden flex items-center justify-center">
              <object
                data={previewPdf.blobUrl}
                type="application/pdf"
                className="w-full h-full rounded-xl border border-slate-800 shadow-2xl"
              >
                <div className="p-8 text-center text-slate-300">
                  <p className="mb-4">Tarayıcınız PDF önizlemeyi doğrudan desteklemiyor.</p>
                  <a
                    href={previewPdf.blobUrl}
                    download={previewPdf.fileName}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold"
                  >
                    <Download className="w-4 h-4" /> PDF Dosyasını İndir
                  </a>
                </div>
              </object>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
