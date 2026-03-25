import express from 'express';
import crypto from 'crypto';
import path from 'path';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    console.log('Firebase Admin initialized successfully.');
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT not provided. Backend Firestore updates will use client-side fallback.');
  }
} catch (e) {
  console.error('Failed to initialize Firebase Admin:', e);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JazzCash Configuration
const JAZZCASH_MERCHANT_ID = process.env.JAZZCASH_MERCHANT_ID || '';
const JAZZCASH_PASSWORD = process.env.JAZZCASH_PASSWORD || '';
const JAZZCASH_INTEGRITY_SALT = process.env.JAZZCASH_INTEGRITY_SALT || '';
const JAZZCASH_URL = process.env.JAZZCASH_ENVIRONMENT === 'production' 
  ? 'https://payments.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/'
  : 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/';

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

  app.post('/api/jazzcash/checkout', (req, res) => {
    const { userId, email } = req.body;
    
    if (!JAZZCASH_MERCHANT_ID || !JAZZCASH_PASSWORD || !JAZZCASH_INTEGRITY_SALT) {
      return res.status(500).json({ error: 'JazzCash credentials not configured on server.' });
    }

    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const pp_TxnDateTime = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
    
    date.setHours(date.getHours() + 1);
    const pp_TxnExpiryDateTime = `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

    // Get the dynamic APP_URL or fallback to the host header
    const host = req.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const returnUrl = process.env.APP_URL 
      ? `${process.env.APP_URL}/api/jazzcash/callback`
      : `${protocol}://${host}/api/jazzcash/callback`;

    const data: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: JAZZCASH_MERCHANT_ID,
      pp_SubMerchantID: '',
      pp_Password: JAZZCASH_PASSWORD,
      pp_BankID: 'TBANK',
      pp_ProductID: 'RETL',
      pp_TxnRefNo: `T${Date.now()}`,
      pp_Amount: '99900', // 999.00 PKR
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime,
      pp_BillReference: `upgrade_${userId}`,
      pp_Description: 'Upgrade to Pro',
      pp_TxnExpiryDateTime,
      pp_ReturnURL: returnUrl,
      pp_SecureHash: '',
      ppmpf_1: userId, // Custom field to store userId
      ppmpf_2: email || '',
      ppmpf_3: '',
      ppmpf_4: '',
      ppmpf_5: ''
    };

    // Calculate Secure Hash
    const sortedKeys = Object.keys(data).filter(k => k !== 'pp_SecureHash' && data[k] !== '').sort();
    let hashString = JAZZCASH_INTEGRITY_SALT;
    for (const key of sortedKeys) {
      hashString += '&' + data[key];
    }
    
    data.pp_SecureHash = crypto.createHmac('sha256', JAZZCASH_INTEGRITY_SALT).update(hashString).digest('hex').toUpperCase();

    res.json({
      url: JAZZCASH_URL,
      data
    });
  });

  app.post('/api/jazzcash/callback', async (req, res) => {
    const data = req.body;
    
    // Verify hash
    const receivedHash = data.pp_SecureHash;
    const sortedKeys = Object.keys(data).filter(k => k !== 'pp_SecureHash' && data[k] !== '').sort();
    let hashString = JAZZCASH_INTEGRITY_SALT;
    for (const key of sortedKeys) {
      hashString += '&' + data[key];
    }
    const calculatedHash = crypto.createHmac('sha256', JAZZCASH_INTEGRITY_SALT).update(hashString).digest('hex').toUpperCase();

    if (calculatedHash === receivedHash && data.pp_ResponseCode === '000') {
      // Payment successful
      const userId = data.ppmpf_1;
      
      if (admin.apps.length > 0) {
        try {
          await admin.firestore().collection('users').doc(userId).update({
            subscriptionTier: 'pro',
            credits: 9999
          });
          res.redirect('/?payment=success');
        } catch (e) {
          console.error('Failed to update user in Firestore:', e);
          res.redirect('/?payment=error');
        }
      } else {
        // Fallback for demo if admin not configured
        res.redirect(`/?payment=success_demo&userId=${userId}`);
      }
    } else {
      // Payment failed
      console.error('JazzCash payment failed or hash mismatch', data);
      res.redirect('/?payment=failed');
    }
  });

// Setup Vite for local development or serve static files in production
async function setupVite() {
  if (process.env.VERCEL) {
    // On Vercel, static files are served by the edge network.
    // The serverless function only handles /api/* requests.
    app.use((req, res) => {
      res.status(404).json({ error: 'Not Found' });
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Only start the server if we're not running in a serverless environment (like Vercel)
if (!process.env.VERCEL) {
  setupVite().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  // On Vercel, we still need to setup the 404 handler
  setupVite();
}

export default app;
