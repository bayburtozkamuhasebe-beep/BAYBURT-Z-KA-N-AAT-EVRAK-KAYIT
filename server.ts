import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with 30mb limit for high-resolution scanned checks
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

/**
 * Sanitize check number: strips leading zeroes (sıfırlardan sonraki rakamlar)
 * E.g., '009632789' -> '9632789', '9632789' -> '9632789', '000145' -> '145'
 */
function sanitizeCheckNumber(raw: string): string {
  if (!raw) return '';
  const str = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();

  // Find all continuous digits
  const matches = str.match(/\d+/g);
  if (matches && matches.length > 0) {
    // Check serial numbers in Turkey are typically 4 to 11 digits
    const candidate =
      matches.find((m) => {
        const stripped = m.replace(/^0+/, '');
        return stripped.length >= 4 && stripped.length <= 11;
      }) ||
      matches.find((m) => m.replace(/^0+/, '').length > 0) ||
      matches[0];

    const stripped = candidate.replace(/^0+/, '');
    return stripped.length > 0 ? stripped : candidate;
  }
  return '';
}

// POST endpoint for extracting check serial number using Gemini 3.8 Flash
app.post('/api/extract-check-number', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ success: false, error: 'Görsel verisi gönderilmedi.' });
    }

    // Strip any data URI scheme (data:image/jpeg;base64,... etc.)
    let cleanBase64 = imageBase64;
    let detectedMime = mimeType;

    if (imageBase64.includes(',')) {
      const parts = imageBase64.split(',');
      const prefix = parts[0];
      cleanBase64 = parts.slice(1).join(',');
      const match = prefix.match(/data:([^;]+);base64/);
      if (match && match[1]) {
        detectedMime = match[1];
      }
    }

    cleanBase64 = cleanBase64.replace(/\s+/g, '');

    if (!cleanBase64 || cleanBase64.length < 50) {
      return res.status(400).json({ success: false, error: 'Geçersiz veya boş görsel verisi.' });
    }

    // Detect PDF magic header in base64 (JVBERi = %PDF-)
    if (cleanBase64.startsWith('JVBERi')) {
      detectedMime = 'application/pdf';
    }

    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf',
    ];

    let effectiveMime = 'image/jpeg';
    if (detectedMime && allowedMimes.includes(detectedMime.toLowerCase())) {
      effectiveMime = detectedMime.toLowerCase();
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY environment variable is not defined.');
      return res.json({
        success: false,
        checkNumber: '',
        message: 'GEMINI_API_KEY tanımlanmamış.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Sen Türk bankacılık sistemi evrakları (çekler, senetler, makbuzlar) konusunda uzman bir OCR motorusun.
Görseldeki evrağın üzerindeki:
1. ÇEK SERİ NUMARASINI (SERİ NO / ÇEK NO) tespit et.
2. Evrak üzerindeki BANKA ADINI (Örn: DenizBank, Garanti BBVA, Türkiye İş Bankası, Yapı Kredi, Ziraat Bankası, Akbank, QNB, Halkbank, Vakıfbank, Şekerbank, Albaraka, Kuveyt Türk, vb.) tam ve net olarak analiz et.
3. Evrakta herhangi bir DENİZBANK (DenizBank, Deniz Bank, Denizbank A.Ş., denizbank.com, Denizbank logosu veya ibaresi) geçip geçmediğini KESİNLİKLE tespit et.

Türk banka çeklerinde Çek Seri Numarası şu alanlarda yer alır:
1. Sağ üst veya sol üst köşe: "SERİ NO:", "ÇEK NO:", "SERİ:", "NO:" etiketlerinin yanında veya kutu içinde (Genellikle 5-10 hanelidir, örn: 009632789, 0074125, 000142857, 9632789).
2. Çekin en altındaki manyetik CMC7 / MICR satırı: Özel manyetik semboller (⑈ veya |:) arasında çek seri numarası yer alır (örn: ⑈009632789⑈ veya |: 009632789 |:).
3. Sağdaki karekod (QR Kod) veya barkodun hemen üstünde/altında yazan seri numarası.
4. Çek yan, ters veya açılı çekilmiş olabilir. Çekin açısını zihinsel olarak düzelt ve numarayı eksiksiz oku.

ÇOK ÖNEMLİ KURAL:
Numaranın başındaki anlamsız '0' (sıfır) rakamlarını KESİNLİKLE kaldır. Sıfırlardan sonraki asıl rakamları tam ve eksiksiz ver.

DENİZBANK VE BANKA ADI TESPİTİ KURALI:
- Evrak üzerindeki banka adını (logo, başlık, antet veya metinden) "bankName" alanına yaz.
- Evrağın herhangi bir yerinde (banka adı, logo, şube adı, kaşe, metin, antet, filigran, IBAN, vb.) "DENİZBANK", "DENİZ BANK", "DENİZBANK A.Ş." veya DenizBank ibaresi/logosu geçiyorsa isDenizbank değerini true yap, geçmiyorsa false yap.

Hesap numarası veya IBAN ile karıştırma.
Çıktıyı SADECE aşağıdaki JSON formatında döndür:
{
  "checkNumber": "sıfırlardan sonraki saf rakamlar",
  "rawFound": "görseldeki orijinal numara metni",
  "bankName": "çekteki resmi banka adı",
  "isDenizbank": true veya false,
  "location": "numaranın tespit edildiği yer"
}`;

    let rawResult = '';
    
    // 1. Try gemini-3.8-flash
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: effectiveMime,
                  data: cleanBase64,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });
      rawResult = response.text || '';
    } catch (primaryErr: any) {
      console.warn('Primary model (gemini-3.8-flash) failed, trying fallback model (gemini-flash-latest):', primaryErr?.message || primaryErr);
      try {
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: effectiveMime,
                    data: cleanBase64,
                  },
                },
                {
                  text: prompt,
                },
              ],
            },
          ],
        });
        rawResult = fallbackResponse.text || '';
      } catch (fallbackErr: any) {
        console.warn('Fallback model failed as well:', fallbackErr?.message || fallbackErr);
        return res.json({
          success: false,
          checkNumber: '',
          message: 'Çek seri numarası görüntüden otomatik okunamadı.',
        });
      }
    }

    let checkNumber = '';
    let rawFound = '';
    let bankName = '';
    let location = '';
    let isDenizbank = false;

    try {
      const cleanJsonStr = rawResult.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);
      if (parsed.checkNumber) {
        checkNumber = String(parsed.checkNumber).trim();
      }
      if (!checkNumber && parsed.rawFound) {
        checkNumber = String(parsed.rawFound).trim();
      }
      rawFound = parsed.rawFound ? String(parsed.rawFound).trim() : '';
      bankName = parsed.bankName ? String(parsed.bankName).trim() : '';
      location = parsed.location ? String(parsed.location).trim() : '';
      if (parsed.isDenizbank === true || parsed.isDenizbank === 'true') {
        isDenizbank = true;
      } else {
        isDenizbank = false;
      }
    } catch {
      checkNumber = sanitizeCheckNumber(rawResult);
    }

    // DenizBank kontrolü: banka adı, konum veya tespit edilen metin içinde DenizBank geçiyor mu?
    if (
      !isDenizbank &&
      (/deniz\s*bank/i.test(bankName) ||
        /denizbank/i.test(bankName) ||
        /deniz\s*bank/i.test(rawFound) ||
        /denizbank/i.test(rawFound) ||
        /deniz\s*bank/i.test(location) ||
        /denizbank/i.test(location))
    ) {
      isDenizbank = true;
    }

    // Baştaki sıfırları temizle ve sadece rakamları al
    if (checkNumber) {
      const digitsOnly = checkNumber.replace(/\D/g, '');
      const stripped = digitsOnly.replace(/^0+/, '');
      checkNumber = stripped.length > 0 ? stripped : digitsOnly;
    }

    // Eğer JSON içinde çıkmadıysa rawResult içindeki rakamları dene
    if (!checkNumber) {
      checkNumber = sanitizeCheckNumber(rawResult);
    }

    if (checkNumber) {
      console.log(`[OCR Başarılı] Çek Seri No: "${checkNumber}" (Orijinal: "${rawFound}", Banka: "${bankName}", DenizBank: ${isDenizbank})`);
      return res.json({
        success: true,
        checkNumber,
        rawFound,
        bankName,
        isDenizbank,
        location,
        raw: rawResult,
      });
    }

    return res.json({
      success: false,
      checkNumber: '',
      rawFound,
      bankName,
      isDenizbank,
      message: 'Çek seri numarası tespit edilemedi.',
    });
  } catch (error: any) {
    console.warn('Error extracting check number with Gemini:', error?.message || error);
    return res.json({
      success: false,
      checkNumber: '',
      message: 'Çek numarası otomatik okunamadı, lütfen elle giriniz.',
    });
  }
});

// Vite middlewares for dev or static serving for production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
