import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

let adminApp: App;

if (!getApps().length) {
    try {
        const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
            ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            : null;

        if (serviceAccount) {
            adminApp = initializeApp({
                credential: cert(serviceAccount)
            });
        } else {
            // This will use Application Default Credentials on App Hosting.
            adminApp = initializeApp();
        }
    } catch (error: any) {
        console.error("Firebase Admin SDK initialization error:", error);
        // Throwing the error here can help diagnose startup problems.
        // In a production environment, you might handle this more gracefully.
        throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
    }
} else {
    adminApp = getApps()[0];
}

const adminDb = getFirestore(adminApp);

export { adminDb, Timestamp };
