// src/services/tts.js
// Google Cloud TTS service
// In production, this should go through a Cloud Function to hide the API key
// For MVP, we call the API directly and store the key in Firestore (admin-set)

import { db, storage } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Get TTS API key from Firestore (set by admin in settings)
let cachedKey = null;
export async function getTTSKey() {
  if (cachedKey) return cachedKey;
  const snap = await getDoc(doc(db, 'app_settings', 'tts'));
  if (snap.exists()) {
    cachedKey = snap.data().apiKey;
    return cachedKey;
  }
  return null;
}

// Call Google Cloud TTS API
export async function synthesizeSpeech(text, voiceName = 'en-US-Neural2-D') {
  const apiKey = await getTTSKey();
  if (!apiKey) throw new Error('TTS API key not configured. Ask admin to set it in Settings.');

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: voiceName.slice(0, 5),
        name: voiceName
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || `TTS API error (${response.status})`);
  }

  const data = await response.json();
  
  // Convert base64 to blob
  const binary = atob(data.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: 'audio/mpeg' });
}

// Generate audio for a paragraph and upload to Firebase Storage
export async function generateAndUpload(text, bookId, chapterIdx, paragraphIdx, voiceName) {
  const blob = await synthesizeSpeech(text, voiceName);
  
  // Upload to Firebase Storage
  const path = `books/${bookId}/ch${chapterIdx}_p${paragraphIdx}.mp3`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  const downloadURL = await getDownloadURL(storageRef);
  
  // Get audio duration
  const duration = await getAudioDuration(downloadURL);
  
  return { url: downloadURL, duration, path };
}

// Get duration of an audio file
function getAudioDuration(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.addEventListener('loadedmetadata', () => resolve(audio.duration));
    audio.addEventListener('error', () => resolve(0));
  });
}

// Test if TTS key works
export async function testTTSKey(apiKey) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: 'Hello, VoxReader is working.' },
      voice: { languageCode: 'en-US', name: 'en-US-Neural2-D' },
      audioConfig: { audioEncoding: 'MP3' }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'API error');
  }

  const data = await response.json();
  const binary = atob(data.audioContent);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}
