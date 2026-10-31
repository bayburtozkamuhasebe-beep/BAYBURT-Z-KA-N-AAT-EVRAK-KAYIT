/**
 * Otomatik Çek Formatında Kırpma Modülü (Check Format Cropper)
 * - Görüntüyü orijinal renkleri ve kalitesiyle korur ("GÖRÜNTÜYÜ ORİJİNAL YÜKLE")
 * - Çeki standart çek formatında (2.2 : 1 en-boy oranı) kırpar ("AŞAĞIDAKİ FORMATTA KES")
 * - Yanlardaki masa, tarayıcı dış kenarları ve boşlukları temizler
 * - İmzaları, banka logolarını ve mühür renklerini bozmadan netleştirir
 */

export interface AutoCropResult {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  cropBox: {
    xPercent: number;
    yPercent: number;
    wPercent: number;
    hPercent: number;
  };
}

/**
 * Resim dosyasını veya URL'sini yükleyip HTMLImageElement döner
 */
export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Çeki standart yatay çek formatında (2.2 : 1) orijinal renklerini koruyarak kırpar
 */
export async function autoCropAndCleanCheck(
  source: File | Blob | string,
  fileName: string = 'cek_belgesi.jpg'
): Promise<AutoCropResult> {
  let objectUrlToRevoke: string | null = null;
  let sourceUrl = '';

  if (typeof source === 'string') {
    sourceUrl = source;
  } else {
    sourceUrl = URL.createObjectURL(source);
    objectUrlToRevoke = sourceUrl;
  }

  try {
    const img = await loadImg(sourceUrl);

    // 1. Yataylık Kontrolü (Çekler her zaman yatay dikdörtgendir)
    // Eğer dikey çekilmişse 90 derece yataya çevir
    let srcW = img.naturalWidth || img.width;
    let srcH = img.naturalHeight || img.height;
    const isVertical = srcH > srcW;

    const orientedCanvas = document.createElement('canvas');
    if (isVertical) {
      orientedCanvas.width = srcH;
      orientedCanvas.height = srcW;
    } else {
      orientedCanvas.width = srcW;
      orientedCanvas.height = srcH;
    }

    const oCtx = orientedCanvas.getContext('2d');
    if (!oCtx) throw new Error('Canvas 2D oluşturulamadı');

    if (isVertical) {
      oCtx.translate(srcH / 2, srcW / 2);
      oCtx.rotate((90 * Math.PI) / 180);
      oCtx.drawImage(img, -srcW / 2, -srcH / 2);
    } else {
      oCtx.drawImage(img, 0, 0);
    }

    const origW = orientedCanvas.width;
    const origH = orientedCanvas.height;

    // 2. Çek Formatı Oranı: 2.20 : 1 (Standart Türk Banka Çeki Formatı)
    const TARGET_CHECK_ASPECT = 2.2;

    // Çek sınırlarını tespit etmek için örnekleme yap
    const sampleW = 600;
    const sampleH = Math.round((origH / origW) * sampleW);

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sCtx = sampleCanvas.getContext('2d');
    if (!sCtx) throw new Error('Sample canvas oluşturulamadı');

    sCtx.drawImage(orientedCanvas, 0, 0, sampleW, sampleH);
    const imgData = sCtx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // Kenarlardaki dış masa/tarayıcı çizgilerini tespit et
    const rowEdgeCount = new Float32Array(sampleH);
    const colEdgeCount = new Float32Array(sampleW);

    for (let y = 1; y < sampleH - 1; y++) {
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = (y * sampleW + x) * 4;
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        const nextIdx = (y * sampleW + (x + 1)) * 4;
        const nextGray = 0.299 * data[nextIdx] + 0.587 * data[nextIdx + 1] + 0.114 * data[nextIdx + 2];
        const downIdx = ((y + 1) * sampleW + x) * 4;
        const downGray = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];

        const diff = Math.abs(gray - nextGray) + Math.abs(gray - downGray);
        if (diff > 25) {
          rowEdgeCount[y] += 1;
          colEdgeCount[x] += 1;
        }
      }
    }

    // Kenarlardan içeriye doğru tara
    let topCut = 0;
    let btmCut = sampleH - 1;
    let lftCut = 0;
    let rgtCut = sampleW - 1;

    const rowThreshold = sampleW * 0.05;
    const colThreshold = sampleH * 0.05;

    while (topCut < sampleH * 0.25 && rowEdgeCount[topCut] < rowThreshold) topCut++;
    while (btmCut > sampleH * 0.75 && rowEdgeCount[btmCut] < rowThreshold) btmCut--;
    while (lftCut < sampleW * 0.25 && colEdgeCount[lftCut] < colThreshold) lftCut++;
    while (rgtCut > sampleW * 0.75 && colEdgeCount[rgtCut] < colThreshold) rgtCut--;

    // Tespit edilen sınırları orijinal piksele çevir
    let cropX = Math.round((lftCut / sampleW) * origW);
    let cropY = Math.round((topCut / sampleH) * origH);
    let cropW = Math.round(((rgtCut - lftCut) / sampleW) * origW);
    let cropH = Math.round(((btmCut - topCut) / sampleH) * origH);

    // Minimum kontrol
    if (cropW < origW * 0.6 || cropH < origH * 0.25) {
      // Güvenli varsayılan: dış %3 boşlukları kırp
      cropX = Math.round(origW * 0.02);
      cropY = Math.round(origH * 0.03);
      cropW = Math.round(origW * 0.96);
      cropH = Math.round(origH * 0.94);
    }

    // STANDART ÇEK FORMATINA (2.2 : 1) UYARLA
    // Genişliği koruyup yüksekliği 2.2 oranına ayarla
    let targetH = Math.round(cropW / TARGET_CHECK_ASPECT);
    if (targetH > origH) {
      targetH = cropH;
      cropW = Math.round(targetH * TARGET_CHECK_ASPECT);
    } else {
      const diffH = targetH - cropH;
      cropY = Math.max(0, Math.min(origH - targetH, cropY - Math.round(diffH / 2)));
      cropH = targetH;
    }

    // Sınır koruması
    cropX = Math.max(0, Math.min(origW - 40, cropX));
    cropY = Math.max(0, Math.min(origH - 40, cropY));
    cropW = Math.max(40, Math.min(origW - cropX, cropW));
    cropH = Math.max(40, Math.min(origH - cropY, cropH));

    // 3. Çek Alanını Kes (Orijinal Renkleri Koruyarak)
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const cCtx = croppedCanvas.getContext('2d');
    if (!cCtx) throw new Error('Cropped canvas oluşturulamadı');

    // Orijinal renklerle çiz
    cCtx.drawImage(orientedCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    // 4. Doğal Netleştirme (Renkleri silmeden sadece hafif kontrast ve keskinlik)
    const finalImgData = cCtx.getImageData(0, 0, cropW, cropH);
    const px = finalImgData.data;
    const pxLen = px.length;

    // Hafif kontrast ve parlaklık ayarı (orijinal renk tonlarını bozmaz)
    const contrast = 12; // Hafif netleştirme
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    for (let i = 0; i < pxLen; i += 4) {
      px[i] = Math.max(0, Math.min(255, factor * (px[i] - 128) + 128));
      px[i + 1] = Math.max(0, Math.min(255, factor * (px[i + 1] - 128) + 128));
      px[i + 2] = Math.max(0, Math.min(255, factor * (px[i + 2] - 128) + 128));
    }
    cCtx.putImageData(finalImgData, 0, 0);

    // 5. Keskinleştirme (Unsharp mask - orijinal renkleri korur)
    if (cropW > 80 && cropH > 80) {
      try {
        const copyData = cCtx.getImageData(0, 0, cropW, cropH);
        const srcPx = copyData.data;
        const dstPx = finalImgData.data;
        const w = cropW;
        const weight = 0.25;

        for (let y = 1; y < cropH - 1; y++) {
          for (let x = 1; x < cropW - 1; x++) {
            const idx = (y * w + x) * 4;
            for (let c = 0; c < 3; c++) {
              const current = srcPx[idx + c];
              const top = srcPx[((y - 1) * w + x) * 4 + c];
              const btm = srcPx[((y + 1) * w + x) * 4 + c];
              const lft = srcPx[(y * w + (x - 1)) * 4 + c];
              const rgt = srcPx[(y * w + (x + 1)) * 4 + c];

              const sharpVal = 5 * current - top - btm - lft - rgt;
              dstPx[idx + c] = Math.max(
                0,
                Math.min(255, Math.round(current * (1 - weight) + sharpVal * weight))
              );
            }
          }
        }
        cCtx.putImageData(finalImgData, 0, 0);
      } catch (sharpErr) {
        console.warn('Sharpening filter notice:', sharpErr);
      }
    }

    // 6. Sonuç Üretimi
    return new Promise((resolve, reject) => {
      croppedCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Kırpılan çek kaydedilemedi'));
            return;
          }
          const cleanName = fileName.replace(/\.[^/.]+$/, '').replace(/_net$/, '') + '_net.jpg';
          const processedFile = new File([blob], cleanName, { type: 'image/jpeg' });
          const previewUrl = URL.createObjectURL(blob);

          resolve({
            file: processedFile,
            previewUrl,
            width: cropW,
            height: cropH,
            cropBox: {
              xPercent: Math.round((cropX / origW) * 100),
              yPercent: Math.round((cropY / origH) * 100),
              wPercent: Math.round((cropW / origW) * 100),
              hPercent: Math.round((cropH / origH) * 100),
            },
          });
        },
        'image/jpeg',
        0.98
      );
    });
  } finally {
    if (objectUrlToRevoke) {
      URL.revokeObjectURL(objectUrlToRevoke);
    }
  }
}
