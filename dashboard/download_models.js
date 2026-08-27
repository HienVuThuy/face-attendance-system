import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const modelsDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const sources = [
  'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights',
  'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
];

async function downloadFile(filename) {
  const dest = path.join(modelsDir, filename);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100) {
    console.log(`✓ Đã có sẵn: ${filename} (${fs.statSync(dest).size} bytes)`);
    return true;
  }

  for (const src of sources) {
    const url = `${src}/${filename}`;
    try {
      console.log(`Đang tải ${filename} từ ${src}...`);
      const res = await fetch(url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(dest, Buffer.from(buffer));
        console.log(`✓ Đã tải thành công: ${filename} (${buffer.byteLength} bytes)`);
        return true;
      }
    } catch (err) {
      console.warn(`Thất bại từ ${src}: ${err.message}`);
    }
  }
  return false;
}

async function main() {
  console.log('--- BẮT ĐẦU TẢI AI MODELS CHO FACE-API.JS (OFFLINE LOCAL) ---');
  let successCount = 0;
  for (const f of files) {
    const ok = await downloadFile(f);
    if (ok) successCount++;
  }
  console.log(`\nKết quả: Đã tải ${successCount}/${files.length} model files.`);
  if (successCount === files.length) {
    console.log('🎉 TOÀN BỘ AI MODELS ĐÃ ĐƯỢC LƯU CỤC BỘ TẠI dashboard/public/models/!');
  }
}

main();
