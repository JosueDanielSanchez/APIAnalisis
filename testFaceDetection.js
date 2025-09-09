const path = require('path');
const fs = require('fs');
const faceapi = require('face-api.js');
const canvas = require('canvas');
const { Canvas, Image, ImageData, loadImage } = canvas;
require('@tensorflow/tfjs'); // ya usamos la versión pura

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join(__dirname, 'models');

async function testFaceDetection() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
  await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
  await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition'));

  const imgPath = path.join(__dirname, 'test.jpg'); // pon aquí tu foto de prueba
  const img = await loadImage(imgPath);

  const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

  if (detection) {
    console.log('✅ Rostro detectado correctamente');
    console.log('Descriptor:', detection.descriptor.slice(0, 5), '...'); // muestra solo los primeros 5 valores
  } else {
    console.log('❌ No se detectó rostro');
  }
}

testFaceDetection();
