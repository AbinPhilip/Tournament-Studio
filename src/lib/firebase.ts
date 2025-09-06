
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  "projectId": "roleplay-nvrtl",
  "appId": "1:922547464617:web:98be7ff915ea60b29ffcb8",
  "storageBucket": "roleplay-nvrtl.firebasestorage.app",
  "apiKey": "AIzaSyAKAzFfQnKSicH4jcuC3uSxErzAqJcrhn0",
  "authDomain": "roleplay-nvrtl.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "922547464617"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
