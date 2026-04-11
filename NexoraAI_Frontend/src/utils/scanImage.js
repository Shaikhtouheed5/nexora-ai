/**
 * scanImage.js — Image scan utility
 *
 * Flow: Image URI → compress to 800px JPEG → FileSystem base64 → backend /scan/image → result
 * Google Vision API key stays on backend. Never exposed to frontend.
 */

import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiCall } from './api';

export const scanImage = async (uri) => {
  try {
    // Step 1: Compress image to reduce upload size
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Step 2: Read as base64
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64 || base64.length < 100) {
      throw new Error('Invalid image data — file may be empty or unreadable');
    }

    console.log('📦 Base64 length:', base64.length);

    // Step 3: Send to backend — backend calls Google Vision, returns extracted text + scan verdict
    const result = await apiCall('/scan/image', 'POST', { image: base64 });

    console.log('✅ OCR Text:', result?.extracted_text?.slice(0, 100));

    return result;

  } catch (err) {
    console.error('❌ Scan Error:', err.message);
    throw err;
  }
};
