/**
 * scanImage.js — Image OCR utility
 *
 * Flow: Image URI → compress to 800px JPEG → FileSystem base64 → POST /api/scan-image
 *       → backend calls Google Vision → returns { text: string }
 *
 * Google Vision API key stays on backend. Never exposed to frontend.
 * Caller is responsible for taking the returned text and running it through the scan API.
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiCall } from './api';

/**
 * Extracts text from an image via the backend OCR endpoint.
 * @param {string} uri - Local image URI from ImagePicker
 * @returns {Promise<string>} Extracted text from the image
 */
export const scanImage = async (uri) => {
  try {
    // Step 1: Compress image to reduce upload size
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    console.log('🗜️ Compressed URI:', compressed.uri);

    // Step 2: Read as base64
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length < 100) {
      throw new Error('Invalid image data — file may be empty or unreadable');
    }
    console.log('📦 Base64 length:', base64.length);

    // Step 3: POST to backend — backend calls Google Vision
    console.log('🌐 Calling backend scan...');
    const result = await apiCall('/api/scan-image', 'POST', { image: base64 });

    const text = result.text ?? '';
    console.log('✅ OCR Text:', text.slice(0, 100));

    return text;

  } catch (err) {
    console.error('❌ Scan Error:', err.message);
    throw err;
  }
};
