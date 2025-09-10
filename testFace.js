import path from 'path';
import fs from 'fs';
import canvas from 'canvas';
import * as faceapi from 'face-api.js';
import '@tensorflow/tfjs-node'; // Node backend

const { Canvas, Image, ImageData, loadImage } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH = path.join('.', 'models'); // carpeta donde están tus modelos

async function main() {
  try {
    console.log('📂 Cargando modelos...');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(path.join(MODEL_PATH, 'ssd_mobilenetv1'));
    await faceapi.nets.faceLandmark68Net.loadFromDisk(path.join(MODEL_PATH, 'face_landmark_68'));
    await faceapi.nets.faceRecognitionNet.loadFromDisk(path.join(MODEL_PATH, 'face_recognition'));
    console.log('✅ Modelos cargados');

    // Carga una imagen de prueba
    const imgPath = path.join('.', 'uploads', 'test.jpg'); // asegúrate de tener una imagen
    if (!fs.existsSync(imgPath)) {
      console.log('❌ Coloca una imagen de prueba llamada test.jpg en la carpeta uploads');
      return;
    }

    const img = await loadImage(imgPath);

    // Detectar rostro y obtener descriptor
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    if (!detection) {
      console.log('❌ No se detectó rostro en la imagen');
      return;
    }

    console.log('✅ Rostro detectado');
    console.log('Descriptor (primeros 5 valores):', detection.descriptor.slice(0, 5));
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();
