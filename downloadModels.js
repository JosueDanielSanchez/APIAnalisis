const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const MODEL_URL = 'https://github.com/justadudewhohacks/face-api.js-models/raw/master';

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

async function downloadModels() {
  for (const [modelName, files] of Object.entries(models)) {
    const dir = path.join('./models', modelName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    for (const file of files) {
      const filePath = path.join(dir, file);
      if (!fs.existsSync(filePath)) {
        console.log(`Downloading ${file}...`);
        const res = await fetch(`${MODEL_URL}/${file}`);
        if (!res.ok) throw new Error(`Failed to download ${file}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
      }
    }
  }
}

module.exports = { downloadModels };
