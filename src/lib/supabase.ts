import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://gboathwmaanqxuwsryud.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_XAJvSuJtLj6_b0HDWBUUCA_2M-2dDQ7';
export const BUCKET_CEKLER = 'CEKLER';
export const BUCKET_KAYITEDILENCEKLER = 'KAYITEDILENCEKLER';

// Default export for backwards compatibility
export const BUCKET_NAME = BUCKET_CEKLER;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Normalizes folder names for storage query
 */
export function getFolderVariations(rawFolder?: string): string[] {
  const variations: string[] = [''];
  if (!rawFolder || rawFolder === '-' || rawFolder.trim() === '') {
    return ['', 'ARNAVUTKOY', 'BURSA-OZKA', 'MSB-OZKA', 'MAMAK', 'SEKA', 'DIGER', 'DİĞER', 'DİGER'];
  }

  const clean = rawFolder.trim();
  variations.push(clean);

  const f = clean.toUpperCase();
  if (f.includes('ARNAVUT')) {
    variations.push('ARNAVUTKOY', 'ARNAVUTKÖY', 'ARNAVUT_KOY');
  } else if (f.includes('BURSA')) {
    variations.push('BURSA-OZKA', 'BURSA - ÖZKA', 'BURSA_OZKA', 'BURSA - OZKA', 'BURSA OZKA', 'BURSA');
  } else if (f.includes('MSB')) {
    variations.push('MSB-OZKA', 'MSB - ÖZKA', 'MSB_OZKA', 'MSB - OZKA', 'MSB OZKA', 'MSB');
  } else if (f.includes('MAMAK')) {
    variations.push('MAMAK');
  } else if (f.includes('SEKA')) {
    variations.push('SEKA');
  } else {
    variations.push('DIGER', 'DİĞER', 'DİGER');
  }

  // Include standard folders as fallback
  ['ARNAVUTKOY', 'BURSA-OZKA', 'MSB-OZKA', 'MAMAK', 'SEKA', 'DIGER', 'DİĞER'].forEach(
    (folder) => variations.push(folder)
  );

  return Array.from(new Set(variations));
}

export interface DocumentSearchResult {
  found: boolean;
  bucket: string;
  folder: string;
  fileName: string;
  publicUrl: string;
  signedUrl?: string;
  blobUrl?: string;
  fileType: 'pdf' | 'image' | 'other';
  fileSize?: number;
  error?: string;
}

/**
 * Searches for a check document in KAYITEDILENCEKLER (and fallback to CEKLER) bucket
 * using multi-layer exhaustive search, probing, and blob downloading.
 */
export async function findCheckDocument(
  cekNo: string,
  santiyeBirim?: string,
  rawRecord?: any
): Promise<DocumentSearchResult> {
  const cleanCekNo = String(cekNo || '').trim();
  if (!cleanCekNo || cleanCekNo === '-') {
    return {
      found: false,
      bucket: BUCKET_KAYITEDILENCEKLER,
      folder: '',
      fileName: '',
      publicUrl: '',
      fileType: 'other',
      error: 'Geçersiz veya boş çek numarası.',
    };
  }

  // 1. Check if rawRecord contains direct file path / name / url
  const candidateDirectPaths: string[] = [];
  if (rawRecord && typeof rawRecord === 'object') {
    const possibleKeys = [
      'DOSYA_ADI', 'dosya_adi', 'DOSYA_YOLU', 'dosya_yolu',
      'EVRAK', 'evrak', 'EVRAK_ADI', 'evrak_adi', 'EVRAK_YOLU', 'evrak_yolu',
      'FILE_PATH', 'file_path', 'FILE_NAME', 'file_name',
      'STORAGE_PATH', 'storage_path', 'URL', 'url', 'LINK', 'link',
      'RESIM', 'resim', 'PDF', 'pdf', 'BELGE', 'belge'
    ];
    for (const k of possibleKeys) {
      const val = rawRecord[k];
      if (val && typeof val === 'string' && val.trim() !== '' && val !== '-') {
        candidateDirectPaths.push(val.trim());
      }
    }
  }

  const bucketsToSearch = [BUCKET_KAYITEDILENCEKLER, BUCKET_CEKLER];

  // Helper to extract file type
  const detectFileType = (fileName: string): 'pdf' | 'image' | 'other' => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'svg'].includes(ext)) return 'image';
    return 'other';
  };

  // Helper to package a successful document result
  const packageResult = async (
    bucket: string,
    folder: string,
    fileName: string,
    existingBlob?: Blob
  ): Promise<DocumentSearchResult> => {
    const fullPath = folder ? `${folder}/${fileName}` : fileName;
    const fileType = detectFileType(fileName);
    const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(fullPath);
    let publicUrl = pubData.publicUrl;

    let signedUrl = '';
    try {
      const { data: signData } = await supabase.storage.from(bucket).createSignedUrl(fullPath, 7200);
      if (signData?.signedUrl) {
        signedUrl = signData.signedUrl;
      }
    } catch {
      // ignore
    }

    let blobUrl = '';
    let fileSize = existingBlob?.size;
    if (existingBlob) {
      const mime = fileType === 'pdf' ? 'application/pdf' : fileType === 'image' ? 'image/jpeg' : existingBlob.type;
      const typedBlob = new Blob([existingBlob], { type: mime });
      blobUrl = URL.createObjectURL(typedBlob);
    } else {
      try {
        const { data: blobData } = await supabase.storage.from(bucket).download(fullPath);
        if (blobData) {
          fileSize = blobData.size;
          const mime = fileType === 'pdf' ? 'application/pdf' : fileType === 'image' ? 'image/jpeg' : blobData.type;
          const typedBlob = new Blob([blobData], { type: mime });
          blobUrl = URL.createObjectURL(typedBlob);
        }
      } catch (dlErr) {
        console.warn('Could not download blob for', fullPath, dlErr);
      }
    }

    // Best primary URL for browser display
    const activeDisplayUrl = blobUrl || signedUrl || publicUrl;

    return {
      found: true,
      bucket,
      folder,
      fileName,
      publicUrl: activeDisplayUrl,
      signedUrl,
      blobUrl,
      fileType,
      fileSize,
    };
  };

  // STEP 1: Direct path checks from database record
  for (const directPath of candidateDirectPaths) {
    for (const bucket of bucketsToSearch) {
      try {
        // Strip bucket name if embedded
        let cleanPath = directPath.replace(/^KAYITEDILENCEKLER\//i, '').replace(/^CEKLER\//i, '');
        const parts = cleanPath.split('/');
        const fileName = parts.pop() || cleanPath;
        const folder = parts.join('/');

        const { data: dlData, error: dlErr } = await supabase.storage.from(bucket).download(cleanPath);
        if (!dlErr && dlData && dlData.size > 0) {
          return await packageResult(bucket, folder, fileName, dlData);
        }
      } catch {
        // proceed
      }
    }
  }

  // STEP 2: Multi-folder dynamic traversal in KAYITEDILENCEKLER and CEKLER
  const baseFolders = getFolderVariations(santiyeBirim);

  for (const bucket of bucketsToSearch) {
    // 2a. Discover any subfolders in the bucket root
    const allFoldersToScan = new Set<string>(baseFolders);
    try {
      const { data: rootItems } = await supabase.storage.from(bucket).list('', { limit: 500 });
      if (rootItems && rootItems.length > 0) {
        for (const item of rootItems) {
          // Check if item is a direct match in root
          const itemLower = item.name.toLowerCase();
          const targetLower = cleanCekNo.toLowerCase();
          const baseName = itemLower.replace(/\.[^/.]+$/, '');

          if (
            baseName === targetLower ||
            itemLower === targetLower ||
            itemLower.startsWith(targetLower + '.') ||
            itemLower.includes(targetLower) ||
            itemLower.replace(/\D/g, '') === cleanCekNo.replace(/\D/g, '')
          ) {
            return await packageResult(bucket, '', item.name);
          }

          // If it looks like a folder (no extension or id is null), add to folders to scan
          if (!item.name.includes('.') || !item.metadata) {
            allFoldersToScan.add(item.name);
          }
        }
      }
    } catch (rootErr) {
      console.warn(`Error scanning root of ${bucket}:`, rootErr);
    }

    // 2b. Scan each folder without restrictive search query
    for (const folder of Array.from(allFoldersToScan)) {
      try {
        const { data: folderItems, error: listErr } = await supabase.storage
          .from(bucket)
          .list(folder, { limit: 1000 });

        if (listErr || !folderItems || folderItems.length === 0) continue;

        // Filter out dotfiles / system files
        const validFiles = folderItems.filter((f) => f.name && !f.name.startsWith('.'));

        // Match Strategy A: Exact filename without extension
        const targetClean = cleanCekNo.toLowerCase();
        const exactMatch = validFiles.find((f) => {
          const fBase = f.name.toLowerCase().replace(/\.[^/.]+$/, '');
          return fBase === targetClean || f.name.toLowerCase() === targetClean;
        });
        if (exactMatch) {
          return await packageResult(bucket, folder, exactMatch.name);
        }

        // Match Strategy B: Numeric-only match (e.g. "001234" vs "1234")
        const targetDigits = cleanCekNo.replace(/\D/g, '');
        if (targetDigits.length >= 3) {
          const digitMatch = validFiles.find((f) => {
            const fDigits = f.name.replace(/\D/g, '');
            return fDigits === targetDigits || (fDigits.length >= targetDigits.length && fDigits.endsWith(targetDigits));
          });
          if (digitMatch) {
            return await packageResult(bucket, folder, digitMatch.name);
          }
        }

        // Match Strategy C: Filename starts with or contains cekNo
        const partialMatch = validFiles.find((f) => {
          const fLower = f.name.toLowerCase();
          return fLower.startsWith(targetClean + '.') || fLower.startsWith(targetClean + '_') || fLower.startsWith(targetClean + '-');
        });
        if (partialMatch) {
          return await packageResult(bucket, folder, partialMatch.name);
        }

        const containsMatch = validFiles.find((f) => {
          const fLower = f.name.toLowerCase();
          return fLower.includes(targetClean);
        });
        if (containsMatch) {
          return await packageResult(bucket, folder, containsMatch.name);
        }
      } catch (err) {
        console.warn(`Error scanning folder "${folder}" in bucket "${bucket}":`, err);
      }
    }
  }

  // STEP 3: Direct Probing with standard file extensions across folders
  const probeExtensions = ['pdf', 'PDF', 'jpg', 'jpeg', 'png', 'PNG'];
  for (const bucket of bucketsToSearch) {
    for (const folder of baseFolders) {
      for (const ext of probeExtensions) {
        const testFileName = `${cleanCekNo}.${ext}`;
        const fullPath = folder ? `${folder}/${testFileName}` : testFileName;

        try {
          const { data: dlData, error: dlErr } = await supabase.storage.from(bucket).download(fullPath);
          if (!dlErr && dlData && dlData.size > 0) {
            return await packageResult(bucket, folder, testFileName, dlData);
          }
        } catch {
          // continue probe
        }
      }
    }
  }

  // If not found in any folder or bucket
  const primaryFolder = santiyeBirim && santiyeBirim !== '-' ? santiyeBirim : '';
  const fallbackFileName = `${cleanCekNo}.pdf`;
  const { data: defaultPub } = supabase.storage
    .from(BUCKET_KAYITEDILENCEKLER)
    .getPublicUrl(primaryFolder ? `${primaryFolder}/${fallbackFileName}` : fallbackFileName);

  return {
    found: false,
    bucket: BUCKET_KAYITEDILENCEKLER,
    folder: primaryFolder,
    fileName: fallbackFileName,
    publicUrl: defaultPub.publicUrl,
    fileType: 'pdf',
    error: `"${cleanCekNo}" numaralı çeke ait evrak "KAYITEDILENCEKLER" ve "CEKLER" depolama alanlarında bulunamadı. Lütfen dosyanın yüklendiğini veya doğru çek numarasıyla kaydedildiğini kontrol ediniz.`,
  };
}

/**
 * Downloads a file directly from Supabase Storage
 */
export async function downloadStorageFile(bucket: string, folder: string, fileName: string, customUrl?: string) {
  const fullPath = folder ? `${folder}/${fileName}` : fileName;
  try {
    const { data, error } = await supabase.storage.from(bucket).download(fullPath);
    if (!error && data && data.size > 0) {
      const ext = fileName.split('.').pop()?.toLowerCase() || '';
      const mime = ext === 'pdf' ? 'application/pdf' : ['jpg', 'jpeg', 'png'].includes(ext) ? 'image/jpeg' : data.type;
      const blob = new Blob([data], { type: mime });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      return;
    }

    // Fallback: Try signed URL
    const { data: signData } = await supabase.storage.from(bucket).createSignedUrl(fullPath, 3600);
    const targetUrl = customUrl || signData?.signedUrl || supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;

    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download error, fallback to URL:', err);
    const targetUrl = customUrl || supabase.storage.from(bucket).getPublicUrl(fullPath).data.publicUrl;
    window.open(targetUrl, '_blank');
  }
}

/**
 * Check if a file with the given name (with extension) already exists in the bucket folder
 */
export async function checkIfFileExists(
  folder: string,
  fileNameWithExt: string,
  bucket: string = BUCKET_CEKLER
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 200,
        search: fileNameWithExt,
      });

    if (error) {
      console.warn('File existence check warning:', error);
      return false;
    }

    if (!data || data.length === 0) return false;

    // Strict name match
    return data.some((item) => item.name.toLowerCase() === fileNameWithExt.toLowerCase());
  } catch (err) {
    console.error('Error checking file existence:', err);
    return false;
  }
}

/**
 * Upload a file to the specified folder in CEKLER bucket
 */
export async function uploadCekFile(
  folder: string,
  fileNameWithExt: string,
  file: File | Blob,
  contentType?: string,
  bucket: string = BUCKET_CEKLER,
  upsert: boolean = false
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const filePath = `${folder}/${fileNameWithExt}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: upsert,
        contentType: contentType || file.type || 'application/octet-stream',
      });

    if (error) {
      if (error.message && (error.message.includes('already exists') || error.message.includes('Duplicate'))) {
        return {
          success: false,
          error: `AYNI İSİMDE KAYIT VAR: "${fileNameWithExt}" isimli dosya "${folder}" klasöründe zaten mevcut!`,
        };
      }
      return { success: false, error: error.message || 'Dosya yüklenirken hata oluştu' };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Bilinmeyen bir hata meydana geldi.' };
  }
}

/**
 * List files in the folder (supports both CEKLER and KAYITEDILENCEKLER)
 */
export async function listFolderFiles(bucket: string, folder: string) {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, {
        limit: 300,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      // Special handling for Turkish character 'İ' vs 'I' (DİGER vs DIGER)
      if (folder === 'DİGER' || folder === 'DIGER') {
        const altFolder = folder === 'DİGER' ? 'DIGER' : 'DİGER';
        const altRes = await supabase.storage.from(bucket).list(altFolder, {
          limit: 300,
          sortBy: { column: 'created_at', order: 'desc' },
        });
        if (altRes.data && altRes.data.length > 0) {
          return { data: altRes.data, error: null, resolvedFolder: altFolder };
        }
      }
      return { data: [], error: error.message, resolvedFolder: folder };
    }

    // If empty result and folder is DİGER/DIGER, check alternate spelling
    if ((!data || data.length === 0) && (folder === 'DİGER' || folder === 'DIGER')) {
      const altFolder = folder === 'DİGER' ? 'DIGER' : 'DİGER';
      const altRes = await supabase.storage.from(bucket).list(altFolder, {
        limit: 300,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (altRes.data && altRes.data.length > 0) {
        return { data: altRes.data, error: null, resolvedFolder: altFolder };
      }
    }

    return { data: data || [], error: null, resolvedFolder: folder };
  } catch (err: any) {
    return { data: [], error: err.message, resolvedFolder: folder };
  }
}

/**
 * Get Public URL for a file
 */
export function getFilePublicUrl(bucket: string, folder: string, fileName: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(`${folder}/${fileName}`);
  return data.publicUrl;
}

/**
 * Fetch all records from CEKKAYIT table in Supabase
 */
export async function fetchCekKayitRecords(): Promise<{ data: any[]; error: string | null }> {
  try {
    // Try uppercase 'CEKKAYIT' first
    let { data, error } = await supabase
      .from('CEKKAYIT')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      // Fallback to lowercase 'cekkayit' or try without ordering by id if id doesn't exist
      const lowerRes = await supabase
        .from('cekkayit')
        .select('*');

      if (!lowerRes.error && lowerRes.data) {
        return { data: lowerRes.data, error: null };
      }

      // Try with unconstrained select from CEKKAYIT
      const retryRes = await supabase.from('CEKKAYIT').select('*');
      if (!retryRes.error && retryRes.data) {
        return { data: retryRes.data, error: null };
      }

      console.error('Supabase CEKKAYIT fetch error:', error);
      return { data: [], error: error.message || 'Kayıtlar yüklenirken bir hata oluştu.' };
    }

    return { data: data || [], error: null };
  } catch (err: any) {
    console.error('Fetch CEKKAYIT exception:', err);
    return { data: [], error: err.message || 'Veritabanı bağlantı hatası.' };
  }
}
