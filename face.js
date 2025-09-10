import fetch from 'node-fetch';
import { loadImage, Canvas, Image, ImageData } from 'canvas';
import * as faceapi from 'face-api.js';

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

export async function getFaceDescriptorFromURL(url) {
    try {
        // Cargar modelos si no están cargados
        await faceapi.nets.ssdMobilenetv1.loadFromDisk('./models/ssd_mobilenetv1');
        await faceapi.nets.faceLandmark68Net.loadFromDisk('./models/face_landmark_68');
        await faceapi.nets.faceRecognitionNet.loadFromDisk('./models/face_recognition_model');

        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudo descargar la imagen');
        
        const buffer = await response.arrayBuffer();
        const image = await loadImage(Buffer.from(buffer));

        const detection = await faceapi
            .detectSingleFace(image)
            .withFaceLandmarks()
            .withFaceDescriptor();

        if (!detection) {
            console.log('No se detectó ninguna cara');
            return null;
        }

        return detection.descriptor;
    } catch (err) {
        console.error('Error en getFaceDescriptorFromURL:', err.message);
        return null;
    }
}
