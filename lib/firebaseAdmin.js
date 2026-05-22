import admin from 'firebase-admin';

const getFirebaseAdmin = () => {
  if (!admin.apps.length) {
    try {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY 
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined;

      if (!privateKey || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PROJECT_ID) {
        console.error("Missing Firebase environment variables!");
        // We don't throw yet, let the application handle the lack of 'db'
      } else {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
        console.log('Firebase Admin initialized successfully');
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
    }
  }
  return admin;
};

// Export a function to get the db to ensure it's called after initialization
export const getDb = () => {
  const fbAdmin = getFirebaseAdmin();
  return fbAdmin.apps.length ? fbAdmin.firestore() : null;
};

export { admin };
