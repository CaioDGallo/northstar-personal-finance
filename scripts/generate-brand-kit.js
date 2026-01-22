#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = `${__dirname}/../public/brand-kit/exports`;

const sizes = [
  { name: 'favicon-16', size: 16, border: 1, fontSize: 4 },
  { name: 'favicon-32', size: 32, border: 2, fontSize: 7 },
  { name: 'icon-48', size: 48, border: 2, fontSize: 10 },
  { name: 'icon-96', size: 96, border: 3, fontSize: 20 },
  { name: 'icon-192', size: 192, border: 4, fontSize: 40 },
  { name: 'icon-512', size: 512, border: 8, fontSize: 106 },
];

const variants = [
  { name: 'light', bg: 'white', fg: 'black' },
  { name: 'dark', bg: 'black', fg: 'white' },
];

async function generateLogos() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const variant of variants) {
    for (const size of sizes) {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              background: transparent;
              display: flex;
              align-items: center;
              justify-content: center;
              width: ${size.size}px;
              height: ${size.size}px;
            }
            .logo {
              display: flex;
              align-items: center;
              justify-content: center;
              width: ${size.size}px;
              height: ${size.size}px;
              border: ${size.border}px solid ${variant.fg};
              background: ${variant.bg};
              font-family: 'JetBrains Mono', monospace;
              font-size: ${size.fontSize}px;
              font-weight: 700;
              color: ${variant.fg};
              line-height: 1;
            }
          </style>
        </head>
        <body>
          <div class="logo">FX$H</div>
        </body>
        </html>
      `;

      await page.setContent(html);
      await page.setViewportSize({ width: size.size, height: size.size });

      const filename = `${outputDir}/${size.name}-${variant.name}.png`;
      await page.screenshot({
        path: filename,
        omitBackground: false,
      });

      console.log(`Generated: ${filename}`);
    }
  }

  await browser.close();
}

mkdirSync(outputDir, { recursive: true });
generateLogos().catch(console.error);
