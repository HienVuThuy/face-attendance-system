import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dest1 = path.join(__dirname, 'public', 'face-api.min.js');
const dest2 = path.join(__dirname, '..', 'js', 'face-api.min.js');

const urls = [
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/dist/face-api.min.js',
  'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
  'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js',
];

async function download() {
  console.log('--- ĐANG TẢI THƯ VIỆN face-api.min.js THẬT ---');
  for (const url of urls) {
    try {
      console.log(`Đang tải từ: ${url}...`);
      const res = await fetch(url);
      if (res.ok) {
        const text = await res.text();
        if (text.length > 50000) {
          fs.writeFileSync(dest1, text, 'utf-8');
          fs.writeFileSync(dest2, text, 'utf-8');
          console.log(`🎉 TẢI THÀNH CÔNG! Dung lượng: ${(text.length / 1024).toFixed(1)} KB`);
          console.log(`✓ Đã ghi vào: ${dest1}`);
          console.log(`✓ Đã ghi vào: ${dest2}`);
          return;
        }
      }
    } catch (err) {
      console.warn(`Lỗi từ ${url}: ${err.message}`);
    }
  }
  console.error('❌ Không thể tải face-api.min.js từ các nguồn!');
}

download();
