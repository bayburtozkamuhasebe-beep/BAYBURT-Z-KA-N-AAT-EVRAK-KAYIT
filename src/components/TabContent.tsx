import React, { useState, useRef } from 'react';
import { TabConfig } from '../types';
import { CameraModal } from './CameraModal';
import { DocumentCropModal } from './DocumentCropModal';
import { FolderFileList } from './FolderFileList';
import { checkIfFileExists, uploadCekFile, BUCKET_CEKLER, supabase } from '../lib/supabase';
import { recordFileUser } from '../lib/userFileManager';
import { generateTumFirmalarTahsilatMakbuzuPdf } from '../lib/personelPdfUploader';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { autoCropAndCleanCheck } from '../lib/autoCheckCropper';
import { detectCheckNumberFromImage } from '../lib/checkOcrService';
import confetti from 'canvas-confetti';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  Send,
  Loader2,
  ShieldAlert,
  FilePlus2,
  Scan,
  Camera,
  FileCheck2,
  Image as ImageIcon,
  RotateCw,
  Check,
  Crop,
  Sparkles,
  Eye,
  Building2,
  FolderOpen,
  UploadCloud,
} from 'lucide-react';

interface TabContentProps {
  tab: TabConfig;
  currentUser?: string | null;
}

export const TabContent: React.FC<TabContentProps> = ({ tab, currentUser }) => {
  // Show list state: false by default, only fetches/shows when button clicked
  const [showKaydedilecekList, setShowKaydedilecekList] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalRawFile, setOriginalRawFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [croppedCheckPreviewUrl, setCroppedCheckPreviewUrl] = useState<string | null>(null);
  const [activePreviewMode, setActivePreviewMode] = useState<'check_format' | 'original'>('check_format');
  const [documentName, setDocumentName] = useState<string>('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAutoCropping, setIsAutoCropping] = useState(false);
  const [isInputFocusedHint, setIsInputFocusedHint] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'idle' | 'success' | 'warning' | 'error';
    message: string;
    fileName?: string;
  }>({ type: 'idle', message: '' });
  const [validationError, setValidationError] = useState<string | null>(null);
  const [refreshFileListTrigger, setRefreshFileListTrigger] = useState(0);
  const [isDetectingCheckNo, setIsDetectingCheckNo] = useState(false);
  const [ocrDetectedNotice, setOcrDetectedNotice] = useState<string | null>(null);
  const [detectedBankName, setDetectedBankName] = useState<string>('');

  // WhatsApp share data state
  const [whatsAppData, setWhatsAppData] = useState<{
    isOpen: boolean;
    pdfBlob: Blob | null;
    pdfPublicUrl?: string | null;
    checkNumber: string;
    tabName: string;
    savedFileName: string;
    santiye?: string;
  }>({
    isOpen: false,
    pdfBlob: null,
    pdfPublicUrl: null,
    checkNumber: '',
    tabName: '',
    savedFileName: '',
    santiye: '',
  });

  // Şantiye Seçimi: Varsayılan olarak visible: false (Yalnızca taranan evrakta Denizbank ibaresi geçiyorsa true olur)
  // Kural: Tik sadece 1 tane seçilebilsin (tek seçim / single select)
  // KULLANICI TALEBİ: "ŞANTİYE SEÇİMLERİ TİKLERİ TÜRKÇE KARAKTER OLMASIN SUPABASEYE KAYDEDERKEN HATA VERİYOR"
  const [isSantiyeVisible, setIsSantiyeVisible] = useState<boolean>(false);
  const [selectedSantiye, setSelectedSantiye] = useState<string>(''); // 'Bursa Santiyesi' | 'Msb Santiyesi' | 'Diger' | ''
  const [digerSantiyeText, setDigerSantiyeText] = useState<string>('');

  // Türkçe karakterleri Supabase Storage için güvenli ASCII eşdeğerlerine dönüştürür
  const toAsciiSafe = (str: string): string => {
    const trMap: Record<string, string> = {
      'ç': 'c', 'Ç': 'C',
      'ğ': 'g', 'Ğ': 'G',
      'ı': 'i', 'I': 'I', 'İ': 'I', 'i': 'i',
      'ö': 'o', 'Ö': 'O',
      'ş': 's', 'Ş': 'S',
      'ü': 'u', 'Ü': 'U'
    };
    return str.replace(/[çÇğĞıIİöÖşŞüÜ]/g, (char) => trMap[char] || char);
  };

  // Tek seçim: tıklandığında yalnızca o seçenek seçilir, tekrar tıklandığında seçim kaldırılır
  const handleSelectSantiye = (name: string) => {
    if (selectedSantiye === name) {
      setSelectedSantiye('');
    } else {
      setSelectedSantiye(name);
    }
  };

  const getResolvedSantiye = () => {
    if (!isSantiyeVisible || !selectedSantiye) return '';
    let val = '';
    if (selectedSantiye === 'Diger') {
      val = digerSantiyeText.trim() ? digerSantiyeText.trim() : 'Diger';
    } else {
      val = selectedSantiye;
    }
    return toAsciiSafe(val).replace(/\s+/g, '_');
  };

  // File input refs
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Helper to ensure any image is strictly horizontal/landscape (dik değil yatay)
  const ensureLandscapeImage = (
    file: File,
    preview: string,
    onReady: (finalFile: File, finalPreview: string) => void
  ) => {
    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      onReady(file, preview);
      return;
    }

    const img = new Image();
    img.onload = () => {
      try {
        // If height > width, image is vertical (dik) -> automatically rotate 90° clockwise into horizontal (yatay)
        if (img.naturalHeight > img.naturalWidth) {
          const maxDim = 2200;
          let w = img.naturalHeight;
          let h = img.naturalWidth;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((90 * Math.PI) / 180);
            ctx.drawImage(img, -h / 2, -w / 2, h, w);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const baseName = file.name ? file.name.replace(/\.[^/.]+$/, '') : 'evrak';
                  const rotatedFile = new File(
                    [blob],
                    `${baseName}_yatay.jpg`,
                    { type: 'image/jpeg' }
                  );
                  const rotatedUrl = URL.createObjectURL(blob);
                  onReady(rotatedFile, rotatedUrl);
                } else {
                  onReady(file, preview);
                }
              },
              'image/jpeg',
              0.92
            );
            return;
          }
        }
      } catch (err) {
        console.warn('ensureLandscapeImage notice:', err);
      }
      onReady(file, preview);
    };
    img.onerror = () => {
      onReady(file, preview);
    };
    img.src = preview;
  };

  // TARAMA VE GÖRÜNTÜ ALINDIĞINDA DİREK VERİ GİRMEK İÇİN TEXTBOX'A GİT
  const goToTextboxDirectly = () => {
    setIsInputFocusedHint(true);
    setTimeout(() => setIsInputFocusedHint(false), 5500);

    const triggerFocus = () => {
      if (nameInputRef.current) {
        nameInputRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
        nameInputRef.current.focus({ preventScroll: false });
        try {
          const len = nameInputRef.current.value.length;
          nameInputRef.current.setSelectionRange(len, len);
        } catch {
          // ignore
        }
      }
    };

    // Staggered triggers to cover immediate, modal-close, and post-layout rendering
    triggerFocus();
    requestAnimationFrame(triggerFocus);
    setTimeout(triggerFocus, 60);
    setTimeout(triggerFocus, 160);
    setTimeout(triggerFocus, 320);
    setTimeout(triggerFocus, 600);
  };

  // Otomatik olarak çek üzerindeki SERİ NO'yu tespit et ve textbox'a sıfırlardan sonraki rakamları doldur
  const autoDetectAndFillCheckNumber = async (fileOrBlob: File | Blob) => {
    try {
      setIsDetectingCheckNo(true);
      setOcrDetectedNotice('🔍 Çek seri numarası taranıyor...');
      const res = await detectCheckNumberFromImage(fileOrBlob);

      // KURAL: Taranan evrakta herhangi bir Denizbank ibaresi geçiyorsa şantiye seçimi visible: true olsun
      if (res.isDenizbank) {
        setIsSantiyeVisible(true);
      } else {
        setIsSantiyeVisible(false);
      }

      if (res.bankName) {
        setDetectedBankName(res.bankName);
      } else if (res.isDenizbank) {
        setDetectedBankName('DenizBank');
      }

      if (res.success && res.checkNumber) {
        const cleanNo = String(res.checkNumber).replace(/\D/g, '').replace(/^0+/, '');
        if (cleanNo) {
          setDocumentName(cleanNo);
          const bankInfo = res.bankName ? ` (${res.bankName})` : '';
          const denizNotice = res.isDenizbank ? ' • DenizBank Şantiye Seçimi Açıldı' : '';
          setOcrDetectedNotice(`✅ Çek Seri No: ${cleanNo}${bankInfo}${denizNotice}`);
          if (validationError) setValidationError(null);
          goToTextboxDirectly();
        } else {
          setOcrDetectedNotice('⚠️ Çek seri numarası tespit edilemedi. Lütfen elle giriniz.');
        }
      } else {
        const bankInfo = res.bankName ? ` (${res.bankName})` : '';
        const denizNotice = res.isDenizbank ? ' (DenizBank tespit edildi • Şantiye Seçimi Açıldı)' : '';
        setOcrDetectedNotice(
          (res.error ? `⚠️ ${res.error}` : '⚠️ Çek seri numarası tespit edilemedi. Lütfen elle giriniz.') + bankInfo + denizNotice
        );
        goToTextboxDirectly();
      }
    } catch (err) {
      console.warn('Otomatik çek numarası okuma hatası:', err);
      setOcrDetectedNotice('⚠️ Çek seri no okunamadı. Lütfen elle giriniz.');
    } finally {
      setIsDetectingCheckNo(false);
    }
  };

  // Process selected file (scanned image or file upload)
  // "GÖRÜNTÜ YÜKLENDİĞİNDE DİREK KIRPMA İŞLEMİNİ ELLE AYARLANSIN"
  const processSelectedFile = async (file: File, customPreviewUrl?: string) => {
    setUploadStatus({ type: 'idle', message: '' });
    setValidationError(null);

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    const initialPreview = customPreviewUrl || URL.createObjectURL(file);

    // Orijinal dosya ve doğal önizleme saklanır ("GÖRÜNTÜYÜ ORİJİNAL YÜKLE")
    setOriginalRawFile(file);
    setOriginalPreviewUrl(initialPreview);
    setSelectedFile(file);
    setActivePreviewMode('check_format');

    // EVRAK TARANDIĞINDA VEYA YÜKLENDİĞİNDE ÇEK NUMARASI KISMINI DİREK DOLDUR & DENİZBANK TESPİT ET
    autoDetectAndFillCheckNumber(file);

    if (!isPdf && initialPreview) {
      setCroppedCheckPreviewUrl(initialPreview);
      setPreviewUrl(initialPreview);
      setRawImageForCrop(initialPreview);
      setIsAutoCropping(false);
      // GÖRÜNTÜ YÜKLENDİĞİNDE DİREK KIRPMA İŞLEMİNİ ELLE AYARLANSIN:
      // Kırpma ve netleştirme modalı doğrudan kullanıcıya açılır
      setIsCropModalOpen(true);
    } else {
      setCroppedCheckPreviewUrl(null);
      setPreviewUrl(null);
      setRawImageForCrop(null);
      goToTextboxDirectly();
    }
  };

  // Kırpma ve netleştirme onaylandığında
  const handleCropConfirm = (processedFile: File, processedPreviewUrl: string) => {
    setSelectedFile(processedFile);
    setCroppedCheckPreviewUrl(processedPreviewUrl);
    setPreviewUrl(processedPreviewUrl);
    setRawImageForCrop(processedPreviewUrl);
    setActivePreviewMode('check_format');
    setIsCropModalOpen(false);
    // Kırpılmış net çek görüntüsünden tekrar tespit et
    autoDetectAndFillCheckNumber(processedFile);
    goToTextboxDirectly();
  };

  // Kırpma modalı kapatıldığında (vazgeçildiğinde)
  const handleCropModalClose = () => {
    setIsCropModalOpen(false);
    if (!croppedCheckPreviewUrl && originalPreviewUrl) {
      setCroppedCheckPreviewUrl(originalPreviewUrl);
    }
    goToTextboxDirectly();
  };

  // Manual 90° rotation for the selected image preview
  const handleManualRotateSelectedImage = () => {
    if (!previewUrl) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((90 * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const rotatedUrl = URL.createObjectURL(blob);
              setCroppedCheckPreviewUrl(rotatedUrl);
              setPreviewUrl(rotatedUrl);
            }
          },
          'image/jpeg',
          0.98
        );
      }
    };
    img.src = previewUrl;
  };

  // Handle Camera Capture (Scanned check -> JPG)
  const handleCameraCapture = (file: File, preview: string) => {
    setIsCameraOpen(false);
    // Fotoğraf dikey çekildiyse yatay çevir ve manuel yükleme ile BİREBİR AYNI boru hattına gönder
    ensureLandscapeImage(file, preview, (finalFile, finalPreview) => {
      processSelectedFile(finalFile, finalPreview);
    });
  };

  // Clear selected file
  const handleClearSelection = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    if (originalPreviewUrl && originalPreviewUrl.startsWith('blob:') && originalPreviewUrl !== previewUrl) {
      URL.revokeObjectURL(originalPreviewUrl);
    }
    if (croppedCheckPreviewUrl && croppedCheckPreviewUrl.startsWith('blob:') && croppedCheckPreviewUrl !== previewUrl) {
      URL.revokeObjectURL(croppedCheckPreviewUrl);
    }
    setSelectedFile(null);
    setOriginalRawFile(null);
    setOriginalPreviewUrl(null);
    setCroppedCheckPreviewUrl(null);
    setPreviewUrl(null);
    setIsDetectingCheckNo(false);
    setOcrDetectedNotice(null);
    setSelectedSantiye('');
    setDigerSantiyeText('');
    setIsSantiyeVisible(false);
    setDetectedBankName('');
  };

  // Sanitize filename to be strictly ASCII safe for Supabase Storage and filesystems
  const sanitizeFileName = (input: string): string => {
    let cleaned = toAsciiSafe(input.trim());
    cleaned = cleaned.replace(/[/\\?%*:|"<>#&+'`~^$@!=;,]/g, '-');
    cleaned = cleaned.replace(/\s+/g, '_');
    cleaned = cleaned.replace(/_{2,}/g, '_').replace(/-{2,}/g, '-');
    // Supabase Storage için yalnızca güvenli ASCII harfler, rakamlar, altçizgi, tire ve nokta
    cleaned = cleaned.replace(/[^a-zA-Z0-9_\-\.]/g, '');
    return cleaned;
  };

  // Save and Send Handler
  const handleSaveAndSend = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Mandatory Textbox validation
    const trimmedName = documentName.trim();
    if (!trimmedName) {
      setValidationError('Lütfen evrak/çek numarasını giriniz! Bu alan zorunludur.');
      nameInputRef.current?.focus();
      return;
    }

    if (trimmedName.startsWith('0')) {
      setValidationError('Evrak/çek numarası "0" (sıfır) rakamı ile başlayamaz!');
      nameInputRef.current?.focus();
      return;
    }

    // 2. File selected validation
    if (!selectedFile) {
      setValidationError('Lütfen önce bir fotoğraf çekin veya bir evrak dosyası yükleyin.');
      return;
    }

    setValidationError(null);
    setIsUploading(true);
    setUploadStatus({ type: 'idle', message: '' });

    try {
      // "GÖRÜNTÜYÜ ORİJİNAL YÜKLE"
      // Supabase depolama alanına daima orijinal, kaliteli ve doğal renkli dosya yüklenir
      const fileToUpload = originalRawFile || selectedFile;
      const isPdf = fileToUpload.type === 'application/pdf';
      const fileExt = isPdf ? 'pdf' : 'jpg';
      const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

      // KULLANICI TALEBİ:
      // "tik kutucuklarından hangisi seçiliyse kaydet ve gönder dendiğinde çek numarası + tik kutucugu ismi ile isimlendir seçili bir tik yoksa normal komut geçerli olsun"
      const resolvedSantiye = getResolvedSantiye();
      const documentFullName = resolvedSantiye ? `${trimmedName}_${resolvedSantiye}` : trimmedName;

      const baseCleanedName = sanitizeFileName(documentFullName);
      // Determine final filename: .jpg for images/scans, .pdf for PDF uploads
      const finalFileName = baseCleanedName.toLowerCase().endsWith(`.${fileExt}`)
        ? baseCleanedName
        : `${baseCleanedName}.${fileExt}`;

      // 3. Check if duplicate exists in Supabase CEKLER bucket folder
      const exists = await checkIfFileExists(tab.ceklerFolder, finalFileName, BUCKET_CEKLER);

      if (exists) {
        setUploadStatus({
          type: 'warning',
          message: `AYNI İSİMDE KAYIT VAR! "${finalFileName}" isimli bir evrak ${tab.name} (${BUCKET_CEKLER}/${tab.ceklerFolder}) klasöründe zaten mevcut. Lütfen evrak numarasına ek bir rakam ekleyerek tekrar deneyiniz.`,
          fileName: finalFileName,
        });
        setIsUploading(false);
        return;
      }

      // 4. Upload to Supabase CEKLER Storage directly as JPG (or PDF if uploaded as pdf)
      const result = await uploadCekFile(
        tab.ceklerFolder,
        finalFileName,
        fileToUpload,
        mimeType,
        BUCKET_CEKLER
      );

      if (!result.success) {
        setUploadStatus({
          type: 'error',
          message: result.error || 'Dosya yükleme sırasında hata oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin.',
        });
        setIsUploading(false);
        return;
      }

      // 5. Success - Associate file with current user and selected santiye
      if (currentUser) {
        await recordFileUser(finalFileName, currentUser || '', tab.ceklerFolder, undefined, resolvedSantiye);
      }

      // 6. ÖRNEK.jpg FORMATINDA RESMİ ÇEK TESLİM BELGESİ PDF HAZIRLA
      // KULLANICI TALEBİ: Tahsilat makbuzu / teslim belgesi PDF'i Supabase'e KAYDEDİLMEZ,
      // Supabase'e SADECE evrağın taraması yüklenir.
      // Oluşturulan PDF yalnızca anlık WhatsApp paylaşımı / cihaz indirmesi için bellekte (Blob) hazır tutulur.
      let generatedPdfBlob: Blob | null = null;
      let pdfPublicUrl: string | null = null;

      try {
        const imageSource =
          croppedCheckPreviewUrl || previewUrl || originalPreviewUrl || (fileToUpload ? URL.createObjectURL(fileToUpload) : '');

        if (imageSource) {
          generatedPdfBlob = await generateTumFirmalarTahsilatMakbuzuPdf({
            checkNumber: baseCleanedName,
            imageSource,
            tabName: tab.name,
            currentUser,
            santiye: resolvedSantiye,
          });
        }
      } catch (pdfErr: any) {
        console.warn('PDF Çek Teslim Belgesi hazırlama hatası:', pdfErr);
      }

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      // 7. KULLANICININ WHATSAPP'INA BAĞLAN VE KİŞİ SEÇİP GÖNDERMESİNİ SAĞLA
      if (generatedPdfBlob) {
        setWhatsAppData({
          isOpen: true,
          pdfBlob: generatedPdfBlob,
          pdfPublicUrl,
          checkNumber: baseCleanedName,
          tabName: tab.name,
          savedFileName: finalFileName,
          santiye: resolvedSantiye,
        });

        // Mobil ve destekleyen sistemlerde anında doğrudan WhatsApp paylaşım sayfasını aç
        const pdfFile = new File([generatedPdfBlob], `${baseCleanedName}_Cek_Teslim_Belgesi.pdf`, {
          type: 'application/pdf',
        });

        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
          try {
            await navigator.share({
              title: `${tab.name} - Çek Teslim Belgesi`,
              text: `${tab.name} Çek Teslim Belgesi (Çek No: ${baseCleanedName}${resolvedSantiye ? ` - ${resolvedSantiye}` : ''}) ektedir.`,
              files: [pdfFile],
            });
          } catch (shareErr: any) {
            if (shareErr.name !== 'AbortError') {
              console.warn('Otomatik paylaşım uyarısı:', shareErr);
            }
          }
        }
      }

      setUploadStatus({
        type: 'success',
        message: `BAŞARILI: Çek taraması "${finalFileName}" adıyla "${BUCKET_CEKLER}/${tab.ceklerFolder}" klasörüne kaydedildi.`,
        fileName: finalFileName,
      });

      // Clear current form so user can quickly upload next document
      handleClearSelection();
      setDocumentName('');
      setRefreshFileListTrigger((prev) => prev + 1);

      // Otomatik olarak başarı bildirimini 5 saniye sonra kapat
      setTimeout(() => {
        setUploadStatus((curr) => (curr.type === 'success' ? { type: 'idle', message: '' } : curr));
      }, 5000);
    } catch (err: any) {
      setUploadStatus({
        type: 'error',
        message: `Hata oluştu: ${err.message || 'Bilinmeyen bir hata.'}`,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. ÜST BÖLÜM: ÇEK & EVRAK KAYDETME VE GÖNDERME FORMU */}
      <form onSubmit={handleSaveAndSend} className="space-y-6">
        {currentUser && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-lg animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#7A0C1E] to-rose-600 font-black text-xs text-white shadow-md border border-rose-400/30">
                {currentUser
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block leading-none">
                  Kayıt Yapan Kullanıcı
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-100 tracking-tight">
                  {currentUser}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-mono font-semibold text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Yetkili Oturum Açık
              </span>
            </div>
          </div>
        )}

        {/* Scanner / Camera / Manual Upload Action Area */}
        <div className="flex flex-col gap-3">
          {/* Mobil Telefon Kamerası Doğrudan Donanım Girişi (capture="environment") */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const url = URL.createObjectURL(file);
                ensureLandscapeImage(file, url, (finalFile, finalPreview) => {
                  processSelectedFile(finalFile, finalPreview);
                });
              }
              e.target.value = '';
            }}
          />

          {/* Gizli Dosya Seçici Girişi (Masaüstü / Arşiv için) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                processSelectedFile(file);
              }
              e.target.value = '';
            }}
          />

          <h2 className="text-sm sm:text-base font-semibold text-slate-300 flex items-center gap-2 uppercase tracking-wider">
            <Scan className="w-5 h-5 text-rose-500" />
            <span>GÖRÜNTÜ AL / FOTOĞRAF ÇEK / TARA</span>
          </h2>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) {
                processSelectedFile(file);
              }
            }}
            className={`min-h-[220px] border-2 border-dashed rounded-3xl bg-slate-900/40 backdrop-blur-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-4 transition-all shadow-2xl ${
              isDragging
                ? 'border-emerald-400 bg-emerald-950/30 ring-4 ring-emerald-500/20'
                : 'border-slate-800/80 hover:border-rose-500/50 hover:bg-slate-900/60'
            }`}
          >
            <div
              onClick={() => setIsCameraOpen(true)}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 cursor-pointer transition-all shadow-inner border border-slate-700/60"
              title="Kamera ile Evrağı Canlı Tara"
            >
              <Scan className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400" />
            </div>

            <div className="max-w-lg">
              <p className="text-slate-200 text-sm sm:text-base font-bold uppercase tracking-wide">
                Canlı Evrak Tarayıcı
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Evrağı tarayıcıya tutunuz; evrak otomatik algılanır, netleştirilir, çek seri numarası ve banka adı analiz edilir.
              </p>
            </div>

            {/* EVRAĞI TARA BUTONU */}
            <div className="w-full max-w-sm mt-2">
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="w-full min-h-[52px] px-6 py-3.5 bg-gradient-to-r from-[#7A0C1E] via-[#8F1125] to-[#7A0C1E] hover:from-[#8F1125] hover:to-[#B91C1C] text-white text-xs sm:text-sm font-black rounded-2xl flex items-center justify-center gap-2.5 shadow-xl shadow-rose-950/50 active:scale-95 transition-all uppercase border border-rose-500/50 cursor-pointer tracking-wider"
              >
                <Scan className="w-5 h-5 text-rose-200 shrink-0" />
                <span>Evrağı Tara (Canlı Tarayıcı)</span>
              </button>
            </div>
          </div>
        </div>

            {/* Selected File Preview Box */}
            {selectedFile ? (
              <div className="overflow-hidden rounded-3xl border border-rose-500/40 bg-slate-900/70 p-5 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {selectedFile.type === 'application/pdf' ? (
                        <FileCheck2 className="h-6 w-6 text-rose-400" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-rose-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-100 text-sm truncate font-mono">
                          {selectedFile.name}
                        </span>
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[10px] font-mono text-rose-300 font-bold border border-rose-500/30 flex items-center gap-1">
                          {selectedFile.type === 'application/pdf' ? 'PDF EVRAK' : 'ORİJİNAL EVRAK (JPG)'}
                        </span>
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-rose-400 border border-slate-700">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        Format: <span className="font-mono text-rose-400 font-semibold">{selectedFile.type === 'application/pdf' ? 'application/pdf' : 'image/jpeg (JPG)'}</span> (Orijinal haliyle doğrudan kaydedilir)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                        if (isMobile && cameraInputRef.current) {
                          cameraInputRef.current.click();
                        } else {
                          setIsCameraOpen(true);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 px-3.5 py-1.5 text-xs font-semibold text-rose-200 hover:text-white transition cursor-pointer"
                      title="Kamera ile Yeniden Çek"
                    >
                      <Scan className="h-3.5 w-3.5 text-rose-400" /> Kamerayı Aç
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 hover:text-white transition cursor-pointer"
                      title="Masaüstünden / Arşivden Yeni Evrak Seç"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-emerald-400" /> Masaüstünden Seç
                    </button>

                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-950/40 hover:border-rose-700 transition cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" /> Kaldır
                    </button>
                  </div>
                </div>

                {/* Visual Thumbnail of the Scanned Check - Orijinal Taranan Alan */}
                {(previewUrl || originalPreviewUrl) ? (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-black/80 p-4 border border-slate-800 gap-3">
                    <div className="w-full flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono text-slate-300">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Scan className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-white">Çek Görseli:</span>
                        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1" title="Sisteme ve CEKLER klasörüne orijinal ham görsel yüklenecektir">
                          <Check className="w-3 h-3 stroke-[3]" />
                          ORİJİNAL YÜKLENECEK
                        </span>
                        {isAutoCropping ? (
                          <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded text-[10px] font-bold animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            ÇEK FORMATINDA KESİLİYOR...
                          </span>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" />
                            ÇEK FORMATINDA KESİLDİ (2.2 : 1)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {originalPreviewUrl && croppedCheckPreviewUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setActivePreviewMode((prev) =>
                                prev === 'check_format' ? 'original' : 'check_format'
                              );
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
                            title="Orijinal ve Çek Formatı Görünümü Arasında Geçiş Yap"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            <span>{activePreviewMode === 'check_format' ? 'Orijinali Gör' : 'Çek Formatını Gör'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            const rawSrc = originalPreviewUrl || previewUrl;
                            if (rawSrc) {
                              setRawImageForCrop(rawSrc);
                              setIsCropModalOpen(true);
                            }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 transition cursor-pointer"
                          title="Çek Kırpma Alanını Elle Ayarla"
                        >
                          <Crop className="w-3.5 h-3.5 text-rose-400" />
                          <span>✂ Çek Formatında Kes / Elle Ayarla</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleManualRotateSelectedImage}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer"
                          title="Görüntüyü 90 Derece Döndür / Yatay Yap"
                        >
                          <RotateCw className="w-3.5 h-3.5 text-rose-400" />
                          <span>90° Yatay Çevir</span>
                        </button>
                      </div>
                    </div>

                    <div className="w-full flex items-center justify-center p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 overflow-hidden">
                      <img
                        src={
                          activePreviewMode === 'original' && originalPreviewUrl
                            ? originalPreviewUrl
                            : (croppedCheckPreviewUrl || previewUrl || '')
                        }
                        alt="Seçilen Çek Görüntüsü"
                        onLoad={() => {
                          goToTextboxDirectly();
                        }}
                        className="max-h-56 sm:max-h-80 w-auto max-w-full rounded-lg object-contain shadow-2xl"
                      />
                    </div>
                  </div>
                ) : selectedFile.type === 'application/pdf' ? (
                  <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-slate-950/50 p-8 border border-slate-800 text-center">
                    <FileText className="h-14 w-14 text-rose-400 mb-2" />
                    <p className="text-sm font-semibold text-slate-200">PDF Evrağı Yüklendi</p>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{selectedFile.name}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Immersive Dock: Numeric Only Textbox + Save & Send Button */}
            <div
              className={`rounded-3xl border p-6 flex flex-col md:flex-row items-stretch md:items-end gap-6 shadow-2xl backdrop-blur-xl transition-all duration-300 ${
                isInputFocusedHint
                  ? 'bg-slate-900/95 border-emerald-400 ring-4 ring-emerald-500/30 shadow-emerald-950/60 scale-[1.005]'
                  : 'bg-slate-900/60 border-slate-800/80'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <label
                    htmlFor={`doc-name-${tab.id}`}
                    className="block text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2 flex-wrap"
                  >
                    <span>ÇEK NUMARASI</span>
                    <span className="text-rose-400">*</span>
                    {isDetectingCheckNo && (
                      <span className="animate-pulse bg-indigo-950/90 text-indigo-300 border border-indigo-500/50 px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-md">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>ÇEK SERİ NO OKUNUYOR...</span>
                      </span>
                    )}
                    {!isDetectingCheckNo && ocrDetectedNotice && (
                      <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-md">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{ocrDetectedNotice}</span>
                      </span>
                    )}
                    {!isDetectingCheckNo && !ocrDetectedNotice && isInputFocusedHint && (
                      <span className="animate-bounce bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3 py-1 rounded-xl text-xs font-mono font-black border border-emerald-300 shadow-lg shadow-emerald-950/60 flex items-center gap-1.5">
                        <span>▼ GÖRÜNTÜ ALINDI! ÇEK NUMARASINI GİRİNİZ</span>
                      </span>
                    )}
                  </label>

                  {/* Manual Re-read Button if check image is loaded */}
                  {(selectedFile || croppedCheckPreviewUrl || previewUrl) && (
                    <button
                      type="button"
                      disabled={isDetectingCheckNo}
                      onClick={() => {
                        const target = selectedFile || originalRawFile;
                        if (target) autoDetectAndFillCheckNumber(target);
                      }}
                      className="text-[11px] font-mono font-bold text-indigo-300 hover:text-indigo-100 bg-indigo-950/60 hover:bg-indigo-900/80 px-2.5 py-1 rounded-lg border border-indigo-500/30 flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      title="Görüntüden çek seri numarasını yeniden oku"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      <span>{isDetectingCheckNo ? 'Okunuyor...' : 'Çekten Seri No Oku'}</span>
                    </button>
                  )}
                </div>
                <input
                  id={`doc-name-${tab.id}`}
                  ref={nameInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[1-9][0-9]*"
                  required
                  value={documentName}
                  onKeyDown={(e) => {
                    // Disallow spaces explicitly
                    if (e.key === ' ' || e.code === 'Space') {
                      e.preventDefault();
                      return;
                    }
                    // Allow control keys: Backspace, Tab, Enter, Delete, Arrow keys, Copy/Paste shortcuts
                    const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
                    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
                      return;
                    }
                    // Prevent entering '0' if the field is empty or cursor is at beginning
                    if (e.key === '0') {
                      const input = e.currentTarget;
                      const start = input.selectionStart ?? 0;
                      const end = input.selectionEnd ?? 0;
                      if (start === 0 && (documentName.length === 0 || end === documentName.length || !documentName)) {
                        e.preventDefault();
                        setValidationError('Evrak/çek numarası "0" (sıfır) rakamı ile başlayamaz!');
                        return;
                      }
                    }
                    // If not a digit 0-9, prevent key stroke
                    if (!/^[0-9]$/.test(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasteData = e.clipboardData.getData('text');
                    let onlyDigits = pasteData.replace(/\D/g, '');
                    const combined = `${documentName}${onlyDigits}`.replace(/^0+/, '');
                    if ((pasteData.trim().startsWith('0') || combined.startsWith('0')) && !combined) {
                      setValidationError('Evrak/çek numarası "0" (sıfır) ile başlayamaz!');
                    }
                    setDocumentName(combined);
                    if (validationError && combined.length > 0) setValidationError(null);
                    if (uploadStatus.type === 'warning') setUploadStatus({ type: 'idle', message: '' });
                  }}
                  onChange={(e) => {
                    // Filter to digits only and strip any leading zeros
                    let onlyDigits = e.target.value.replace(/\D/g, '');
                    if (onlyDigits.startsWith('0')) {
                      onlyDigits = onlyDigits.replace(/^0+/, '');
                      setValidationError('Evrak/çek numarası "0" (sıfır) rakamı ile başlayamaz!');
                    } else if (validationError) {
                      setValidationError(null);
                    }
                    setDocumentName(onlyDigits);
                    if (uploadStatus.type === 'warning') setUploadStatus({ type: 'idle', message: '' });
                  }}
                  placeholder="Örn: 202609004821..."
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className={`w-full bg-slate-950 border rounded-2xl px-4 py-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/30 font-mono transition-all text-base sm:text-lg tracking-wider min-h-[54px] ${
                    validationError
                      ? 'border-rose-500 ring-2 ring-rose-500/50'
                      : isInputFocusedHint
                      ? 'border-emerald-400 ring-4 ring-emerald-500/40 bg-emerald-950/20'
                      : 'border-slate-700'
                  }`}
                />

                {/* Analiz Edilen Banka Rozeti */}
                {detectedBankName && (
                  <div className="mt-2.5 flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-950/80 to-slate-900 border border-blue-500/40 text-blue-200 text-xs font-mono font-bold animate-in fade-in slide-in-from-top-1 shadow-md">
                    <div className="flex items-center gap-2 min-w-0">
                      <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                      <span className="text-slate-400 text-[11px] uppercase tracking-wider">ANALİZ EDİLEN BANKA:</span>
                      <span className="text-blue-200 font-black tracking-tight truncate">{detectedBankName.toUpperCase()}</span>
                    </div>
                    {detectedBankName.toLowerCase().includes('deniz') ? (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        DenizBank (Şantiye Seçimi Açık)
                      </span>
                    ) : (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                        Banka Doğrulandı
                      </span>
                    )}
                  </div>
                )}

                {/* ŞANTİYE SEÇİMİ: Varsayılan olarak visible: false. Taranan evrakta Denizbank ibaresi geçiyorsa visible: true olur. */}
                {/* Kural: Tik sadece 1 tane seçilebilsin */}
                {isSantiyeVisible ? (
                  <div className="mt-3.5 pt-3 border-t border-slate-800/80 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>ŞANTİYE SEÇİMİ</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          DenizBank Evrağı Tespit Edildi
                        </span>
                      </div>
                      {selectedSantiye && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSantiye('');
                            setDigerSantiyeText('');
                          }}
                          className="text-[10px] font-mono text-slate-500 hover:text-rose-400 transition cursor-pointer"
                        >
                          Seçimi Kaldır
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      {/* 1. Bursa Santiyesi */}
                      <button
                        type="button"
                        onClick={() => handleSelectSantiye('Bursa Santiyesi')}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer select-none ${
                          selectedSantiye === 'Bursa Santiyesi'
                            ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-400/50'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            selectedSantiye === 'Bursa Santiyesi'
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {selectedSantiye === 'Bursa Santiyesi' && (
                            <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-bold tracking-tight">Bursa Santiyesi</span>
                      </button>

                      {/* 2. Msb Santiyesi */}
                      <button
                        type="button"
                        onClick={() => handleSelectSantiye('Msb Santiyesi')}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer select-none ${
                          selectedSantiye === 'Msb Santiyesi'
                            ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-400/50'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            selectedSantiye === 'Msb Santiyesi'
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {selectedSantiye === 'Msb Santiyesi' && (
                            <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-bold tracking-tight">Msb Santiyesi</span>
                      </button>

                      {/* 3. Diger */}
                      <button
                        type="button"
                        onClick={() => handleSelectSantiye('Diger')}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer select-none ${
                          selectedSantiye === 'Diger'
                            ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-400/50'
                            : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900/90'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                            selectedSantiye === 'Diger'
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {selectedSantiye === 'Diger' && (
                            <Check className="w-3.5 h-3.5 stroke-[3.5]" />
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-bold tracking-tight">Diger</span>
                      </button>
                    </div>

                    {/* Diger seçildiyse şantiye adı metin girişi (Türkçe karaktersiz) */}
                    {selectedSantiye === 'Diger' && (
                      <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <input
                          type="text"
                          value={digerSantiyeText}
                          onChange={(e) => setDigerSantiyeText(toAsciiSafe(e.target.value))}
                          placeholder="Diger santiye adini yaziniz (Orn: Istanbul Santiyesi)..."
                          className="w-full bg-slate-950/90 border border-slate-700 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none font-medium"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsSantiyeVisible(true)}
                      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 hover:text-emerald-400 transition cursor-pointer"
                      title="Santiye secimini manuel olarak ac"
                    >
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>+ Santiye Secimini Ac (DenizBank)</span>
                    </button>
                  </div>
                )}

              </div>

              {/* BUTON ADI: SADECE EVRAK GÖNDER */}
              <button
                type="submit"
                id={`btn-evrak-gonder-${tab.id}`}
                disabled={isUploading}
                className="w-full md:w-auto min-h-[54px] md:self-end px-8 sm:px-12 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-600 active:from-emerald-700 active:to-teal-800 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-emerald-950/70 hover:shadow-emerald-900/90 transition-all duration-200 uppercase tracking-wider shrink-0 active:scale-95 disabled:opacity-50 disabled:pointer-events-none border-2 border-emerald-400/60 ring-2 ring-emerald-500/30 cursor-pointer text-sm sm:text-base"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                    <span>GÖNDERİLİYOR...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 text-emerald-200" />
                    <span>EVRAK GÖNDER</span>
                  </>
                )}
              </button>
            </div>

            {/* Validation & Status Alerts */}
            {validationError && (
              <div className="flex items-center gap-3 rounded-2xl border border-rose-500/50 bg-rose-950/40 p-4 text-rose-200 text-xs sm:text-sm animate-in fade-in duration-200">
                <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0" />
                <p className="font-medium">{validationError}</p>
              </div>
            )}

            {uploadStatus.type === 'warning' && (
              <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 p-5 text-amber-200 text-xs sm:text-sm animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-300 text-sm uppercase tracking-wide">DİKKAT: AYNI İSİMDE KAYIT VAR!</h4>
                    <p className="mt-1 text-slate-300 leading-relaxed">{uploadStatus.message}</p>
                  </div>
                </div>
              </div>
            )}

            {uploadStatus.type === 'error' && (
              <div className="flex items-center gap-3 rounded-2xl border border-rose-500/50 bg-rose-950/40 p-4 text-rose-200 text-xs sm:text-sm animate-in fade-in duration-200">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
                <p className="font-medium">{uploadStatus.message}</p>
              </div>
            )}

            {uploadStatus.type === 'success' && (
              <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/40 p-4 text-emerald-200 text-xs sm:text-sm animate-in fade-in duration-200 flex items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="font-bold text-emerald-300 text-sm uppercase tracking-wide">İŞLEM BAŞARILI</h4>
                    <p className="mt-1 text-slate-200 whitespace-pre-line text-xs sm:text-sm leading-relaxed">{uploadStatus.message}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadStatus({ type: 'idle', message: '' })}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-emerald-900/40 transition shrink-0"
                  title="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </form>

          {/* 2. ORTA BÖLÜM: ANA LİSTELEME BUTONU */}
          <div className="pt-2 border-t border-slate-800/80">
            {/* 1. BUTON: KAYDEDİLECEK ÇEKLERİ GÖSTER */}
            <button
              type="button"
              onClick={() => setShowKaydedilecekList((prev) => !prev)}
              className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base tracking-wider uppercase flex items-center justify-center gap-3 transition-all shadow-xl active:scale-98 border cursor-pointer ${
                showKaydedilecekList
                  ? 'bg-[#7A0C1E] text-white border-rose-400 ring-4 ring-rose-600/30 shadow-rose-950/70 scale-[1.005]'
                  : 'bg-[#5B0816] hover:bg-[#7A0C1E] text-white border-rose-500/50 hover:border-rose-400 shadow-rose-950/40'
              }`}
            >
              <FilePlus2 className="w-5 h-5 text-rose-200 shrink-0" />
              <span className="font-extrabold text-sm sm:text-base tracking-wider">
                {showKaydedilecekList ? 'KAYDEDİLECEK ÇEKLERİ GİZLE' : 'KAYDEDİLECEK ÇEKLERİ GÖSTER'}
              </span>
            </button>
          </div>

          {/* 3. EN ALT BÖLÜM: GÖSTERİLECEK VERİLER LİSTESİ (SADECE BUTONA TIKLANDIĞINDA YÜKLENİR VE EN ALTTA GÖSTERİLİR) */}
          {showKaydedilecekList && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-3 duration-200">
              <FolderFileList
                bucket={BUCKET_CEKLER}
                folder={tab.ceklerFolder}
                folderName={tab.name}
                title="KAYDEDİLECEK ÇEKLER LİSTESİ"
                refreshTrigger={refreshFileListTrigger}
                themeColor="bordo"
                currentUser={currentUser}
              />
            </div>
          )}

      {/* Camera Capture Modal */}
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
        onOpenNativeCamera={() => cameraInputRef.current?.click()}
      />

      {/* Evrak Kesme & Netleştirme Düzenleyici Modalı */}
      {rawImageForCrop && (
        <DocumentCropModal
          isOpen={isCropModalOpen}
          imageSrc={rawImageForCrop}
          fileName={selectedFile?.name || 'evrak_cek.jpg'}
          onClose={handleCropModalClose}
          onConfirm={handleCropConfirm}
        />
      )}

      {/* WhatsApp Paylaşım & Tahsilat Makbuzu Modalı */}
      <WhatsAppShareModal
        isOpen={whatsAppData.isOpen}
        onClose={() => setWhatsAppData((prev) => ({ ...prev, isOpen: false }))}
        pdfBlob={whatsAppData.pdfBlob}
        pdfPublicUrl={whatsAppData.pdfPublicUrl}
        checkNumber={whatsAppData.checkNumber}
        tabName={whatsAppData.tabName}
        savedFileName={whatsAppData.savedFileName}
        santiye={whatsAppData.santiye}
      />
    </div>
  );
};


