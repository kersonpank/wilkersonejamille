import 'dotenv/config';
import { randomUUID } from 'crypto';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as cheerio from "cheerio";
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));

let adminApp;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
  );
  adminApp = initializeApp({ credential: cert(serviceAccount), projectId: firebaseConfig.projectId });
} else {
  // Fallback para Application Default Credentials (Google Cloud Run / AI Studio)
  adminApp = initializeApp({ projectId: firebaseConfig.projectId });
}
const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

// Initialize Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN! });

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/process_payment", async (req, res) => {
    try {
      const payment = new Payment(client);
      const body = {
        ...req.body,
        description: 'Presente de Casamento - Wilkerson & Jamille',
        notification_url: `${process.env.APP_URL}/api/webhook/mercadopago`,
      };
      
      const response = await payment.create({
        body,
        requestOptions: { idempotencyKey: randomUUID() },
      });
      res.status(201).json({
        status: response.status,
        status_detail: response.status_detail,
        id: response.id,
        net_received_amount: response.transaction_details?.net_received_amount ?? null,
      });
    } catch (error: any) {
      console.error("Payment error:", JSON.stringify(error?.cause || error?.message || error, null, 2));
      const causes = error?.cause;
      const detail = Array.isArray(causes) ? causes : causes ? [causes] : [];
      res.status(500).json({
        error: "Falha ao processar pagamento",
        detail: detail.length > 0 ? detail : (error?.message || 'Erro desconhecido'),
      });
    }
  });

  app.post("/api/webhook/mercadopago", async (req, res) => {
    try {
      const { action, data } = req.body;
      
      // We only care about payment updates
      if (action === "payment.created" || action === "payment.updated") {
        const paymentId = data.id;

        // Fetch the latest payment status from Mercado Pago
        const payment = new Payment(client);
        let paymentData;
        try {
          paymentData = await payment.get({ id: paymentId });
        } catch (mpError: any) {
          // Payment not found (e.g. test simulation with fake ID) — acknowledge and ignore
          console.log(`Payment ${paymentId} not found in MP API (possibly a test simulation): ${mpError?.message}`);
          res.status(200).send("OK");
          return;
        }

        const newStatus = paymentData.status;
        const netAmount = paymentData.transaction_details?.net_received_amount ?? null;

        // Find the contribution in Firestore with this paymentId
        const contributionsRef = db.collection('contributions');
        const snapshot = await contributionsRef.where('paymentId', '==', String(paymentId)).get();

        if (!snapshot.empty) {
          const batch = db.batch();

          // Update contribution status and net amount
          snapshot.docs.forEach(doc => {
            const update: Record<string, any> = { status: newStatus };
            if (netAmount !== null) update.netAmount = netAmount;
            batch.update(doc.ref, update);
          });

          // When approved, mark each gift as 'gifted'
          if (newStatus === 'approved') {
            const giftIds = [...new Set(snapshot.docs.map(doc => doc.data().giftId as string))];
            for (const giftId of giftIds) {
              const giftRef = db.collection('gifts').doc(giftId);
              batch.update(giftRef, { status: 'gifted' });
            }
            console.log(`Marked gifts as gifted: ${giftIds.join(', ')}`);
          }

          await batch.commit();
          console.log(`Updated payment ${paymentId} to status ${newStatus}`);

          // Send external notification webhook when payment is approved
          if (newStatus === 'approved') {
            try {
              const settingsDoc = await db.collection('settings').doc('notifications').get();
              const notifyUrl = settingsDoc.data()?.webhookUrl as string | undefined;
              if (notifyUrl) {
                const guestName = snapshot.docs[0]?.data().guestName ?? '';
                const giftIds = [...new Set(snapshot.docs.map(d => d.data().giftId as string))];
                const giftTitles = await Promise.all(
                  giftIds.map(async id => {
                    const gDoc = await db.collection('gifts').doc(id).get();
                    return (gDoc.data()?.title as string) ?? id;
                  })
                );
                await fetch(notifyUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    event: 'payment.approved',
                    paymentId: String(paymentId),
                    guestName,
                    amount: snapshot.docs[0]?.data().amount ?? 0,
                    netAmount,
                    gifts: giftTitles,
                    timestamp: new Date().toISOString(),
                  }),
                });
                console.log(`Notification sent to ${notifyUrl}`);
              }
            } catch (notifyErr) {
              console.error('Notification webhook error:', notifyErr);
            }
          }
        } else {
          console.log(`Payment ${paymentId} not found in Firestore`);
        }
      }
      
      res.status(200).send("OK");
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).send("Webhook Error");
    }
  });

  app.post("/api/extract", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // 1. Check og:image
      let imageUrl = $('meta[property="og:image"]').attr("content");

      // 2. Check twitter:image
      if (!imageUrl) {
        imageUrl = $('meta[name="twitter:image"]').attr("content");
      }

      // 3. Check specific marketplace primary images
      if (!imageUrl) {
        // Amazon
        imageUrl = $("#landingImage").attr("src") || $("#imgBlkFront").attr("src");
      }
      if (!imageUrl) {
        // Mercado Livre
        imageUrl = $(".ui-pdp-gallery__figure__image").attr("src") || $(".ui-pdp-image.ui-pdp-gallery__figure__image").attr("src");
      }
      if (!imageUrl) {
        // Magalu
        imageUrl = $('img[data-testid="image-default"]').attr("src");
      }

      // 4. Fallback to any large image
      if (!imageUrl) {
        const images = $("img").toArray();
        for (const img of images) {
          const src = $(img).attr("src");
          const width = parseInt($(img).attr("width") || "0", 10);
          const height = parseInt($(img).attr("height") || "0", 10);
          if (src && width > 200 && height > 200) {
            imageUrl = src;
            break;
          }
        }
      }

      // Ensure absolute URL
      if (imageUrl && !imageUrl.startsWith("http")) {
        if (imageUrl.startsWith("//")) {
          imageUrl = "https:" + imageUrl;
        } else {
          const urlObj = new URL(url);
          imageUrl = urlObj.origin + (imageUrl.startsWith("/") ? "" : "/") + imageUrl;
        }
      }

      res.json({ imageUrl: imageUrl || "" });
    } catch (error) {
      console.error("Extraction error:", error);
      res.status(500).json({ error: "Failed to extract data" });
    }
  });

  // Image proxy — serves event image from our domain (WhatsApp/Facebook trust own-domain images more)
  app.get('/api/og-image/:slug', async (req, res) => {
    try {
      const snap = await db.collection('events').where('slug', '==', req.params.slug).limit(1).get();
      if (snap.empty) return res.status(404).end();
      const imageUrl = snap.docs[0].data().imageUrl as string;
      if (!imageUrl) return res.status(404).end();
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) return res.status(502).end();
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const buf = await imgRes.arrayBuffer();
      res.send(Buffer.from(buf));
    } catch { res.status(500).end(); }
  });

  // Social media bot OG tag injection — WhatsApp/Facebook bots don't execute JS
  const SOCIAL_BOTS = /WhatsApp|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|TelegramBot|Slackbot|Discordbot/i;
  app.get('/:slug', async (req, res, next) => {
    const { slug } = req.params;
    if (['presentes', 'admin'].includes(slug) || slug.startsWith('api')) return next();
    const ua = req.headers['user-agent'] || '';
    if (!SOCIAL_BOTS.test(ua)) return next();
    try {
      const snap = await db.collection('events').where('slug', '==', slug).limit(1).get();
      if (snap.empty) return next();
      const ev = snap.docs[0].data();
      const appUrl = process.env.APP_URL || `https://${req.headers.host}`;
      const pageUrl = `${appUrl}/${slug}`;
      const updatedAt = snap.docs[0].updateTime?.seconds ?? snap.docs[0].createTime?.seconds ?? 0;
      const imageUrl = `${appUrl}/api/og-image/${slug}?v=${updatedAt}`;
      const esc = (s: string) => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      // Build rich description with date, time and location
      const formatDate = (d: string) => {
        const [y,m,day] = d.split('-').map(Number);
        return new Date(y, m-1, day).toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' });
      };
      const description = ev.date
        ? `${formatDate(ev.date)} às ${ev.time}h · ${ev.location} · Confirme sua presença!`
        : ev.headline;
      res.send(`<!DOCTYPE html><html lang="pt-BR"><head>
<meta charset="UTF-8">
<title>${esc(ev.title)} — Wilkerson &amp; Jamille</title>
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:title" content="${esc(ev.title)} — Wilkerson &amp; Jamille">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(imageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ev.title)} — Wilkerson &amp; Jamille">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(imageUrl)}">
</head><body></body></html>`);
    } catch { next(); }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
