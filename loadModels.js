// loadModels.js
const path = require('path');
const faceapi = require('face-api.js');

async function loadModels() {
  try {
    if (process.env.NODE_ENV === 'production') {
      //  Railway -> cargar desde CDN
      const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
      console.log(' Cargando modelos desde CDN...');

      await faceapi.nets.ssdMobilenetv1.loadFromUri(`${MODEL_URL}/ssd_mobilenetv1_model-weights_manifest.json`);
      await faceapi.nets.faceLandmark68Net.loadFromUri(`${MODEL_URL}/face_landmark_68_model-weights_manifest.json`);
      await faceapi.nets.faceRecognitionNet.loadFromUri(`${MODEL_URL}/face_recognition_model-weights_manifest.json`);
    } else {
      //  Local -> cargar desde ./models
      const MODEL_PATH = path.join(__dirname, 'models');
      console.log(' Cargando modelos desde disco...');

      await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
      await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
      await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition'));
    }

    console.log(' Modelos cargados correctamente');
  } catch (error) {
    console.error(' Error al cargar los modelos:', error);
    throw error;
  }
}

module.exports = { loadModels };
