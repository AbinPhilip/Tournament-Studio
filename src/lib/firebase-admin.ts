import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Check if the service account key is available in environment variables
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

let adminApp: App;

if (!getApps().length) {
    if (serviceAccount) {
      // Initialize with service account key (for local development or specific environments)
      adminApp = initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      // Initialize without credentials (relies on Application Default Credentials for GCP environments like App Hosting)
      adminApp = initializeApp();
    }
} else {
    adminApp = getApps()[0];
}


const adminDb = getFirestore(adminApp);

export { adminDb, Timestamp };
