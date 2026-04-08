/* generate-icons.js — run once with Node to produce all icon PNGs
   Usage: node generate-icons.js
   Requires: npm install canvas
   Outputs:  public/icons/icon-{size}.png for all required sizes
*/
const { createCanvas } = require('canvas');
const fs   = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT   = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const r      = size * 0.18; // corner radius

  // Background — deep blue gradient simulation (flat)
  ctx.fillStyle = '#1a3a8f';
  roundRect(ctx, 0, 0, size, size, r);
  ctx.fill();

  // Inner glow layer
  ctx.fillStyle = '#2563eb';
  roundRect(ctx, size * 0.04, size * 0.04, size * 0.92, size * 0.92, r * 0.85);
  ctx.fill();

  // Subtle highlight top strip
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, size * 0.04, size * 0.04, size * 0.92, size * 0.38, r * 0.85);
  ctx.fill();

  // "DTC" text
  const fontSize = size * 0.28;
  ctx.fillStyle  = '#ffffff';
  ctx.font       = `700 ${fontSize}px 'Arial', sans-serif`;
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('DTC', size / 2, size * 0.44);

  // Tagline "Digital Tools" for larger icons
  if (size >= 192) {
    const tagSize = size * 0.09;
    ctx.font      = `400 ${tagSize}px 'Arial', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fillText('DIGITAL TOOLS', size / 2, size * 0.64);
  }

  // Bottom accent bar
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(size * 0.2, size * 0.8, size * 0.6, size * 0.03);

  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

SIZES.forEach(size => {
  const buf  = drawIcon(size);
  const file = path.join(OUT, `icon-${size}.png`);
  fs.writeFileSync(file, buf);
  console.log(`  created icon-${size}.png`);
});

console.log('\nAll icons generated in', OUT);
