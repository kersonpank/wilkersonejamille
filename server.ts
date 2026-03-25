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

// --- Product data extraction helpers ---

function normalizePrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  let s = raw.replace(/R\$\s*/g, '').replace(/\s/g, '').trim();
  // Remove non-numeric except comma and dot
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return null;
  // Brazilian format: 1.299,90
  if (/^\d{1,3}(\.\d{3})*(,\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  // US/plain format with comma as thousands separator: 1,299.90
  else if (/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  // Plain comma as decimal: 1299,90
  else {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function extractWithCheerio($: cheerio.CheerioAPI, url: string): { title: string; price: number | null; description: string; imageUrl: string } {
  let title = '';
  let price: number | null = null;
  let description = '';
  let imageUrl = '';

  // 1. JSON-LD structured data (most reliable on modern e-commerce)
  $('script[type="application/ld+json"]').each((_, el) => {
    if (title && price !== null && description && imageUrl) return false as any;
    try {
      const raw = $(el).html() || '';
      const data = JSON.parse(raw);
      const items: any[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        let product: any = null;
        if (item['@type'] === 'Product') product = item;
        else if (Array.isArray(item['@type']) && item['@type'].includes('Product')) product = item;
        else if (Array.isArray(item['@graph'])) product = item['@graph'].find((n: any) => n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product')));
        if (!product) continue;
        if (!title && product.name) title = String(product.name).trim();
        if (!description && product.description) description = String(product.description).trim().slice(0, 300);
        if (!imageUrl) {
          const img = Array.isArray(product.image) ? product.image[0] : product.image;
          if (typeof img === 'string') imageUrl = img;
          else if (img && typeof img === 'object' && img.url) imageUrl = String(img.url);
        }
        if (price === null && product.offers) {
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          if (offer?.price != null) price = normalizePrice(String(offer.price));
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  });

  // 2. OpenGraph tags
  if (!title) title = ($('meta[property="og:title"]').attr('content') || '').trim();
  if (!description) description = ($('meta[property="og:description"]').attr('content') || '').trim().slice(0, 300);
  if (!imageUrl) imageUrl = $('meta[property="og:image"]').attr('content') || '';
  if (price === null) price = normalizePrice($('meta[property="og:price:amount"]').attr('content'));

  // 3. Twitter Card tags
  if (!title) title = ($('meta[name="twitter:title"]').attr('content') || '').trim();
  if (!description) description = ($('meta[name="twitter:description"]').attr('content') || '').trim().slice(0, 300);
  if (!imageUrl) imageUrl = $('meta[name="twitter:image"]').attr('content') || '';

  // 4. Schema.org microdata
  if (!title) title = ($('[itemprop="name"]').first().attr('content') || $('[itemprop="name"]').first().text()).trim();
  if (!description) description = ($('[itemprop="description"]').first().attr('content') || $('[itemprop="description"]').first().text()).trim().slice(0, 300);
  if (!imageUrl) imageUrl = $('[itemprop="image"]').first().attr('content') || $('[itemprop="image"]').first().attr('src') || '';
  if (price === null) {
    const priceEl = $('[itemprop="price"]').first();
    price = normalizePrice(priceEl.attr('content') || priceEl.text());
  }

  // 5. Marketplace-specific selectors

  // Mercado Livre
  if (!title) title = $('h1.ui-pdp-title').text().trim();
  if (price === null) {
    const frac = $('.andes-money-amount__fraction').first().text().replace(/\./g, '');
    const cents = $('.andes-money-amount__cents').first().text();
    if (frac) price = normalizePrice(cents ? `${frac},${cents}` : frac);
  }
  if (!description) description = $('.ui-pdp-description__content').first().text().trim().slice(0, 300);
  if (!imageUrl) imageUrl = $('.ui-pdp-gallery__figure__image').attr('src') || $('.ui-pdp-image.ui-pdp-gallery__figure__image').attr('src') || '';

  // Amazon BR
  if (!title) title = $('#productTitle').text().trim();
  if (price === null) {
    const whole = $('.a-price-whole').first().text().replace(/[^\d]/g, '');
    const fraction = $('.a-price-fraction').first().text().replace(/[^\d]/g, '');
    if (whole) price = normalizePrice(fraction ? `${whole},${fraction}` : whole);
  }
  if (!description) description = $('#feature-bullets li span.a-list-item').slice(0, 3).map((_, el) => $(el).text().trim()).get().join(' ').slice(0, 300);
  if (!imageUrl) imageUrl = $('#landingImage').attr('src') || $('#imgBlkFront').attr('src') || '';

  // Magazine Luiza
  if (!title) title = $('h1[class*="Header__Name"], h1[class*="header__Name"]').first().text().trim();
  if (price === null) price = normalizePrice($('[class*="price__SalePrice"], [class*="Price__SalePrice"]').first().text());
  if (!description) description = $('[class*="description__Text"], [class*="Description__Text"]').first().text().trim().slice(0, 300);
  if (!imageUrl) imageUrl = $('img[data-testid="image-default"]').attr('src') || '';

  // Shopee BR
  if (!title) title = ($('._44qnta').first().text() || $('[class*="product-briefing"] h1').first().text()).trim();
  if (price === null) price = normalizePrice($('._3n5NQx, [class*="priceSectionHeader"]').first().text());

  // Americanas / Submarino / B2W
  if (!title) title = ($('h1[class*="product-title"]').first().text() || $('[data-testid="product-name"]').first().text()).trim();
  if (price === null) price = normalizePrice($('[data-testid="price"], [class*="sales-price"]').first().text());

  // 6. <title> tag fallback (strip " | Site Name" suffix)
  if (!title) {
    const pageTitle = $('title').text().trim();
    if (pageTitle) title = pageTitle.split(/\s*[|\-–—]\s*/)[0].trim();
  }

  // 7. Image fallback: any large image
  if (!imageUrl) {
    for (const img of $('img').toArray()) {
      const src = $(img).attr('src');
      const w = parseInt($(img).attr('width') || '0', 10);
      const h = parseInt($(img).attr('height') || '0', 10);
      if (src && w > 200 && h > 200) { imageUrl = src; break; }
    }
  }

  // Ensure absolute image URL
  if (imageUrl && !imageUrl.startsWith('http')) {
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else {
      try {
        const urlObj = new URL(url);
        imageUrl = urlObj.origin + (imageUrl.startsWith('/') ? '' : '/') + imageUrl;
      } catch { imageUrl = ''; }
    }
  }

  return { title, price, description, imageUrl };
}

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
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.5",
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Layer 1: free HTML scraping
      let { title, price, description, imageUrl } = extractWithCheerio($, url);

      // Layer 2: Gemini fallback — only when essential fields are missing
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey && (!title || price === null)) {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const prompt = `Você é um extrator de dados de produtos. Extraia informações do seguinte HTML de página de e-commerce.
Dados já extraídos: title="${title}", price="${price ?? ''}", description="${description}", imageUrl="${imageUrl}"
Preencha APENAS os campos que estão vazios ou nulos. Não modifique campos que já têm valor.
Retorne JSON com: title (string), price (número em BRL, ex: 1299.90), description (string, máx 200 chars), imageUrl (URL absoluta ou string vazia).
NÃO invente URLs de imagem. Se não encontrar URL real, retorne "".

HTML (truncado):
${html.slice(0, 100000)}`;

          const aiResponse = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: { responseMimeType: 'application/json' },
          });

          const aiData = JSON.parse(aiResponse.text || '{}');
          if (!title && aiData.title) title = String(aiData.title).trim();
          if (price === null && aiData.price != null) price = parseFloat(String(aiData.price)) || null;
          if (!description && aiData.description) description = String(aiData.description).trim().slice(0, 300);
          if (!imageUrl && aiData.imageUrl) imageUrl = String(aiData.imageUrl).trim();
        } catch (geminiError) {
          console.error('Gemini fallback error (non-fatal):', geminiError);
        }
      }

      res.json({
        title: title || '',
        price: price ?? null,
        description: description || '',
        imageUrl: imageUrl || '',
      });
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
