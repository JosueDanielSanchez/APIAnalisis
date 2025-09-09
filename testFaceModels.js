const path = require('path');
require('@tensorflow/tfjs-node');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, 'models');

async function test() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
    await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
    await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition'));
    console.log('✅ Modelos cargados correctamente');
  } catch (err) {
    console.error('❌ Error al cargar modelos:', err);
  }
}

test();
