// downloadModels.js
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

// ESM no tiene __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CDN funcional de los modelos
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

const models = {
  ssd_mobilenetv1: [
    'ssd_mobilenetv1_model-shard1',
    'ssd_mobilenetv1_model-shard2',
    'ssd_mobilenetv1_model-weights_manifest.json'
  ],
  face_landmark_68: [
    'face_landmark_68_model-shard1',
    'face_landmark_68_model-weights_manifest.json'
  ],
  face_recognition_model: [
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
    'face_recognition_model-weights_manifest.json'
  ]
};

async function downloadFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Error descargando ${url}: ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ ${filePath} descargado`);
}

export async function downloadModels() {
  for (const [modelName, files] of Object.entries(models)) {
    const dir = path.join(__dirname, 'models', modelName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (const file of files) {
      const filePath = path.join(dir, file);
      if (!fs.existsSync(filePath)) {
        console.log(`Descargando ${file}...`);
        const url = `${MODEL_URL}/${file}`;
        try {
          await downloadFile(url, filePath);
        } catch (err) {
          console.error(`❌ No se pudo descargar ${file}:`, err.message);
        }
      }
    }
  }
}

// Ejecutable directamente con node
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  downloadModels()
    .then(() => console.log('✅ Todos los modelos descargados'))
    .catch(console.error);
}

