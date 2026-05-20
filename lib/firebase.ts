let app: any = null;
let db: any = null;

function getCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY',
    );
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  return { projectId, clientEmail, privateKey };
}

export async function firebaseApp() {
  if (app) return app;
  const { cert, getApps, initializeApp } = await import('firebase-admin/app');
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }
  const creds = getCredentials();
  app = initializeApp({
    credential: cert({
      projectId: creds.projectId,
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey,
    }),
    projectId: creds.projectId,
  });
  return app;
}

export async function firestore() {
  if (db) return db;
  const { getFirestore } = await import('firebase-admin/firestore');
  const fbApp = await firebaseApp();
  db = getFirestore(fbApp);
  db.settings({ ignoreUndefinedProperties: true, preferRest: true });
  return db;
}

export async function getFieldValue() {
  const { FieldValue } = await import('firebase-admin/firestore');
  return FieldValue;
}
