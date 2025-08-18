import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  "projectId": "roleplay-nvrtl",
  "appId": "1:922547464617:web:98be7ff915ea60b29ffcb8",
  "storageBucket": "roleplay-nvrtl.appspot.com", // IMPORTANT: Replace with your actual bucket name if different
  "apiKey": "AIzaSyAKAzFfQnKSicH4jcuC3uSxErzAqJcrhn0",
  "authDomain": "roleplay-nvrtl.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "922547464617"
};

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
