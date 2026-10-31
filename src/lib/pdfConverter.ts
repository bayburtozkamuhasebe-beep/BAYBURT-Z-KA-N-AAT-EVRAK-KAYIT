import { jsPDF } from 'jspdf';

/**
 * Converts a Blob, File, or Image Data URL into a high-quality PDF File.
 */
export async function convertImageToPdf(
  imageSource: Blob | File | string,
  pdfFileName: string = 'cek_belgesi.pdf'
): Promise<{ pdfFile: File; pdfBlob: Blob; previewUrl: string }> {
  const dataUrl = await getImageDataUrl(imageSource);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Görsel PDF formatına dönüştürülürken okunamadı.'));
    img.src = dataUrl;
  });

  const imgWidth = img.naturalWidth || img.width || 1920;
  const imgHeight = img.naturalHeight || img.height || 1080;
  const aspectRatio = imgWidth / imgHeight;

  // Sizing in mm: standard 210mm width with precise proportional height
  const pdfWidthMm = 210;
  const pdfHeightMm = pdfWidthMm / aspectRatio;
  const isLandscape = aspectRatio >= 1;

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [pdfWidthMm, pdfHeightMm],
    compress: true,
  });

  // Add the scanned/captured image filling the entire page
  pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm, undefined, 'FAST');

  const pdfBlob = pdf.output('blob');
  const cleanFileName = pdfFileName.toLowerCase().endsWith('.pdf')
    ? pdfFileName
    : `${pdfFileName.replace(/\.[^/.]+$/, '')}.pdf`;

  const pdfFile = new File([pdfBlob], cleanFileName, { type: 'application/pdf' });
  const previewUrl = URL.createObjectURL(pdfBlob);

  return { pdfFile, pdfBlob, previewUrl };
}

/**
 * Helper to get Data URL from Blob, File, or String
 */
function getImageDataUrl(source: Blob | File | string): Promise<string> {
  if (typeof source === 'string') {
    if (source.startsWith('data:')) {
      return Promise.resolve(source);
    }
    // If it's a blob url or external url, fetch and convert
    return fetch(source)
      .then((res) => res.blob())
      .then(blobToDataUrl);
  }
  return blobToDataUrl(source);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
