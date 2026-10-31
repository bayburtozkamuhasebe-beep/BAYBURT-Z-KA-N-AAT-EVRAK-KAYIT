export interface TabConfig {
  id: string;
  name: string;
  ceklerFolder: string;
  kayitEdilenFolder: string;
  description: string;
  badgeColor?: string;
}

export const TABS: TabConfig[] = [
  {
    id: 'evrak-kayit',
    name: 'EVRAK KAYIT',
    ceklerFolder: 'MAMAK',
    kayitEdilenFolder: 'MAMAK',
    description: 'Evrak ve çek kayıt işlemleri',
    badgeColor: 'from-amber-500 to-amber-600',
  },
];

export interface UploadedFileItem {
  name: string;
  id?: string;
  updated_at?: string;
  created_at?: string;
  last_accessed_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}
