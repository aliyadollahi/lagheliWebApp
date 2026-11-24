// Client-side image compression helper (optimized for fast mobile uploads in Iran)

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export async function fileToCompressedDataUrl(file: File, maxDimension = 1280): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    throw new Error('فرمت فایل مجاز نیست. فقط JPG، PNG یا WebP پشتیبانی می‌شود.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('حجم فایل انتخاب‌شده بیش از ۱۲ مگابایت است.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خواندن فایل تصویر ناموفق بود.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('فایل انتخاب‌شده یک تصویر معتبر نیست.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('پردازش تصویر در مرورگر ممکن نیست.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const output = canvas.toDataURL('image/jpeg', 0.84);
        resolve(output);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
