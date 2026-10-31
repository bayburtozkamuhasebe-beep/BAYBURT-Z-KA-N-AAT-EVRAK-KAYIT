import { supabase, BUCKET_CEKLER } from './supabase';

export interface FileUserMeta {
  userName: string;
  timestamp?: string;
  folder?: string;
  personnel?: string[];
  santiye?: string;
}

export interface FileLikeItem {
  name: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    lastModified?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

const LOCAL_STORAGE_KEY = 'bayburt_file_user_mappings_v2';
const METADATA_FILE_PATH = '_metadata/user_file_mappings.json';

// Authorized users list for deterministic assignment of historical/unassigned files
export const DEFAULT_USERS = [
  'Hamza Kaldırım',
  'Murat Kaldırım',
  'Emirhan Kalhan',
] as const;

export type AuthorizedUserName = typeof DEFAULT_USERS[number] | string;

// Memory cache
let inMemoryMap: Record<string, FileUserMeta> = {};
let hasLoadedRemote = false;

// Helper: load local storage
function loadLocalMap(): Record<string, FileUserMeta> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read local user map:', err);
  }
  return {};
}

// Helper: save local storage
function saveLocalMap(map: Record<string, FileUserMeta>) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn('Could not save local user map:', err);
  }
}

/**
 * Detect normalized date key if needed (neutral helper)
 */
export function detectFileDateKey(
  _fileName?: string,
  _dateCandidates?: (string | undefined | null)[]
): string | null {
  return null;
}

// Deterministic fallback for files without explicit user
export function getDeterministicUserForFile(fileName: string): string {
  let hash = 0;
  for (let i = 0; i < fileName.length; i++) {
    hash = (hash << 5) - hash + fileName.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % DEFAULT_USERS.length;
  return DEFAULT_USERS[index];
}

/**
 * Load mappings from both localStorage and Supabase Storage
 */
export async function loadUserMappings(): Promise<Record<string, FileUserMeta>> {
  // 1. Initial memory & local
  const localMap = loadLocalMap();
  inMemoryMap = { ...inMemoryMap, ...localMap };

  // 2. Fetch remote if not yet done or on demand
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_CEKLER)
      .download(METADATA_FILE_PATH);

    if (!error && data) {
      const text = await data.text();
      const remoteMap = JSON.parse(text);
      if (typeof remoteMap === 'object' && remoteMap !== null) {
        inMemoryMap = { ...remoteMap, ...inMemoryMap };
        saveLocalMap(inMemoryMap);
      }
    }
  } catch (err) {
    // Non-critical, fallback to local
    console.warn('Remote user mappings download notice:', err);
  }

  hasLoadedRemote = true;
  return inMemoryMap;
}

/**
 * Register a user for an uploaded file
 */
export async function recordFileUser(
  fileName: string,
  userName: string,
  folder?: string,
  personnel?: string[],
  santiye?: string
): Promise<void> {
  if (!fileName || !userName) return;

  const localMap = loadLocalMap();
  const meta: FileUserMeta = {
    userName: userName.trim(),
    timestamp: new Date().toISOString(),
    folder: folder || '',
    personnel: personnel && personnel.length > 0 ? personnel : undefined,
    santiye: santiye && santiye.trim() ? santiye.trim() : undefined,
  };

  localMap[fileName] = meta;
  inMemoryMap[fileName] = meta;
  saveLocalMap(localMap);

  // Sync to Supabase storage asynchronously
  try {
    const blob = new Blob([JSON.stringify(localMap, null, 2)], {
      type: 'application/json',
    });

    await supabase.storage
      .from(BUCKET_CEKLER)
      .upload(METADATA_FILE_PATH, blob, {
        upsert: true,
        contentType: 'application/json',
      });
  } catch (err) {
    console.warn('Failed to sync user mapping to Supabase storage:', err);
  }
}

/**
 * Get personnel list for a file name or file object
 */
export function getFilePersonnel(fileOrName: string | FileLikeItem): string[] {
  const fileName: string = typeof fileOrName === 'string' ? fileOrName : (fileOrName?.name || '');
  if (!fileName) return [];

  if (inMemoryMap[fileName]?.personnel) {
    return inMemoryMap[fileName].personnel || [];
  }
  const local = loadLocalMap();
  return local[fileName]?.personnel || [];
}

/**
 * Get santiye for a file name or file object
 */
export function getFileSantiye(fileOrName: string | FileLikeItem): string | undefined {
  const fileName: string = typeof fileOrName === 'string' ? fileOrName : (fileOrName?.name || '');
  if (!fileName) return undefined;

  if (inMemoryMap[fileName]?.santiye) {
    return inMemoryMap[fileName].santiye;
  }
  const local = loadLocalMap();
  if (local[fileName]?.santiye) {
    return local[fileName].santiye;
  }

  // Dosya isminden şantiye adını çıkarma (Örn: 7812943_Bursa_Şantiyesi.jpg -> Bursa Şantiyesi)
  const baseName = fileName.replace(/\.[^/.]+$/, '').trim();
  if (baseName.includes('_')) {
    const parts = baseName.split('_');
    parts.shift(); // ilk kısım olan çek numarasını at
    const extracted = parts.join(' ').trim();
    if (extracted) {
      return extracted;
    }
  }

  return undefined;
}

/**
 * Get user for a file name or file object
 */
export function getFileUserName(
  fileOrName: string | FileLikeItem,
  currentUserFallback?: string | null,
  _dateHint?: string
): string {
  const isObj = typeof fileOrName === 'object' && fileOrName !== null;
  const fileName: string = typeof fileOrName === 'string' ? fileOrName : (fileOrName?.name || '');

  if (!fileName) return currentUserFallback || DEFAULT_USERS[0];

  // 1. Explicit mapped user from storage/local
  if (fileName && inMemoryMap[fileName]?.userName) {
    return inMemoryMap[fileName].userName;
  }

  const local = loadLocalMap();
  if (fileName && local[fileName]?.userName) {
    inMemoryMap[fileName] = local[fileName];
    return local[fileName].userName;
  }

  // 2. Deterministic assignment among DEFAULT_USERS for unmapped historical files
  return getDeterministicUserForFile(fileName || 'file');
}
