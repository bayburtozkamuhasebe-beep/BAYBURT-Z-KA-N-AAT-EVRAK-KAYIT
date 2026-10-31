/**
 * Çek Numarası & Seri No Otomatik Çıkarıcı Servis
 * Evrak tarandığında çek görüntüsündeki SERİ NO ve sıfırlardan sonraki rakamları otomatik çıkarır.
 */

export async function fileToBase64(fileOrBlob: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Resize high-res images to a balanced resolution (max 1800px width/height)
 * for ultra-fast network transfer and optimal OCR performance.
 */
export async function optimizeImageForOcr(fileOrBlob: File | Blob): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (res: string) => {
      if (!resolved) {
        resolved = true;
        resolve(res);
      }
    };

    // Generous safety timeout (15s) in case high-resolution mobile camera photo takes time to load
    const timer = setTimeout(() => {
      fileToBase64(fileOrBlob).then(finish).catch(() => finish(''));
    }, 15000);

    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      const maxDim = 1800;
      let width = img.naturalWidth || 1000;
      let height = img.naturalHeight || 700;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        finish(dataUrl);
      } else {
        fileToBase64(fileOrBlob).then(finish).catch(() => finish(''));
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
      fileToBase64(fileOrBlob).then(finish).catch(() => finish(''));
    };
    img.src = url;
  });
}

export interface CheckOcrResult {
  success: boolean;
  checkNumber: string;
  rawFound?: string;
  bankName?: string;
  isDenizbank?: boolean;
  location?: string;
  error?: string;
}

/**
 * Evrak görüntüsünden çek seri numarasını tespit eder.
 * Sıfırlardan sonraki asıl rakamları alır.
 * Evrakta DenizBank ibaresi veya logosu olup olmadığını analiz eder.
 */
export async function detectCheckNumberFromImage(
  fileOrBlob: File | Blob
): Promise<CheckOcrResult> {
  try {
    const isPdf =
      fileOrBlob.type === 'application/pdf' ||
      ('name' in fileOrBlob && String(fileOrBlob.name).toLowerCase().endsWith('.pdf'));

    let payloadBase64 = '';
    let payloadMime = 'image/jpeg';

    if (isPdf) {
      payloadBase64 = await fileToBase64(fileOrBlob);
      payloadMime = 'application/pdf';
    } else {
      payloadBase64 = await optimizeImageForOcr(fileOrBlob);
      payloadMime = 'image/jpeg';
    }

    if (!payloadBase64) {
      return {
        success: false,
        checkNumber: '',
        error: 'Çek görseli okunamadı. Lütfen elle giriniz.',
      };
    }

    const response = await fetch('/api/extract-check-number', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: payloadBase64,
        mimeType: payloadMime,
      }),
    });

    const data = await response.json().catch(() => ({}));
    const isDenizbank = Boolean(
      data?.isDenizbank ||
      (data?.bankName && /deniz/i.test(data.bankName)) ||
      (data?.raw && /deniz/i.test(data.raw)) ||
      (data?.rawFound && /deniz/i.test(data.rawFound)) ||
      (data?.location && /deniz/i.test(data.location))
    );

    if (data && data.success && data.checkNumber) {
      let finalNumber = String(data.checkNumber).replace(/\D/g, '');
      // Remove any leading zeroes
      finalNumber = finalNumber.replace(/^0+/, '') || finalNumber;
      return {
        success: true,
        checkNumber: finalNumber,
        rawFound: data.rawFound,
        bankName: data.bankName,
        isDenizbank,
        location: data.location,
      };
    }

    return {
      success: false,
      checkNumber: '',
      bankName: data?.bankName,
      isDenizbank,
      error: data?.message || 'Çek seri numarası tespit edilemedi. Lütfen elle giriniz.',
    };
  } catch (err: any) {
    console.warn('detectCheckNumberFromImage error:', err);
    return {
      success: false,
      checkNumber: '',
      error: 'Çek seri numarası tespit edilemedi. Lütfen elle giriniz.',
    };
  }
}
