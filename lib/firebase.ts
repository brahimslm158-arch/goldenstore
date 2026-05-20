let app: any = null;
let db: any = null;

function normalizePrivateKey(raw: string): string {
  let key = raw;
  // 1) If the value is base64-encoded PEM (a common Vercel-friendly form), decode it.
  if (!key.includes('BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(key.trim())) {
    try {
      const decoded = Buffer.from(key.trim(), 'base64').toString('utf8');
      if (decoded.includes('BEGIN') && decoded.includes('PRIVATE KEY')) key = decoded;
    } catch {}
  }
  // 2) Strip surrounding single or double quotes that some UIs preserve when pasted.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // 3) Convert escaped \n / \r\n sequences into real line breaks.
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r/g, '');
  // 4) Trim leading/trailing whitespace but preserve internal newlines.
  key = key.trim();
  // 5) Ensure final newline (OpenSSL parsers expect it).
  if (!key.endsWith('\n')) key += '\n';
  return key;
}

function getCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY_BASE64 || process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      'Firebase credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (or FIREBASE_PRIVATE_KEY_BASE64).',
    );
  }
  const privateKey = normalizePrivateKey(rawKey);
  if (!privateKey.includes('BEGIN') || !privateKey.includes('PRIVATE KEY')) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY is malformed. Paste the full PEM key including the BEGIN/END markers, or set FIREBASE_PRIVATE_KEY_BASE64 to the base64-encoded PEM.',
    );
  }
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
