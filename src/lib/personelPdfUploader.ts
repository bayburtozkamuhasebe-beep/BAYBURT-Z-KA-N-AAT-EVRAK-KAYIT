import { createClient } from '@supabase/supabase-js';
import jsPDF from 'jspdf';
import { autoCropAndCleanCheck } from './autoCheckCropper';

// İkinci Supabase Projesi (Personel Mail)
export const PERSONEL_SUPABASE_URL = 'https://mgtunrfpzbyfnmeloeeq.supabase.co';
export const PERSONEL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ndHVucmZwemJ5Zm5tZWxvZWVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNDUwMjgsImV4cCI6MjEwNDcyMTAyOH0.HcdwZbO-oHXQxytE-G221_62irBwuv0-8e3P_ux4a7k';
export const BUCKET_PERSONELMAIL = 'personelmail';

export const personelSupabase = createClient(
  PERSONEL_SUPABASE_URL,
  PERSONEL_SUPABASE_ANON_KEY
);

// Personel -> Klasör Eşleşmeleri (Kullanıcının talep ettiği tam Supabase bucket klasörleri)
export const PERSONEL_EXACT_FOLDERS: Record<string, string> = {
  'SAMET DURAK': 'SAMETDURAK',
  'SALİH KAYA': 'SALIHKAYA',
  'DİNÇER ARDUÇ': 'DINCERARDUC',
  'ÖMER HARUN': 'OMERHARUN',
};

export const PERSONEL_FOLDERS: Record<string, string[]> = {
  'SAMET DURAK': ['SAMETDURAK'],
  'SALİH KAYA': ['SALIHKAYA'],
  'DİNÇER ARDUÇ': ['DINCERARDUC'],
  'ÖMER HARUN': ['OMERHARUN'],
};

export function getPersonelTargetFolder(personName: string): string {
  const normalized = personName.trim();
  if (PERSONEL_EXACT_FOLDERS[normalized]) {
    return PERSONEL_EXACT_FOLDERS[normalized];
  }
  if (normalized.includes('SAMET')) return 'SAMETDURAK';
  if (normalized.includes('SALİH') || normalized.includes('SALIH')) return 'SALIHKAYA';
  if (normalized.includes('DİNÇER') || normalized.includes('DINCER')) return 'DINCERARDUC';
  if (normalized.includes('ÖMER') || normalized.includes('OMER')) return 'OMERHARUN';
  return normalized.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Resim öğesini yükle
 */
async function resolveImageElement(
  source: string | HTMLImageElement | Blob | File
): Promise<HTMLImageElement | null> {
  if (source instanceof HTMLImageElement) {
    if (source.complete && source.naturalWidth > 0) return source;
    await new Promise((res) => {
      source.onload = res;
      source.onerror = res;
    });
    return source.naturalWidth > 0 ? source : null;
  }

  let srcUrl = '';
  let shouldRevoke = false;

  if (typeof source === 'string') {
    srcUrl = source;
  } else if (typeof Blob !== 'undefined' && source instanceof Blob) {
    srcUrl = URL.createObjectURL(source);
    shouldRevoke = true;
  }

  if (!srcUrl) return null;

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = srcUrl;
    });
    return img;
  } catch (err) {
    console.warn('Image could not be resolved for PDF:', err);
    return null;
  } finally {
    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(srcUrl), 4000);
    }
  }
}

export interface GenerateTumFirmalarTahsilatMakbuzuPdfOptions {
  checkNumber: string;
  imageSource: string | HTMLImageElement | Blob | File;
  tabName?: string;
  currentUser?: string | null;
  selectedPersonnel?: string[];
  santiye?: string;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill = false,
  stroke = true
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/**
 * FİRMA ÇEK TAHSİLAT MAKBUZU PDF OLUŞTURUCU
 * ÖRNEK.JPG BİREBİR ŞABLONU
 */
export async function generateTumFirmalarTahsilatMakbuzuPdf(
  options: GenerateTumFirmalarTahsilatMakbuzuPdfOptions
): Promise<Blob> {
  const {
    checkNumber,
    imageSource,
  } = options;

  const imgElement = await resolveImageElement(imageSource);

  // A4 Dikey Standardı (1600 x 2263 px ~ 1:1.4142)
  const canvasWidth = 1600;
  const canvasHeight = 2263;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context oluşturulamadı.');
  }

  // 1. Temiz Beyaz Arka Plan
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const cleanNo = checkNumber.replace(/\.[^/.]+$/, '').trim();
  const todayStr = new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  const leftX = 70;
  const rightX = 1530;
  const contentW = rightX - leftX; // 1460 px

  // 2. ÜST BAŞLIK BÖLÜMÜ (ÖRNEK.JPG)
  // Üst Küçük Başlık
  ctx.font = 'bold 14.5px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.textAlign = 'left';
  ctx.fillText('RESMİ TİCARİ BELGE - ÇEK TESLİM BELGESİ', leftX, 78);

  // Büyük 2 Satırlı Başlık: FİRMA ÇEK TESLİM / BELGESİ
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
  drawRoundedRect(ctx, makbuzBoxX, boxTopY, makbuzBoxW, boxH, 8, true, true);

  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('MAKBUZ NO:', makbuzBoxX + 18, boxTopY + 30);

  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#000000';
  const makbuzNoValue = cleanNo ? `MKB-${cleanNo}` : 'MKB-';
  ctx.fillText(makbuzNoValue, makbuzBoxX + 18, boxTopY + 65);

  // Kutu 2: TARİH
  const dateBoxX = 1300;
  const dateBoxW = 230;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, dateBoxX, boxTopY, dateBoxW, boxH, 8, true, true);

  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('TARİH:', dateBoxX + 18, boxTopY + 30);

  ctx.font = 'bold 19px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText(todayStr, dateBoxX + 18, boxTopY + 65);

  // 3. ÇEK BİLGİLERİ VE TAHSİLAT DETAYI BAŞLIĞI
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

  // 4. ÇEK DETAY TABLOSU (Belirgin Çizgili 4 Kolon: ÇEK SERİ NO | VADE TARİHİ | KEŞİDE YERİ | TUTARI (₺))
  const tableTopY = section1Y + 24; // 254
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

  // Belirgin Dikey Kolon Çizgileri
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
  ctx.fillText(cleanNo || '............', leftX + col1W / 2, dataTextY);

  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('..... / ..... / 202...', cX1 + col2W / 2, dataTextY);
  ctx.fillText(options.santiye || '............................', cX2 + col3W / 2, dataTextY);

  ctx.textAlign = 'right';
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('.................................. ₺', rightX - 24, dataTextY);
  ctx.textAlign = 'left';

  // 5. YALNIZ (YAZIYLA TUTAR) KUTUSU (Belirgin Çizgili)
  const yaziBoxY = tableTopY + headerH + dataRowH + 18;
  const yaziBoxH = 54;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, leftX, yaziBoxY, contentW, yaziBoxH, 8, true, true);

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

  // 6. TAHSİL EDİLEN ÇEKİN GÖRÜNTÜSÜ / ÇEK SURETİ (ÖN YÜZ) BAŞLIĞI
  const section2Y = yaziBoxY + yaziBoxH + 36;
  ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('■  TAHSİL EDİLEN ÇEKİN GÖRÜNTÜSÜ / ÇEK SURETİ (ÖN YÜZ)', leftX, section2Y);

  // Sağ: Yeşil Onay ve "Görsel Eklendi"
  ctx.textAlign = 'right';
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#047857';
  ctx.fillText('✔ Görsel Eklendi', rightX, section2Y);
  ctx.textAlign = 'left';

  // 7. ÇEK GÖRSELİ KUTUSU (Belirgin Kalın Çerçeve)
  const imgContainerY = section2Y + 16;
  const imgContainerH = 920;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.4;
  drawRoundedRect(ctx, leftX, imgContainerY, contentW, imgContainerH, 8, true, true);

  // Çekin Görselini İçeriye Yerleştir (En Boy Oranını Koruyarak Merkezle)
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

    // Çeki çiz
    ctx.drawImage(imgElement, drawX, drawY, drawW, drawH);

    // Çekin etrafına belirgin sınır çizgisi
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(drawX, drawY, drawW, drawH);
  } else {
    // Görsel yoksa zarif yer tutucu
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#334155';
    ctx.textAlign = 'center';
    ctx.fillText(`EVRAK / ÇEK DOSYASI: ${cleanNo}`, leftX + contentW / 2, imgContainerY + imgContainerH / 2 - 10);
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.fillText('(Görüntü Dijital Olarak Kaydedilmiştir)', leftX + contentW / 2, imgContainerY + imgContainerH / 2 + 20);
    ctx.textAlign = 'left';
  }

  // Çek Kutusunun Sağ Alt Metni: "ASLI GÖRÜLMÜŞTÜR - ÇEK SURETİ"
  ctx.textAlign = 'right';
  ctx.font = 'bold 13.5px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('ASLI GÖRÜLMÜŞTÜR - ÇEK SURETİ', rightX - 22, imgContainerY + imgContainerH - 18);
  ctx.textAlign = 'left';

  // 8. AÇIKLAMA / MAHSUP BİLGİSİ KUTUSU (Belirgin Çerçeve)
  const aciklamaY = imgContainerY + imgContainerH + 22;
  const aciklamaH = 58;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, leftX, aciklamaY, contentW, aciklamaH, 8, true, true);

  ctx.font = 'bold 16px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText('Açıklama / Mahsup Bilgisi:', leftX + 18, aciklamaY + 36);

  ctx.font = 'bold 15.5px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('  Yukarıda görüntüsü ve bilgileri mevcut olan çeki elden teslim aldım', leftX + 235, aciklamaY + 36);

  // 9. YASAL HÜKÜM BÖLÜMÜ (Net ve Belirgin)
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

  // 10. İMZA / KAŞE KUTULARI (Belirgin Çizgili İki Kutu ve Gerçek Kesikli İmza Çizgisi)
  const sigY = yasalY + 62;
  const sigBoxH = 260;
  const sigGap = 30;
  const sigBoxW = (contentW - sigGap) / 2; // 715 px

  // Sol Kutu: TESLİM EDEN FİRMA
  const leftSigBoxX = leftX;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.4;
  drawRoundedRect(ctx, leftSigBoxX, sigY, sigBoxW, sigBoxH, 10, true, true);

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
  drawRoundedRect(ctx, rightSigBoxX, sigY, sigBoxW, sigBoxH, 10, true, true);

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

  // 11. ALT BİLGİ (FOOTER)
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

  // jsPDF A4 Dikey içine aktar (Maksimum JPEG kalitesi 0.98)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageDataUrl = canvas.toDataURL('image/jpeg', 0.98);
  doc.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

  return doc.output('blob');
}

/**
 * 2. KOMUT: Seçili personellerin klasörlerine PDF makbuzu yükle
 */
export async function uploadPdfToPersonelMail(options: {
  pdfBlob: Blob;
  fileName: string;
  selectedPersonnel: string[];
}): Promise<{
  success: boolean;
  uploadedFolders: string[];
  errors: string[];
}> {
  const { pdfBlob, fileName, selectedPersonnel } = options;

  const cleanBaseName = fileName.replace(/\.[^/.]+$/, '').trim();
  const pdfFileName = `${cleanBaseName}.pdf`;

  const uploadedFolders: string[] = [];
  const errors: string[] = [];

  for (const person of selectedPersonnel) {
    const targetFolder = getPersonelTargetFolder(person);
    const storagePath = `${targetFolder}/${pdfFileName}`;
    try {
      const { data, error } = await personelSupabase.storage
        .from(BUCKET_PERSONELMAIL)
        .upload(storagePath, pdfBlob, {
          upsert: true,
          contentType: 'application/pdf',
        });

      if (error) {
        console.warn(`Upload error to ${storagePath}:`, error.message);
        errors.push(`${person} (${targetFolder}): ${error.message}`);
      } else if (data) {
        uploadedFolders.push(targetFolder);
      }
    } catch (err: any) {
      console.warn(`Exception uploading to ${storagePath}:`, err);
      errors.push(`${person} (${targetFolder}): ${err.message || 'Bilinmeyen hata'}`);
    }
  }

  return {
    success: uploadedFolders.length > 0,
    uploadedFolders,
    errors,
  };
}

export interface PersonelMailPdfItem {
  id: string;
  name: string;
  folder: string;
  personName: string;
  size: number;
  created_at: string;
  updated_at: string;
}

/**
 * personelmail bucket'ındaki PDF dosyalarını listele
 */
export async function listPersonelMailPdfs(targetFolder?: string): Promise<PersonelMailPdfItem[]> {
  const foldersToScan = targetFolder
    ? [targetFolder]
    : ['SAMETDURAK', 'SALIHKAYA', 'DINCERARDUC', 'OMERHARUN'];

  const results: PersonelMailPdfItem[] = [];

  const folderToPersonMap: Record<string, string> = {
    SAMETDURAK: 'SAMET DURAK',
    SALIHKAYA: 'SALİH KAYA',
    DINCERARDUC: 'DİNÇER ARDUÇ',
    OMERHARUN: 'ÖMER HARUN',
  };

  for (const f of foldersToScan) {
    try {
      const { data, error } = await personelSupabase.storage
        .from(BUCKET_PERSONELMAIL)
        .list(f, {
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (!error && data) {
        for (const file of data) {
          if (file.name && !file.name.startsWith('.') && file.name.endsWith('.pdf')) {
            results.push({
              id: file.id || `${f}/${file.name}`,
              name: file.name,
              folder: f,
              personName: folderToPersonMap[f] || f,
              size: file.metadata?.size || 0,
              created_at: file.created_at || '',
              updated_at: file.updated_at || '',
            });
          }
        }
      }
    } catch (err) {
      console.warn(`Error scanning folder ${f}:`, err);
    }
  }

  // Sort newest first
  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return results;
}

/**
 * personelmail bucket'ından dosya indir
 */
export async function downloadPersonelMailPdf(folder: string, fileName: string): Promise<Blob | null> {
  try {
    const { data, error } = await personelSupabase.storage
      .from(BUCKET_PERSONELMAIL)
      .download(`${folder}/${fileName}`);
    if (error || !data) {
      console.warn(`Download error for ${folder}/${fileName}:`, error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('downloadPersonelMailPdf error:', err);
    return null;
  }
}
