const path = require('path');
import '@tensorflow/tfjs';
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, 'models');

async function test() {
  try {
    if (process.env.NODE_ENV === 'production') {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js/models';
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL + '/ssd_mobilenetv1');
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL + '/face_landmark_68');
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL + '/face_recognition');
      console.log('✅ Modelos cargados desde CDN (producción)');
    } else {
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
      await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
      await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition'));
      console.log('✅ Modelos cargados desde carpeta local');
    }
  } catch (err) {
    console.error('❌ Error al cargar modelos:', err);
  }
}

test();
