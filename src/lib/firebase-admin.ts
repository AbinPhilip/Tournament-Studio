
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

let adminApp: App;

if (!getApps().length) {
    try {
        const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
        
        if (serviceAccountEnv) {
            console.log("Initializing Firebase Admin with service account from environment variable.");
            const serviceAccount = JSON.parse(serviceAccountEnv);
            adminApp = initializeApp({
                credential: cert(serviceAccount)
            });
        } else {
            console.log("Initializing Firebase Admin with Application Default Credentials.");
            // This will use Application Default Credentials on App Hosting.
            adminApp = initializeApp();
        }
        console.log("Firebase Admin SDK initialized successfully.");
    } catch (error: any) {
        console.error("CRITICAL: Firebase Admin SDK initialization failed.", {
            errorMessage: error.message,
            errorCode: error.code,
            stack: error.stack,
            hasServiceAccountEnv: !!process.env.FIREBASE_SERVICE_ACCOUNT,
        });
        // In a production environment, you might handle this more gracefully.
        // For now, we throw to prevent the app from running in a broken state.
        throw new Error(`Failed to initialize Firebase Admin SDK. Check server logs for details. Error: ${error.message}`);
    }
} else {
    adminApp = getApps()[0];
}

const adminDb = getFirestore(adminApp);

export { adminDb, Timestamp };
