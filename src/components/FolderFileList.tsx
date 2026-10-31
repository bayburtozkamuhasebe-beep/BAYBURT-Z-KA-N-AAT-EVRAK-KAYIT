import React, { useEffect, useState, useMemo } from 'react';
import { listFolderFiles, getFilePublicUrl, supabase } from '../lib/supabase';
import { UploadedFileItem } from '../types';
import {
  loadUserMappings,
  getFileUserName,
  getFilePersonnel,
  getFileSantiye,
  DEFAULT_USERS,
} from '../lib/userFileManager';
import jsPDF from 'jspdf';
import {
  RefreshCw,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  Search,
  Clock,
  X,
  FilePlus2,
  FileDown,
  Loader2,
  Check,
  CheckCheck,
  Building2,
} from 'lucide-react';

interface FolderFileListProps {
  bucket: string;
  folder: string;
  folderName: string;
  title: string;
  refreshTrigger?: number;
  themeColor?: 'bordo' | 'emerald';
  currentUser?: string | null;
}

interface UserStyleInfo {
  name: string;
  initials: string;
  avatarBg: string;
  borderColor: string;
  headerBg: string;
}

export function getUserStyle(userName?: string): UserStyleInfo {
  const norm = (userName || '').toLowerCase();
  if (norm.includes('hamza')) {
    return {
      name: 'Hamza Kaldırım',
      initials: 'HK',
      avatarBg: 'bg-gradient-to-br from-[#7A0C1E] via-[#9e1027] to-rose-600 text-white',
      borderColor: 'border-rose-500/40',
      headerBg: 'bg-gradient-to-r from-[#7A0C1E]/30 via-slate-900/60 to-slate-950/80',
    };
  }
  if (norm.includes('murat')) {
    return {
      name: 'Murat Kaldırım',
      initials: 'MK',
      avatarBg: 'bg-gradient-to-br from-blue-950 via-blue-800 to-indigo-600 text-white',
      borderColor: 'border-blue-500/40',
      headerBg: 'bg-gradient-to-r from-blue-950/40 via-slate-900/60 to-slate-950/80',
    };
  }
  if (norm.includes('emirhan')) {
    return {
      name: 'Emirhan Kalhan',
      initials: 'EK',
      avatarBg: 'bg-gradient-to-br from-emerald-950 via-teal-800 to-emerald-500 text-white',
      borderColor: 'border-emerald-500/40',
      headerBg: 'bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-950/80',
    };
  }

  // Fallback style
  const initials = userName
    ? userName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'BK';
  return {
    name: userName || 'Yetkili Kullanıcı',
    initials,
    avatarBg: 'bg-gradient-to-br from-amber-900 to-amber-600 text-white',
    borderColor: 'border-amber-500/40',
    headerBg: 'bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-slate-950/80',
  };
}

export const FolderFileList: React.FC<FolderFileListProps> = ({
  bucket,
  folder,
  folderName,
  title,
  refreshTrigger = 0,
  themeColor = 'bordo',
  currentUser,
}) => {
  const [files, setFiles] = useState<UploadedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [resolvedFolderName, setResolvedFolderName] = useState(folder);
  const [selectedPreview, setSelectedPreview] = useState<{ url: string; name: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });

  // Seçili evraklar (tik kutucuğu durumları)
  const [selectedFileNames, setSelectedFileNames] = useState<Set<string>>(new Set());

  // SADECE GİRİŞ YAPAN KULLANICININ ALANI
  const activeUser = currentUser || DEFAULT_USERS[0];
  const userStyle = getUserStyle(activeUser);

  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('DataUrl dönüştürülemedi'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const loadImageElement = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  };

  const fetchFiles = async () => {
    setLoading(true);
    await loadUserMappings();
    const { data, resolvedFolder } = await listFolderFiles(bucket, folder);
    if (resolvedFolder) setResolvedFolderName(resolvedFolder);
    const validFiles = (data || []).filter((f) => f.name && !f.name.startsWith('.'));
    setFiles(validFiles);
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
  }, [bucket, folder, refreshTrigger]);

  // Her kullanıcı sadece kendi adına kayıtlı çekleri görsün
  const userScopedFiles = useMemo(() => {
    return files.filter((file) => getFileUserName(file, activeUser) === activeUser);
  }, [files, activeUser]);

  const filteredFiles = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return userScopedFiles.filter((file) => {
      if (!term) return true;
      const fileSantiye = getFileSantiye(file);
      return (
        file.name.toLowerCase().includes(term) ||
        (fileSantiye && fileSantiye.toLowerCase().includes(term))
      );
    });
  }, [userScopedFiles, searchTerm]);

  // Sayfa yüklendiğinde veya filtrelenen liste değiştiğinde varsayılan olarak hepsini seç
  useEffect(() => {
    if (filteredFiles.length > 0) {
      setSelectedFileNames((prev) => {
        // Eğer henüz hiçbir seçim yapılmamışsa tümünü seçili başlat
        if (prev.size === 0) {
          return new Set(filteredFiles.map((f) => f.name));
        }
        return prev;
      });
    }
  }, [filteredFiles]);

  const toggleSelectFile = (fileName: string) => {
    setSelectedFileNames((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  };

  const isAllSelected =
    filteredFiles.length > 0 && filteredFiles.every((f) => selectedFileNames.has(f.name));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedFileNames(new Set());
    } else {
      setSelectedFileNames(new Set(filteredFiles.map((f) => f.name)));
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return dateString;
    }
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext || '');
  };

  const isPdfFile = (fileName: string) => {
    return fileName.toLowerCase().endsWith('.pdf');
  };

  // ==========================================
  // TAHSİLAT MAKBUZU HAZIRLA & TEK PDF OLUŞTUR
  // ==========================================
  // Her sayfada:
  // ÜSTE: Çekin Görüntüsü
  // ALTINDA: Çek Tahsilat Makbuzu
  const handleGenerateTahsilatMakbuzuPdf = async () => {
    // Sadece seçili olan evraklar (veya hepsi)
    const targetFiles = filteredFiles.filter((f) => selectedFileNames.has(f.name));

    if (targetFiles.length === 0) {
      alert('Lütfen tahsilat makbuzu hazırlanacak en az bir çek/evrak seçiniz.');
      return;
    }

    setIsGeneratingPdf(true);
    setPdfProgress({ current: 0, total: targetFiles.length });

    try {
      // Tek PDF dökümanı (A4 dikey format - kurumsal makbuz standardı)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const canvasWidth = 1600;
      const canvasHeight = 2263; // A4 aspect ratio 210 x 297

      for (let i = 0; i < targetFiles.length; i++) {
        const file = targetFiles[i];
        setPdfProgress({ current: i + 1, total: targetFiles.length });

        const fullPath = resolvedFolderName ? `${resolvedFolderName}/${file.name}` : file.name;
        const pubUrl = getFilePublicUrl(bucket, resolvedFolderName, file.name);

        // 1. Resmi Supabase Storage veya Public URL üzerinden indir
        let blob: Blob | null = null;
        try {
          const { data, error } = await supabase.storage.from(bucket).download(fullPath);
          if (!error && data && data.size > 0) {
            blob = data;
          }
        } catch (err) {
          console.warn('Storage download warning:', fullPath, err);
        }

        if (!blob) {
          try {
            const resp = await fetch(pubUrl);
            if (resp.ok) {
              blob = await resp.blob();
            }
          } catch (fetchErr) {
            console.warn('Fetch fallback warning:', file.name, fetchErr);
          }
        }

        let imgElement: HTMLImageElement | null = null;
        if (blob) {
          try {
            const dataUrl = await blobToDataUrl(blob);
            imgElement = await loadImageElement(dataUrl);
          } catch (imgLoadErr) {
            console.warn('Image element load warning:', file.name, imgLoadErr);
          }
        }

        // 2. Yüksek Çözünürlüklü A4 Sayfa Canvas'ı Oluştur (ÖRNEK.JPG BİREBİR ŞABLON)
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;

        // Arka plan: Temiz Beyaz
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const leftX = 70;
        const rightX = 1530;
        const contentW = rightX - leftX; // 1460 px

        const cleanNo = file.name.replace(/\.[^/.]+$/, '').trim();
        const todayStr = new Intl.DateTimeFormat('tr-TR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(new Date());

        // 1. ÜST BAŞLIK BÖLÜMÜ (ÖRNEK.JPG)
        ctx.font = 'bold 14.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'left';
        ctx.fillText('RESMİ TİCARİ BELGE - ÇEK TESLİM BELGESİ', leftX, 78);

        ctx.font = '900 48px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('FİRMA ÇEK TESLİM', leftX, 130);
        ctx.fillText('BELGESİ', leftX, 180);

        // Sağ Üst Kutular: MAKBUZ NO ve TARİH (Belirgin ve kalın çerçeveli iki kutu)
        const boxTopY = 64;
        const boxH = 88;

        // Kutu 1: MAKBUZ NO
        const makbuzBoxX = 920;
        const makbuzBoxW = 360;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(makbuzBoxX, boxTopY, makbuzBoxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('MAKBUZ NO:', makbuzBoxX + 18, boxTopY + 30);

        ctx.font = 'bold 20px monospace';
        const checkNoOnly = cleanNo.split('_')[0] || cleanNo;
        const makbuzNoValue = checkNoOnly ? `MKB-${checkNoOnly}` : 'MKB-';
        ctx.fillText(makbuzNoValue, makbuzBoxX + 18, boxTopY + 65);

        // Kutu 2: TARİH
        const dateBoxX = 1300;
        const dateBoxW = 230;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(dateBoxX, boxTopY, dateBoxW, boxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('TARİH:', dateBoxX + 18, boxTopY + 30);

        ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText(todayStr, dateBoxX + 18, boxTopY + 65);

        // 2. ÇEK BİLGİLERİ VE TAHSİLAT DETAYI BAŞLIĞI
        const section1Y = 230;
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('ÇEK BİLGİLERİ VE TAHSİLAT DETAYI', leftX, section1Y);

        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'right';
        ctx.fillText('TÜRK TİCARET KANUNU ÇEK HÜKÜMLERİNE TABİDİR', rightX, section1Y);
        ctx.textAlign = 'left';

        // Belirgin yatay çizgi
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(leftX, section1Y + 12);
        ctx.lineTo(rightX, section1Y + 12);
        ctx.stroke();

        // 3. ÇEK DETAY TABLOSU (Belirgin Çizgili 4 Kolon: ÇEK SERİ NO | VADE TARİHİ | KEŞİDE YERİ | TUTARI (₺))
        const tableTopY = section1Y + 24;
        const col1W = 320;
        const col2W = 320;
        const col3W = 440;
        const col4W = contentW - col1W - col2W - col3W; // 380 px

        const headerH = 54;
        const dataRowH = 62;

        // Başlık Satırı Arka Planı (#DCE6F2)
        ctx.fillStyle = '#DCE6F2';
        ctx.fillRect(leftX, tableTopY, contentW, headerH);

        // Belirgin Kalın Dış Çerçeve
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(leftX, tableTopY, contentW, headerH + dataRowH);

        // Belirgin Yatay Ara Çizgi
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(leftX, tableTopY + headerH);
        ctx.lineTo(rightX, tableTopY + headerH);
        ctx.stroke();

        // Dikey Kolon Çizgileri
        const cX1 = leftX + col1W;
        const cX2 = cX1 + col2W;
        const cX3 = cX2 + col3W;

        [cX1, cX2, cX3].forEach((cx) => {
          ctx.beginPath();
          ctx.moveTo(cx, tableTopY);
          ctx.lineTo(cx, tableTopY + headerH + dataRowH);
          ctx.stroke();
        });

        // Net ve Büyük Başlık Metinleri
        ctx.font = 'bold 16.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';

        ctx.fillText('ÇEK SERİ NO', leftX + col1W / 2, tableTopY + 34);
        ctx.fillText('VADE TARİHİ', cX1 + col2W / 2, tableTopY + 34);
        ctx.fillText('KEŞİDE YERİ', cX2 + col3W / 2, tableTopY + 34);
        ctx.fillText('TUTARI (₺)', cX3 + col4W / 2, tableTopY + 34);

        // Net ve Büyük Veri Satırı Metinleri
        const dataTextY = tableTopY + headerH + 39;
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#000000';
        ctx.fillText(checkNoOnly || '............', leftX + col1W / 2, dataTextY);

        ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('..... / ..... / 202...', cX1 + col2W / 2, dataTextY);
        const cardSantiye = getFileSantiye(file);
        ctx.fillText(cardSantiye || '............................', cX2 + col3W / 2, dataTextY);

        ctx.textAlign = 'right';
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('.................................. ₺', rightX - 24, dataTextY);
        ctx.textAlign = 'left';

        // 4. YALNIZ (YAZIYLA TUTAR) KUTUSU (Belirgin Çizgili)
        const yaziBoxY = tableTopY + headerH + dataRowH + 18;
        const yaziBoxH = 54;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(leftX, yaziBoxY, contentW, yaziBoxH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('YALNIZ (YAZIYLA TUTAR):', leftX + 18, yaziBoxY + 33);

        ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('#', leftX + 250, yaziBoxY + 33);

        ctx.font = 'bold 15px monospace';
        ctx.fillStyle = '#64748B';
        ctx.fillText(
          '..................................................................................................................................................................',
          leftX + 270,
          yaziBoxY + 33
        );

        ctx.font = 'bold 17px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText('#', rightX - 18, yaziBoxY + 33);
        ctx.textAlign = 'left';

        // 5. TAHSİL EDİLEN ÇEKİN GÖRÜNTÜSÜ / ÇEK SURETİ (ÖN YÜZ) BAŞLIĞI
        const section2Y = yaziBoxY + yaziBoxH + 36;
        ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('■  TAHSİL EDİLEN ÇEKİN GÖRÜNTÜSÜ / ÇEK SURETİ (ÖN YÜZ)', leftX, section2Y);

        ctx.textAlign = 'right';
        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#047857';
        ctx.fillText('✔ Görsel Eklendi', rightX, section2Y);
        ctx.textAlign = 'left';

        // 6. ÇEK GÖRSELİ KUTUSU (Belirgin Kalın Çerçeve)
        const imgContainerY = section2Y + 16;
        const imgContainerH = 920;

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(leftX, imgContainerY, contentW, imgContainerH, 8);
        ctx.fill();
        ctx.stroke();

        // Çekin Görselini Çiz
        if (imgElement && imgElement.naturalWidth > 0 && imgElement.naturalHeight > 0) {
          const padX = 24;
          const padY = 24;
          const maxDrawW = contentW - padX * 2;
          const maxDrawH = imgContainerH - padY * 2 - 28;

          let drawW = maxDrawW;
          let drawH = Math.round(drawW * (imgElement.naturalHeight / imgElement.naturalWidth));

          if (drawH > maxDrawH) {
            const scale = maxDrawH / drawH;
            drawH = maxDrawH;
            drawW = Math.round(drawW * scale);
          }

          const drawX = leftX + (contentW - drawW) / 2;
          const drawY = imgContainerY + padY + (maxDrawH - drawH) / 2;

          ctx.drawImage(imgElement, drawX, drawY, drawW, drawH);

          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(drawX, drawY, drawW, drawH);
        } else {
          ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
          ctx.fillStyle = '#334155';
          ctx.textAlign = 'center';
          ctx.fillText(`EVRAK / ÇEK DOSYASI: ${cleanNo}`, leftX + contentW / 2, imgContainerY + imgContainerH / 2 - 10);
          ctx.font = '16px "Segoe UI", Arial, sans-serif';
          ctx.fillText('(Görüntü Dijital Olarak Kaydedilmiştir)', leftX + contentW / 2, imgContainerY + imgContainerH / 2 + 20);
          ctx.textAlign = 'left';
        }

        ctx.textAlign = 'right';
        ctx.font = 'bold 13.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('ASLI GÖRÜLMÜŞTÜR - ÇEK SURETİ', rightX - 22, imgContainerY + imgContainerH - 18);
        ctx.textAlign = 'left';

        // 7. AÇIKLAMA / MAHSUP BİLGİSİ KUTUSU (Belirgin Çerçeve)
        const aciklamaY = imgContainerY + imgContainerH + 22;
        const aciklamaH = 58;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(leftX, aciklamaY, contentW, aciklamaH, 8);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('Açıklama / Mahsup Bilgisi:', leftX + 18, aciklamaY + 36);

        ctx.font = 'bold 15.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#0F172A';
        ctx.fillText('  Yukarıda görüntüsü ve bilgileri mevcut olan çeki elden teslim aldım', leftX + 235, aciklamaY + 36);

        // 8. YASAL HÜKÜM BÖLÜMÜ (Net ve Belirgin)
        const yasalY = aciklamaY + aciklamaH + 26;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftX, yasalY);
        ctx.lineTo(rightX, yasalY);
        ctx.stroke();

        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('Yasal Hüküm:', leftX, yasalY + 24);

        ctx.font = '600 12.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#1E293B';
        ctx.fillText(
          'İşbu makbuz ile teslim alınan yukarıda dökümü yazılı çek, bankaca tahsil edilip firma hesabına geçtiğinde borçtan mahsup edilecektir. Çekin',
          leftX + 96,
          yasalY + 24
        );
        ctx.fillText(
          'herhangi bir nedenle karşılıksız çıkması veya ödenmemesi halinde makbuz hükümsüzdür.',
          leftX,
          yasalY + 44
        );

        // 9. İMZA / KAŞE KUTULARI (Belirgin Çizgili İki Kutu ve Gerçek Kesikli İmza Çizgisi)
        const sigY = yasalY + 62;
        const sigBoxH = 260;
        const sigGap = 30;
        const sigBoxW = (contentW - sigGap) / 2;

        // Sol Kutu: TESLİM EDEN FİRMA
        const leftSigBoxX = leftX;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(leftSigBoxX, sigY, sigBoxW, sigBoxH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = '900 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('TESLİM EDEN FİRMA', leftSigBoxX + sigBoxW / 2, sigY + 42);

        ctx.font = 'bold 14.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('Kaşe / Yetkili İmza', leftSigBoxX + sigBoxW / 2, sigY + 68);

        // Belirgin Kesikli Çizgi
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(leftSigBoxX + 45, sigY + 195);
        ctx.lineTo(leftSigBoxX + sigBoxW - 45, sigY + 195);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 13.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('İmza / Kaşe', leftSigBoxX + sigBoxW / 2, sigY + 224);

        // Sağ Kutu: TESLİM ALAN FİRMA
        const rightSigBoxX = leftX + sigBoxW + sigGap;
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(rightSigBoxX, sigY, sigBoxW, sigBoxH, 10);
        ctx.fill();
        ctx.stroke();

        ctx.font = '900 18px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#000000';
        ctx.fillText('TESLİM ALAN FİRMA', rightSigBoxX + sigBoxW / 2, sigY + 42);

        ctx.font = 'bold 14.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('Firma Kaşesi / Yetkili İmza', rightSigBoxX + sigBoxW / 2, sigY + 68);

        // Belirgin Kesikli Çizgi
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(rightSigBoxX + 45, sigY + 195);
        ctx.lineTo(rightSigBoxX + sigBoxW - 45, sigY + 195);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 13.5px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('İmza / Kaşe', rightSigBoxX + sigBoxW / 2, sigY + 224);

        ctx.textAlign = 'left';

        // 10. ALT BİLGİ (FOOTER)
        const footerY = sigY + sigBoxH + 34;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(leftX, footerY);
        ctx.lineTo(rightX, footerY);
        ctx.stroke();

        ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.fillText('Resmi Firma Çek Teslim Belgesi', leftX, footerY + 26);

        ctx.textAlign = 'right';
        ctx.fillText(`Basım / Düzenleme Tarihi: ${todayStr}  -  Bu makbuz 1 asıl 1 surettir.`, rightX, footerY + 26);
        ctx.textAlign = 'left';

        // 3. Canvas görüntüsünü jsPDF'e aktar
        const pageDataUrl = canvas.toDataURL('image/jpeg', 0.94);
        if (i > 0) {
          doc.addPage('a4', 'portrait');
        }
        doc.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      // 4. Tek PDF dosyasını indir
      const cleanUser = activeUser.replace(/[^a-zA-Z0-9]/g, '_');
      const dateTag = new Date().toISOString().slice(0, 10);
      doc.save(`BAYBURT_OZKA_CEK_TAHSILAT_MAKBUZU_${cleanUser}_${dateTag}.pdf`);
    } catch (err: any) {
      console.error('PDF Tahsilat Makbuzu error:', err);
      alert('Tahsilat makbuzu PDF dosyası oluşturulurken hata meydana geldi: ' + (err.message || ''));
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress({ current: 0, total: 0 });
    }
  };

  // Kart Bileşeni (Her evrağın başında tik kutucuğu)
  const renderCheckCard = (file: UploadedFileItem) => {
    const fileUrl = getFilePublicUrl(bucket, resolvedFolderName, file.name);
    const isImg = isImageFile(file.name);
    const isPdf = isPdfFile(file.name);
    const assignedUser = getFileUserName(file, currentUser);
    const assignedPersonnel = getFilePersonnel(file);
    const userInfo = getUserStyle(assignedUser);
    const isSelected = selectedFileNames.has(file.name);

    return (
      <div
        key={file.name}
        onClick={() => toggleSelectFile(file.name)}
        className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 p-4 shadow-lg cursor-pointer ${
          isSelected
            ? 'border-emerald-500/80 bg-slate-900/95 ring-2 ring-emerald-500/30 shadow-emerald-950/40'
            : 'border-slate-800/90 bg-slate-950/80 hover:border-slate-700 hover:bg-slate-900/90'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* TİK KUTUCUĞU (HER EVRAĞIN BAŞINDA) */}
          <div
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelectFile(file.name);
            }}
            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all cursor-pointer ${
              isSelected
                ? 'bg-emerald-600 border-emerald-400 text-white shadow-md shadow-emerald-950/60 ring-2 ring-emerald-500/40'
                : 'bg-slate-900 border-slate-700 hover:border-slate-500 text-transparent'
            }`}
            title={isSelected ? 'Seçimi Kaldır' : 'Seç'}
            aria-label={`${file.name} evrağını seç`}
          >
            <Check className={`h-4 w-4 stroke-[3] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
          </div>

          {/* Dosya Küçük Resmi */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-400 shadow-inner">
            {isImg ? (
              <img
                src={fileUrl}
                alt={file.name}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <FileText className={`h-6 w-6 ${themeColor === 'bordo' ? 'text-rose-400' : 'text-emerald-400'}`} />
                {isPdf ? (
                  <span className="text-[8px] font-mono font-bold text-rose-300">PDF</span>
                ) : null}
              </div>
            )}
          </div>

          {/* Dosya Bilgileri */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p
                className="truncate text-sm font-bold text-slate-100 group-hover:text-rose-300 transition font-mono"
                title={file.name}
              >
                {file.name}
              </p>
              {isPdf && (
                <span className="rounded bg-rose-500/20 text-rose-300 text-[9px] font-mono px-1.5 py-0.5 border border-rose-500/30 font-bold">
                  PDF
                </span>
              )}
            </div>

            {/* Tarih ve Saat + Dosya Boyutu */}
            <div className="mt-1 flex items-center gap-2.5 text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1 text-slate-300">
                <Clock className="h-3.5 w-3.5 text-rose-400" />
                <span>{formatDate(file.created_at || file.updated_at)}</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">{formatFileSize(file.metadata?.size)}</span>
            </div>

            {/* Şantiye Bilgisi (varsa) */}
            {getFileSantiye(file) && (
              <div className="mt-1.5 flex items-center gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                  <Building2 className="w-3 h-3 text-emerald-400" />
                  {getFileSantiye(file)}
                </span>
              </div>
            )}

            {/* Kullanıcı Adı */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-black shadow-sm ${userInfo.avatarBg}`}
                  title={assignedUser}
                >
                  {userInfo.initials}
                </div>
                <div className="min-w-0 flex flex-col">
                  <span className="text-[9px] font-mono text-slate-500 uppercase leading-none">
                    Kayıt Eden:
                  </span>
                  <span className="text-xs font-extrabold truncate leading-tight mt-0.5 text-slate-200">
                    {assignedUser}
                  </span>
                </div>
              </div>

              {/* İlgili Personel Rozetleri */}
              {assignedPersonnel.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {assignedPersonnel.map((p) => (
                    <span
                      key={p}
                      className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Aksiyon Düğmeleri */}
        <div className="mt-3.5 flex items-center justify-end gap-2 border-t border-slate-800/80 pt-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPreview({ url: fileUrl, name: file.name });
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-800/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
          >
            {isImg ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5 text-rose-400" />}
            <span>Önizle</span>
          </button>

          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition border bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border-rose-500/20"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Aç / İndir
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-3xl border border-rose-600/30 bg-slate-900/70 p-4 sm:p-7 shadow-2xl backdrop-blur-xl animate-in fade-in duration-200">
      {/* 1. ÜST BAŞLIK VE ARAMA - (DEPOLAMA BİLGİSİ KALDIRILDI) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <FilePlus2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-extrabold text-slate-100 text-base sm:text-lg tracking-tight uppercase">
                {folderName} - {title}
              </h3>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                {filteredFiles.length} Evrak
              </span>
            </div>
          </div>
        </div>

        {/* Arama ve Yenileme Araçları */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Evraklarda ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/90 pl-10 pr-3 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-rose-500 focus:outline-none transition-all font-mono shadow-inner"
            />
          </div>

          <button
            type="button"
            onClick={fetchFiles}
            disabled={loading || isGeneratingPdf}
            title="Listeyi Yenile"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700 hover:text-white transition disabled:opacity-50 shadow-md cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-rose-400' : ''}`} />
            <span className="hidden sm:inline">Yenile</span>
          </button>
        </div>
      </div>

      {/* 2. KULLANICI ALANI: SADECE KULLANICI ADI SOYADI + TAHSİLAT MAKBUZU HAZIRLA BUTONU */}
      <div className={`mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl ${userStyle.headerBg} border ${userStyle.borderColor} shadow-xl backdrop-blur-md`}>
        {/* ALANDA SADECE KULLANICI ADI SOYADI (DİĞER BİLGİLER KALDIRILDI) */}
        <div className="flex items-center gap-3.5">
          <div
            className={`flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg font-black text-base sm:text-lg ${userStyle.avatarBg} border border-white/20`}
          >
            {userStyle.initials}
          </div>
          <div>
            <h4 className="text-base sm:text-xl font-black text-white tracking-tight uppercase">
              {activeUser}
            </h4>
          </div>
        </div>

        {/* KULLANICI ALANINA TAHSİLAT MAKBUZU HAZIRLA BUTONU VE SEÇİM KONTROLÜ */}
        <div className="flex items-center gap-3 flex-wrap">
          {filteredFiles.length > 0 && (
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 transition cursor-pointer"
            >
              <div
                className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                  isAllSelected
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : selectedFileNames.size > 0
                    ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                    : 'bg-slate-800 border-slate-600 text-transparent'
                }`}
              >
                <Check className="h-3 w-3 stroke-[3]" />
              </div>
              <span>
                {isAllSelected ? 'Tüm Seçimi Kaldır' : 'Tümünü Seç'} ({selectedFileNames.size}/{filteredFiles.length})
              </span>
            </button>
          )}

          {/* TAHSİLAT MAKBUZU HAZIRLA BUTONU */}
          <button
            type="button"
            onClick={handleGenerateTahsilatMakbuzuPdf}
            disabled={loading || isGeneratingPdf || filteredFiles.length === 0}
            title="Seçili çeklerin görüntüleri ve çek tahsilat makbuzunu tek bir PDF dosyasında hazırla"
            className="flex items-center gap-2.5 rounded-xl border-2 border-emerald-400/70 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-600 text-white px-5 py-2.5 text-xs sm:text-sm font-black transition-all shadow-xl shadow-emerald-950/70 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer tracking-wider uppercase ring-2 ring-emerald-500/30"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span className="font-mono">
                  {pdfProgress.total > 0
                    ? `Makbuz Hazırlanıyor (${pdfProgress.current}/${pdfProgress.total})...`
                    : 'PDF Hazırlanıyor...'}
                </span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 text-emerald-100 shrink-0" />
                <span>
                  TAHSİLAT MAKBUZU HAZIRLA {selectedFileNames.size > 0 ? `(${selectedFileNames.size} Çek)` : ''}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. EVRAK LİSTESİ */}
      <div className="mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-rose-400 mb-3" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-300">
              Kaydedilecek Çekler Yükleniyor...
            </p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-800/90 bg-slate-950/60 py-16 px-4 text-center">
            <FileText className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-base sm:text-lg font-black text-slate-300 tracking-wider uppercase">
              KAYDEDİLECEK HERHANGİ BİR VERİ YOK
            </p>
            <p className="text-xs text-slate-400 mt-2 max-w-md">
              {searchTerm
                ? `"${searchTerm}" aramasına uyan herhangi bir çek veya evrak kaydı bulunamadı.`
                : `Sayın ${activeUser}, ${folderName} alanında adınıza henüz sisteme kaydedilmiş herhangi bir çek veya evrak bulunmamaktadır.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredFiles.map((file) => renderCheckCard(file))}
          </div>
        )}
      </div>

      {/* 4. ÖNİZLEME MODALI */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="relative h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-5 w-5 text-rose-400 shrink-0" />
                <span className="font-semibold text-sm truncate max-w-md font-mono">
                  {selectedPreview.name}
                </span>
                {isPdfFile(selectedPreview.name) && (
                  <span className="rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono px-2 py-0.5 border border-rose-500/30 font-bold shrink-0">
                    PDF BELGESİ
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={selectedPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Yeni Sekmede Aç
                </a>
                <button
                  onClick={() => setSelectedPreview(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-3 flex-1 flex items-center justify-center overflow-hidden">
              {isPdfFile(selectedPreview.name) ? (
                <iframe
                  src={`${selectedPreview.url}#view=FitH`}
                  title={selectedPreview.name}
                  className="h-full w-full rounded-2xl border border-slate-800 bg-white"
                />
              ) : (
                <img
                  src={selectedPreview.url}
                  alt={selectedPreview.name}
                  className="max-h-full w-auto max-w-full rounded-2xl object-contain shadow-2xl"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
