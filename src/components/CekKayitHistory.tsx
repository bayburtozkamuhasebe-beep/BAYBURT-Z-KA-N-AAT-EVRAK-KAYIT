import React, { useState, useEffect, useMemo } from 'react';
import { AmbientBackground } from './AmbientBackground';
import {
  ArrowLeft,
  Search,
  RefreshCw,
  Building2,
  FileSpreadsheet,
  AlertCircle,
  Database,
  Filter,
  CheckCircle2,
  Layers,
  ChevronDown,
  X,
  CreditCard,
  User,
  Calendar,
  Building,
  DollarSign,
  Download,
  Eye,
  Hash,
  ArrowUp10,
  ArrowUpDown,
  ArrowUpNarrowWide,
  FileText,
  ExternalLink,
  FolderOpen,
  Loader2,
  Image as ImageIcon,
  FileDown,
} from 'lucide-react';
import {
  fetchCekKayitRecords,
  findCheckDocument,
  downloadStorageFile,
  BUCKET_KAYITEDILENCEKLER,
  DocumentSearchResult,
} from '../lib/supabase';

interface CekKayitHistoryProps {
  onBack: () => void;
  currentUser?: string | null;
  onSwitchUser?: () => void;
}

export interface CekKayitItem {
  id?: string | number;
  SANTIYE_BIRIM?: string;
  santiye_birim?: string;
  ALACAKLI?: string;
  alacakli?: string;
  CEK_NUMARASI?: string | number;
  cek_numarasi?: string | number;
  CEK_NO?: string | number;
  cek_no?: string | number;
  TUTAR?: string | number;
  tutar?: string | number;
  VADE_TARIHI?: string;
  vade_tarihi?: string;
  BANKA?: string;
  banka?: string;
  SUBE?: string;
  sube?: string;
  HESAP_NO?: string;
  hesap_no?: string;
  DURUM?: string;
  durum?: string;
  created_at?: string;
  [key: string]: any;
}

// Target categories requested by user
export const SANTIYE_GROUPS = [
  { id: 'ARNAVUTKOY', title: 'ARNAVUTKÖY', color: 'border-blue-500/40 text-blue-400 bg-blue-500/10' },
  { id: 'BURSA-OZKA', title: 'BURSA - ÖZKA', color: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' },
  { id: 'MSB-OZKA', title: 'MSB - ÖZKA', color: 'border-amber-500/40 text-amber-400 bg-amber-500/10' },
  { id: 'MAMAK', title: 'MAMAK', color: 'border-rose-500/40 text-rose-400 bg-rose-500/10' },
  { id: 'SEKA', title: 'SEKA', color: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10' },
  { id: 'DIGER', title: 'DİĞER', color: 'border-purple-500/40 text-purple-400 bg-purple-500/10' },
];

/**
 * Normalizes Turkish characters and classifies SANTIYE_BIRIM
 */
function classifySantiye(rawVal: any): string {
  if (!rawVal) return 'DIGER';
  const val = String(rawVal)
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .trim();

  if (val.includes('ARNAVUT')) return 'ARNAVUTKOY';
  if (val.includes('BURSA')) return 'BURSA-OZKA';
  if (val.includes('MSB')) return 'MSB-OZKA';
  if (val.includes('MAMAK')) return 'MAMAK';
  if (val.includes('SEKA')) return 'SEKA';

  return 'DIGER';
}

function normalizeKey(k: string): string {
  return k
    .toUpperCase()
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/[\s_-]/g, '');
}

function getFieldValue(item: CekKayitItem, ...keys: string[]): string {
  if (!item) return '-';
  // 1. Direct exact key match
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
      return String(item[k]).trim();
    }
  }

  // 2. Case and underscore insensitive key match
  const itemEntries = Object.entries(item);
  for (const targetKey of keys) {
    const normTarget = normalizeKey(targetKey);
    for (const [k, v] of itemEntries) {
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        if (normalizeKey(k) === normTarget) {
          return String(v).trim();
        }
      }
    }
  }

  return '-';
}

/**
 * Extracts the CEK_NUMARASI value from a record
 */
export function extractCekNo(item: CekKayitItem): string {
  return getFieldValue(
    item,
    'CEK_NUMARASI',
    'cek_numarasi',
    'Cek_Numarasi',
    'CEK_NO',
    'cek_no',
    'Cek_No',
    'CEKNUMARASI',
    'ceknumarasi',
    'CEK_NUMARA',
    'cek_numara',
    'CEKNO',
    'cekNo',
    'CEK',
    'cek',
    'EVRAK_NO',
    'evrak_no',
    'NUMARA'
  );
}

/**
 * Sort items by CEK_NUMARASI in ascending order (Küçükten Büyüğe)
 */
export function sortCekItemsAscending(items: CekKayitItem[]): CekKayitItem[] {
  return [...items].sort((a, b) => {
    const valA = extractCekNo(a);
    const valB = extractCekNo(b);

    if (valA === '-' && valB === '-') return 0;
    if (valA === '-') return 1; // place empty/dash items at the end
    if (valB === '-') return -1;

    // Check if both are numeric values (ignoring spaces)
    const cleanA = valA.replace(/\s+/g, '');
    const cleanB = valB.replace(/\s+/g, '');

    const isNumA = /^\d+$/.test(cleanA);
    const isNumB = /^\d+$/.test(cleanB);

    if (isNumA && isNumB) {
      try {
        const bigA = BigInt(cleanA);
        const bigB = BigInt(cleanB);
        if (bigA < bigB) return -1;
        if (bigA > bigB) return 1;
        return 0;
      } catch {
        // Fallback to numeric parseFloat
        const fA = parseFloat(cleanA);
        const fB = parseFloat(cleanB);
        if (!isNaN(fA) && !isNaN(fB)) {
          return fA - fB;
        }
      }
    }

    // Natural alphanumeric sorting in Turkish locale
    return valA.localeCompare(valB, 'tr', { numeric: true, sensitivity: 'base' });
  });
}

export const CekKayitHistory: React.FC<CekKayitHistoryProps> = ({
  onBack,
  currentUser,
  onSwitchUser,
}) => {
  const [records, setRecords] = useState<CekKayitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [selectedItemDetail, setSelectedItemDetail] = useState<CekKayitItem | null>(null);

  // Evrak Viewer Modal State
  const [activeEvrakViewer, setActiveEvrakViewer] = useState<{
    item: CekKayitItem;
    cekNo: string;
    santiye: string;
    alacakli: string;
    tutar: string;
    loading: boolean;
    docResult?: DocumentSearchResult;
  } | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Load records from Supabase CEKKAYIT table
  const loadData = async () => {
    setLoading(true);
    setError(null);
    const res = await fetchCekKayitRecords();
    if (res.error) {
      setError(res.error);
    } else {
      setRecords(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle showing evrak from KAYITEDILENCEKLER
  const handleShowEvrak = async (item: CekKayitItem) => {
    const cekNo = extractCekNo(item);
    const santiye = getFieldValue(item, 'SANTIYE_BIRIM', 'santiye_birim', 'Santiye_Birim', 'SANTIYE', 'santiye', 'BIRIM');
    const alacakli = getFieldValue(item, 'ALACAKLI', 'alacakli', 'Alacakli', 'ALACAKLI_FIRMA', 'FIRMA');
    const tutar = getFieldValue(item, 'TUTAR', 'tutar', 'Tutar', 'CEK_TUTARI', 'MEBLAG');

    setActiveEvrakViewer({
      item,
      cekNo,
      santiye,
      alacakli,
      tutar,
      loading: true,
    });

    try {
      const docResult = await findCheckDocument(cekNo, santiye, item);
      setActiveEvrakViewer({
        item,
        cekNo,
        santiye,
        alacakli,
        tutar,
        loading: false,
        docResult,
      });
    } catch (err: any) {
      setActiveEvrakViewer({
        item,
        cekNo,
        santiye,
        alacakli,
        tutar,
        loading: false,
        docResult: {
          found: false,
          bucket: BUCKET_KAYITEDILENCEKLER,
          folder: santiye,
          fileName: `${cekNo}.pdf`,
          publicUrl: '',
          fileType: 'pdf',
          error: err.message || 'Evrak yüklenirken hata oluştu.',
        },
      });
    }
  };

  // Handle direct file download
  const handleDownloadDocument = async () => {
    if (!activeEvrakViewer?.docResult) return;
    setDownloading(true);
    try {
      const { bucket, folder, fileName, publicUrl } = activeEvrakViewer.docResult;
      await downloadStorageFile(bucket, folder, fileName, publicUrl);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Filter records based on searchQuery (Alacaklı & Çek No) and sort ascending by CEK_NUMARASI
  const filteredRecords = useMemo(() => {
    let result = records;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = records.filter((item) => {
        const alacakli = (
          getFieldValue(item, 'ALACAKLI', 'alacakli', 'Alacakli', 'ALACAKLI_FIRMA', 'FIRMA') || ''
        ).toLowerCase();
        const cekNo = extractCekNo(item).toLowerCase();
        const santiye = (
          getFieldValue(item, 'SANTIYE_BIRIM', 'santiye_birim', 'Santiye_Birim', 'SANTIYE', 'santiye', 'BIRIM') || ''
        ).toLowerCase();
        const banka = (getFieldValue(item, 'BANKA', 'banka', 'Banka', 'BANKA_ADI') || '').toLowerCase();

        return (
          alacakli.includes(query) ||
          cekNo.includes(query) ||
          santiye.includes(query) ||
          banka.includes(query)
        );
      });
    }

    // Sort ascending by CEK_NUMARASI (Küçükten Büyüğe)
    return sortCekItemsAscending(result);
  }, [records, searchQuery]);

  // Group records by SANTIYE_BIRIM and ensure each group is sorted ascending by CEK_NUMARASI
  const groupedRecords = useMemo(() => {
    const map: Record<string, CekKayitItem[]> = {
      'ARNAVUTKOY': [],
      'BURSA-OZKA': [],
      'MSB-OZKA': [],
      'MAMAK': [],
      'SEKA': [],
      'DIGER': [],
    };

    filteredRecords.forEach((item) => {
      const rawSantiye = getFieldValue(
        item,
        'SANTIYE_BIRIM',
        'santiye_birim',
        'Santiye_Birim',
        'SANTIYE',
        'santiye',
        'BIRIM',
        'birim'
      );
      const groupKey = classifySantiye(rawSantiye);
      if (map[groupKey]) {
        map[groupKey].push(item);
      } else {
        map['DIGER'].push(item);
      }
    });

    // Sort each group ascending by CEK_NUMARASI
    for (const key of Object.keys(map)) {
      map[key] = sortCekItemsAscending(map[key]);
    }

    return map;
  }, [filteredRecords]);

  // Highlight search text helper
  const renderHighlighted = (text: string, query: string) => {
    if (!query.trim() || !text || text === '-') return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-yellow-400/30 text-yellow-200 px-0.5 rounded font-bold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  // Export visible data to CSV
  const handleExportCSV = () => {
    if (filteredRecords.length === 0) return;
    const headers = ['SIRA', 'SANTIYE_BIRIM', 'CEK_NUMARASI', 'ALACAKLI', 'TUTAR', 'VADE_TARIHI', 'BANKA', 'SUBE', 'HESAP_NO', 'DURUM'];
    const rows = filteredRecords.map((item, idx) => [
      idx + 1,
      `"${getFieldValue(item, 'SANTIYE_BIRIM', 'santiye_birim')}"`,
      `"${getFieldValue(item, 'CEK_NUMARASI', 'cek_numarasi', 'CEK_NO', 'cek_no', 'CEKNUMARASI', 'ceknumarasi', 'CEK_NUMARA')}"`,
      `"${getFieldValue(item, 'ALACAKLI', 'alacakli')}"`,
      `"${getFieldValue(item, 'TUTAR', 'tutar')}"`,
      `"${getFieldValue(item, 'VADE_TARIHI', 'vade_tarihi')}"`,
      `"${getFieldValue(item, 'BANKA', 'banka')}"`,
      `"${getFieldValue(item, 'SUBE', 'sube')}"`,
      `"${getFieldValue(item, 'HESAP_NO', 'hesap_no')}"`,
      `"${getFieldValue(item, 'DURUM', 'durum')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CEKKAYIT_GECMIS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white pb-12 relative">
      <AmbientBackground />
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-black/30">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* ANA SAYFAYA GERİ DÖN BUTONU */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#7A0C1E] hover:bg-[#8f1025] active:scale-95 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-rose-950/50 border border-rose-500/40 transition-all uppercase tracking-wider shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-rose-200" />
            <span>Ana Sayfaya Geri Dön</span>
          </button>

          <div className="h-7 w-[1px] bg-slate-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-rose-500 shrink-0" />
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                <span>CEKKAYIT TABLOSU - GEÇMİŞ KAYITLAR</span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              Şantiye / Birim Bazında Gruplandırılmış Çek Verileri
            </p>
          </div>
        </div>

        {/* Right action tools */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 self-end md:self-auto">
          {currentUser && (
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl shadow backdrop-blur-md">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#7A0C1E] to-rose-600 text-white font-extrabold text-[10px] shadow-sm">
                {currentUser
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <span className="text-xs font-bold text-white tracking-tight hidden sm:inline">
                {currentUser}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs font-mono text-slate-300">
            <span className="text-slate-400">Toplam Kayıt:</span>
            <span className="font-bold text-rose-400">{records.length}</span>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
            title="CSV / Excel olarak indir"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Excel/CSV İndir</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold rounded-xl border border-rose-500/30 transition shadow"
            title="Tabloyu Yenile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        
        {/* Search & Filter Dock */}
        <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-5 shadow-2xl backdrop-blur-md flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5 text-rose-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Alacaklı İsmi veya Çek Numarası ile ara (Bul)..."
              className="w-full pl-12 pr-10 py-3.5 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-2xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 text-sm font-medium transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Group Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
            <button
              type="button"
              onClick={() => setSelectedGroup('ALL')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all whitespace-nowrap border ${
                selectedGroup === 'ALL'
                  ? 'bg-[#7A0C1E] text-white border-rose-400 shadow-md shadow-rose-950/40'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              TÜM ŞANTİYELER ({filteredRecords.length})
            </button>
            {SANTIYE_GROUPS.map((grp) => {
              const count = groupedRecords[grp.id]?.length || 0;
              const isActive = selectedGroup === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setSelectedGroup(grp.id)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide uppercase transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-rose-950 text-rose-200 border-rose-400 shadow-md ring-1 ring-rose-500/50'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span>{grp.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-900/40 rounded-3xl border border-slate-800">
            <RefreshCw className="w-10 h-10 text-rose-500 animate-spin" />
            <p className="font-bold text-sm text-slate-200 uppercase tracking-wider">
              CEKKAYIT Tablosu Yükleniyor...
            </p>
            <p className="text-xs text-slate-500">Supabase veritabanından çek kayıtları getiriliyor</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-8 rounded-3xl border border-rose-500/40 bg-rose-950/20 text-rose-300 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-8 h-8 text-rose-400 shrink-0" />
              <div>
                <h4 className="font-bold text-sm uppercase">Kayıtlar Getirilemedi</h4>
                <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shrink-0"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {/* Tables Display Area */}
        {!loading && !error && (
          <div className="flex flex-col gap-8">
            {SANTIYE_GROUPS.map((group) => {
              // If a specific group is selected, skip others
              if (selectedGroup !== 'ALL' && selectedGroup !== group.id) {
                return null;
              }

              const groupItems = groupedRecords[group.id] || [];

              return (
                <div
                  key={group.id}
                  className="rounded-3xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-2xl transition-all"
                >
                  {/* Table Header Banner */}
                  <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${group.color} font-black text-sm shadow-inner`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="font-black text-base text-slate-100 tracking-wide uppercase">
                            {group.title} ŞANTİYESİ / BİRİMİ
                          </h2>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {groupItems.length} Kayıt
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          SANTIYE_BIRIM: {group.id === 'DIGER' ? 'DİĞER / EŞLEŞMEYEN' : group.id}
                        </p>
                      </div>
                    </div>

                    {groupItems.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/30 text-[11px] font-mono font-bold text-rose-300">
                          <ArrowUp10 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Çek No: Küçükten Büyüğe Sıralı</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                          {groupItems.length} Adet Çek
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Table Body */}
                  {groupItems.length === 0 ? (
                    <div className="p-10 text-center flex flex-col items-center justify-center gap-2 text-slate-500">
                      <FileSpreadsheet className="w-8 h-8 text-slate-600" />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {searchQuery ? 'Arama kriterine uygun kayıt bulunamadı' : 'Bu birime ait kayıt bulunamadı'}
                      </p>
                      {searchQuery && (
                        <p className="text-[11px] text-slate-500 font-mono">
                          "{searchQuery}" aramasıyla eşleşen veri yok.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Mobile Card List (md:hidden) for Phone screens */}
                      <div className="md:hidden divide-y divide-slate-800/80">
                        {groupItems.map((item, idx) => {
                          const santiyeVal = getFieldValue(item, 'SANTIYE_BIRIM', 'santiye_birim', 'Santiye_Birim', 'SANTIYE', 'santiye', 'BIRIM');
                          const cekNoVal = getFieldValue(
                            item,
                            'CEK_NUMARASI',
                            'cek_numarasi',
                            'Cek_Numarasi',
                            'CEK_NO',
                            'cek_no',
                            'Cek_No',
                            'CEKNUMARASI',
                            'ceknumarasi',
                            'CEK_NUMARA',
                            'cek_numara',
                            'CEKNO',
                            'cekNo',
                            'CEK',
                            'cek',
                            'EVRAK_NO',
                            'evrak_no',
                            'NUMARA'
                          );
                          const alacakliVal = getFieldValue(item, 'ALACAKLI', 'alacakli', 'Alacakli', 'ALACAKLI_FIRMA', 'FIRMA');
                          const tutarVal = getFieldValue(item, 'TUTAR', 'tutar', 'Tutar', 'CEK_TUTARI', 'MEBLAG');
                          const vadeVal = getFieldValue(item, 'VADE_TARIHI', 'vade_tarihi', 'Vade_Tarihi', 'VADE', 'vade');
                          const bankaVal = getFieldValue(item, 'BANKA', 'banka', 'Banka', 'BANKA_ADI');
                          const subeVal = getFieldValue(item, 'SUBE', 'sube', 'Sube');
                          const durumVal = getFieldValue(item, 'DURUM', 'durum', 'Durum', 'STATU');

                          return (
                            <div
                              key={`m-${item.id || idx}`}
                              className="p-4 bg-slate-900/40 hover:bg-slate-800/30 transition-colors flex flex-col gap-2.5"
                              onClick={() => setSelectedItemDetail(item)}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-mono text-slate-500">#{idx + 1}</span>
                                  <div className="inline-flex items-center gap-1.5 bg-rose-500/15 px-2.5 py-1 rounded-lg border border-rose-500/30 text-rose-300 font-mono font-black text-xs">
                                    <span>ÇEK:</span>
                                    <span>{renderHighlighted(cekNoVal, searchQuery)}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                  {santiyeVal}
                                </span>
                              </div>

                              <div className="text-slate-100 font-bold text-sm leading-snug">
                                {renderHighlighted(alacakliVal, searchQuery)}
                              </div>

                              <div className="flex items-center justify-between text-xs font-mono gap-2 pt-1 border-t border-slate-800/60">
                                <span className="text-emerald-400 font-black text-sm">
                                  {tutarVal !== '-' ? `${tutarVal}` : '-'}
                                </span>
                                <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span>Vade: {vadeVal}</span>
                                </span>
                              </div>

                              {(bankaVal !== '-' || durumVal !== '-') && (
                                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                                  <span className="truncate max-w-[180px]">
                                    {bankaVal} {subeVal !== '-' ? `(${subeVal})` : ''}
                                  </span>
                                  {durumVal !== '-' && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      {durumVal}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowEvrak(item);
                                  }}
                                  className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-700 to-red-600 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-950/50 border border-rose-500/50 uppercase tracking-wider"
                                >
                                  <FileText className="w-3.5 h-3.5 text-rose-100" />
                                  <span>EVRAĞI GÖSTER</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItemDetail(item);
                                  }}
                                  className="p-2 min-h-[42px] min-w-[42px] inline-flex items-center justify-center rounded-xl bg-slate-800 text-slate-300 border border-slate-700"
                                  title="Detay"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table View (hidden on mobile md:table) */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-mono font-bold uppercase tracking-wider text-[11px]">
                              <th className="py-3 px-4 w-12 text-center">#</th>
                              <th className="py-3 px-4">ŞANTİYE / BİRİM</th>
                              <th className="py-3 px-4 font-black text-rose-400">
                                <div className="inline-flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 text-rose-300">
                                  <span>ÇEK NUMARASI</span>
                                  <ArrowUp10 className="w-3.5 h-3.5 text-rose-400" title="Küçükten Büyüğe Sıralı" />
                                </div>
                              </th>
                              <th className="py-3 px-4 font-black text-slate-200">ALACAKLI</th>
                              <th className="py-3 px-4">TUTAR</th>
                              <th className="py-3 px-4">VADE TARİHİ</th>
                              <th className="py-3 px-4">BANKA / ŞUBE</th>
                              <th className="py-3 px-4">DURUM</th>
                              <th className="py-3 px-4 text-center w-36 font-black text-rose-400">
                                <div className="inline-flex items-center gap-1.5 justify-center">
                                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                                  <span>EVRAK</span>
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-medium">
                            {groupItems.map((item, idx) => {
                              const santiyeVal = getFieldValue(item, 'SANTIYE_BIRIM', 'santiye_birim', 'Santiye_Birim', 'SANTIYE', 'santiye', 'BIRIM');
                              const cekNoVal = getFieldValue(
                                item,
                                'CEK_NUMARASI',
                                'cek_numarasi',
                                'Cek_Numarasi',
                                'CEK_NO',
                                'cek_no',
                                'Cek_No',
                                'CEKNUMARASI',
                                'ceknumarasi',
                                'CEK_NUMARA',
                                'cek_numara',
                                'CEKNO',
                                'cekNo',
                                'CEK',
                                'cek',
                                'EVRAK_NO',
                                'evrak_no',
                                'NUMARA'
                              );
                              const alacakliVal = getFieldValue(item, 'ALACAKLI', 'alacakli', 'Alacakli', 'ALACAKLI_FIRMA', 'FIRMA');
                              const tutarVal = getFieldValue(item, 'TUTAR', 'tutar', 'Tutar', 'CEK_TUTARI', 'MEBLAG');
                              const vadeVal = getFieldValue(item, 'VADE_TARIHI', 'vade_tarihi', 'Vade_Tarihi', 'VADE', 'vade');
                              const bankaVal = getFieldValue(item, 'BANKA', 'banka', 'Banka', 'BANKA_ADI');
                              const subeVal = getFieldValue(item, 'SUBE', 'sube', 'Sube');
                              const durumVal = getFieldValue(item, 'DURUM', 'durum', 'Durum', 'STATU');

                              return (
                                <tr
                                  key={item.id || idx}
                                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                                  onClick={() => setSelectedItemDetail(item)}
                                >
                                  <td className="py-3.5 px-4 text-center font-mono text-slate-500">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono font-semibold text-slate-300 whitespace-nowrap">
                                    {santiyeVal}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono font-bold text-rose-300 whitespace-nowrap">
                                    {renderHighlighted(cekNoVal, searchQuery)}
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-100 font-bold max-w-xs truncate">
                                    {renderHighlighted(alacakliVal, searchQuery)}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                                    {tutarVal !== '-' ? `${tutarVal}` : '-'}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                                    {vadeVal}
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                                    <span>{bankaVal}</span>
                                    {subeVal !== '-' && <span className="text-slate-500 text-[10px] ml-1">({subeVal})</span>}
                                  </td>
                                  <td className="py-3.5 px-4 whitespace-nowrap">
                                    {durumVal !== '-' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        {durumVal}
                                      </span>
                                    ) : (
                                      <span className="text-slate-600">-</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    <div className="inline-flex items-center gap-2 justify-center">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleShowEvrak(item);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white text-xs font-bold shadow-md shadow-rose-950/50 border border-rose-500/50 hover:border-rose-400 transition-all duration-200 active:scale-95 cursor-pointer uppercase tracking-wider"
                                        title="KAYITEDILENCEKLER'deki Çek Evrağını Göster ve İndir"
                                      >
                                        <FileText className="w-3.5 h-3.5 text-rose-100" />
                                        <span>GÖSTER</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedItemDetail(item);
                                        }}
                                        className="p-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/60 transition"
                                        title="Kayıt Bilgilerini İncele"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer in History Page */}
        <div className="mt-12 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 font-medium gap-2">
          <span className="text-[10px] text-slate-600 font-mono">SUPABASE: CEKKAYIT &amp; KAYITEDILENCEKLER</span>
          <span className="text-slate-400 font-medium tracking-wide">
            Yazılım ve Tasarım : <span className="text-slate-200 font-semibold">Emirhan KALHAN</span>
          </span>
          <span className="text-[10px] text-slate-600 font-mono">&copy; {new Date().getFullYear()} BAYBURT ÖZ-KA İNŞAAT</span>
        </div>
      </div>

      {/* Evrak Viewer & Download Modal (KAYITEDILENCEKLER) */}
      {activeEvrakViewer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-0 sm:p-5 backdrop-blur-md animate-in fade-in"
          onClick={() => setActiveEvrakViewer(null)}
        >
          <div
            className="relative w-full max-w-5xl h-full sm:h-[90vh] overflow-hidden rounded-none sm:rounded-3xl border-0 sm:border border-slate-800 bg-slate-950 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-6 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-red-800 text-white shadow-lg shadow-rose-950/50 border border-rose-500/30 shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      KAYITEDILENCEKLER
                    </span>
                    {activeEvrakViewer.santiye && (
                      <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        {activeEvrakViewer.santiye}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base text-slate-100 mt-1 flex items-center gap-2 truncate">
                    <span>ÇEK EVRAĞI:</span>
                    <span className="font-mono text-rose-400 font-extrabold">{activeEvrakViewer.cekNo}</span>
                    {activeEvrakViewer.alacakli !== '-' && (
                      <span className="text-slate-400 font-normal text-xs truncate">({activeEvrakViewer.alacakli})</span>
                    )}
                  </h3>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {activeEvrakViewer.docResult?.publicUrl && (
                  <>
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={handleDownloadDocument}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition active:scale-95 disabled:opacity-50 uppercase tracking-wider"
                      title="Evrağı Bilgisayara İndir"
                    >
                      {downloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileDown className="w-4 h-4 text-emerald-100" />
                      )}
                      <span>{downloading ? 'İndiriliyor...' : 'İNDİR'}</span>
                    </button>

                    <a
                      href={activeEvrakViewer.docResult.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition"
                      title="Yeni Tarayıcı Sekmesinde Aç"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                      <span className="hidden sm:inline">Yeni Sekmede Aç</span>
                    </a>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setActiveEvrakViewer(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  title="Kapat"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer */}
            <div className="flex-1 bg-slate-950 p-4 sm:p-6 overflow-hidden flex flex-col items-center justify-center relative">
              {activeEvrakViewer.loading ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin" />
                    <FileText className="w-7 h-7 text-rose-400 absolute" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">KAYITEDILENCEKLER Depolama Alanı Taranıyor</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">
                      "{activeEvrakViewer.cekNo}" numaralı çeke ait dosya aranıyor...
                    </p>
                  </div>
                </div>
              ) : activeEvrakViewer.docResult?.found && activeEvrakViewer.docResult.publicUrl ? (
                <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
                  {activeEvrakViewer.docResult.fileType === 'pdf' ? (
                    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900 flex flex-col relative">
                      <object
                        data={activeEvrakViewer.docResult.publicUrl}
                        type="application/pdf"
                        className="w-full h-full border-0 bg-white"
                      >
                        <iframe
                          src={`${activeEvrakViewer.docResult.publicUrl}#toolbar=1&navpanes=0`}
                          className="w-full h-full border-0 bg-white"
                          title="Çek PDF Evrağı"
                        />
                      </object>
                    </div>
                  ) : activeEvrakViewer.docResult.fileType === 'image' ? (
                    <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
                      <img
                        src={activeEvrakViewer.docResult.publicUrl}
                        alt={`Çek Evrağı ${activeEvrakViewer.cekNo}`}
                        className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl border border-slate-800"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900 flex flex-col">
                      <iframe
                        src={activeEvrakViewer.docResult.publicUrl}
                        className="w-full h-full border-0 bg-white"
                        title="Çek Evrağı"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 text-center max-w-lg p-6 bg-slate-900/80 rounded-3xl border border-slate-800 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                    <AlertCircle className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
                      Evrak Dosyası Bulunamadı
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {activeEvrakViewer.docResult?.error ||
                        `"${activeEvrakViewer.cekNo}" numarasına ait evrak KAYITEDILENCEKLER klasöründe bulunamadı.`}
                    </p>
                  </div>

                  {/* Manual search input */}
                  <div className="w-full flex items-center gap-2 mt-1">
                    <input
                      type="text"
                      placeholder="Farklı numara ile ara (örn. 12345)..."
                      defaultValue={activeEvrakViewer.cekNo}
                      id="customSearchInput"
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-slate-100 font-mono focus:border-rose-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const inp = (document.getElementById('customSearchInput') as HTMLInputElement)?.value;
                        if (!inp) return;
                        setActiveEvrakViewer((prev) => prev ? { ...prev, loading: true, cekNo: inp.trim() } : null);
                        const res = await findCheckDocument(inp.trim(), activeEvrakViewer.santiye, activeEvrakViewer.item);
                        setActiveEvrakViewer((prev) => prev ? { ...prev, loading: false, docResult: res } : null);
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition shadow"
                    >
                      Ara
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 w-full mt-2">
                    <button
                      type="button"
                      onClick={() => handleShowEvrak(activeEvrakViewer.item)}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Tekrar Tara</span>
                    </button>
                    {activeEvrakViewer.docResult?.publicUrl && (
                      <a
                        href={activeEvrakViewer.docResult.publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-900/80 hover:bg-rose-800 text-rose-200 text-xs font-bold rounded-xl transition border border-rose-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Bağlantıyı Aç</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / File Details Bar */}
            {activeEvrakViewer.docResult?.found && (
              <div className="border-t border-slate-800 bg-slate-900/70 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="w-3.5 h-3.5 text-rose-400" />
                    <span>Konum: <strong>{activeEvrakViewer.docResult.bucket}</strong> / {activeEvrakViewer.docResult.folder || 'Kök'}</span>
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">Dosya: <strong className="text-slate-300">{activeEvrakViewer.docResult.fileName}</strong></span>
                </div>

                <button
                  type="button"
                  disabled={downloading}
                  onClick={handleDownloadDocument}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Dosyayı İndir ({activeEvrakViewer.docResult.fileName})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Row Details Modal */}
      {selectedItemDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setSelectedItemDetail(null)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-100 uppercase">
                    Çek Kayıt Detayları
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedItemDetail.id || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                <Building className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Şantiye / Birim</span>
                  <span className="text-xs font-bold text-slate-200 font-mono">
                    {getFieldValue(selectedItemDetail, 'SANTIYE_BIRIM', 'santiye_birim')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                <Hash className="w-5 h-5 text-rose-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Çek Numarası</span>
                  <span className="text-xs font-bold text-rose-300 font-mono">
                    {getFieldValue(
                      selectedItemDetail,
                      'CEK_NUMARASI',
                      'cek_numarasi',
                      'Cek_Numarasi',
                      'CEK_NO',
                      'cek_no',
                      'CEKNUMARASI',
                      'ceknumarasi',
                      'CEK_NUMARA',
                      'cek_numara'
                    )}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                <User className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Alacaklı</span>
                  <span className="text-xs font-bold text-slate-100 truncate block">
                    {getFieldValue(selectedItemDetail, 'ALACAKLI', 'alacakli')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900 p-3.5 rounded-2xl border border-slate-800 flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Tutar</span>
                  <span className="text-xs font-bold text-emerald-300 font-mono">
                    {getFieldValue(selectedItemDetail, 'TUTAR', 'tutar')}
                  </span>
                </div>
              </div>
            </div>

            {/* Evrak Göster Action Button inside details modal */}
            <div className="p-4 bg-gradient-to-r from-rose-950/40 to-slate-900 rounded-2xl border border-rose-500/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/20 text-rose-300 rounded-xl border border-rose-500/30">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">KAYITEDILENCEKLER Evrak Belgesi</h4>
                  <p className="text-[11px] text-slate-400">Bu çeke ait taranmış veya yüklenmiş evrağı görüntüleyin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const itm = selectedItemDetail;
                  setSelectedItemDetail(null);
                  handleShowEvrak(itm);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7A0C1E] hover:bg-[#961028] text-white text-xs font-bold shadow-md shadow-rose-950/40 border border-rose-500/40 transition active:scale-95 uppercase tracking-wider"
              >
                <FileText className="w-4 h-4" />
                <span>Evrağı Göster</span>
              </button>
            </div>

            {/* All raw fields in the record */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Tüm Kolon Verileri (Tablo Alanları)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {Object.entries(selectedItemDetail).map(([k, v]) => (
                  <div key={k} className="flex flex-col bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">{k}:</span>
                    <span className="text-xs font-mono text-slate-200 break-words mt-0.5 font-semibold">
                      {v !== null && v !== undefined && v !== '' ? String(v) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedItemDetail(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition uppercase"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
