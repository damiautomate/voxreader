// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB_MDJI9uuHD830TX2g1USUkz_eYEsNIws",
  authDomain: "ltn-voxreader.firebaseapp.com",
  projectId: "ltn-voxreader",
  storageBucket: "ltn-voxreader.firebasestorage.app",
  messagingSenderId: "724433245504",
  appId: "1:724433245504:web:3ca4c80ec6dd938fd456a5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
