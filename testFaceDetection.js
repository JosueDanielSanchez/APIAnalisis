const path = require('path');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData, loadImage } = canvas;
import '@tensorflow/tfjs';

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, 'models');

async function testFaceDetection() {
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

  const imgPath = path.join(__dirname, 'test.jpg'); // pon aquí tu foto de prueba
  const img = await loadImage(imgPath);

  const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

  if (detection) {
    console.log('✅ Rostro detectado correctamente');
    console.log('Descriptor:', detection.descriptor.slice(0, 5), '...');
  } else {
    console.log('❌ No se detectó rostro');
  }
}

testFaceDetection();
