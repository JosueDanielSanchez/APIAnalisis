import fetch from 'node-fetch';
import { loadImage } from 'canvas';
import * as faceapi from 'face-api.js';

// Función para descargar imagen desde Supabase y obtener el descriptor facial
export async function getFaceDescriptorFromURL(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('No se pudo descargar la imagen');
        
        const buffer = await response.arrayBuffer();
        const image = await loadImage(Buffer.from(buffer));

        // 👇 Aquí va tu código de detección y extracción de descriptor
        const detection = await faceapi
            .detectSingleFace(image)
            .withFaceLandmarks()
            .withFaceDescriptor();

        // Si encontró una cara devuelve el descriptor, si no, null
        return detection ? detection.descriptor : null;
    } catch (err) {
        console.error('Error en getFaceDescriptorFromURL:', err.message);
        return null;
    }
}
