import 'dotenv/config';
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
      
      const response = await payment.create({ body });
      res.status(201).json({
        status: response.status,
        status_detail: response.status_detail,
        id: response.id
      });
    } catch (error) {
      console.error("Payment error:", error);
      res.status(500).json({ error: "Failed to process payment" });
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
        const paymentData = await payment.get({ id: paymentId });
        
        const newStatus = paymentData.status;
        
        // Find the contribution in Firestore with this paymentId
        const contributionsRef = db.collection('contributions');
        const snapshot = await contributionsRef.where('paymentId', '==', String(paymentId)).get();
        
        if (!snapshot.empty) {
          const batch = db.batch();
          snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { status: newStatus });
          });
          await batch.commit();
          console.log(`Updated payment ${paymentId} to status ${newStatus}`);
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
