#!/usr/bin/env node

/**
 * FitTracker Build Script
 * Minifies JS/CSS files and prepares assets for production
 */

const fs = require('fs');
const path = require('path');

const wwwDir = path.join(__dirname, '..', 'www');
const isProduction = process.env.NODE_ENV === 'production';

console.log('[BUILD] FitTracker app builder started...');

// Files to optimize
const jsFiles = [
  'db.js',
  'api.js',
  'sw.js',
  'assets/ml/vision-service.js',
  'assets/ml/food-detector.js',
  'assets/ml/pose-analyzer.js',
  'assets/ml/progress-tracker.js'
];

const cssFiles = [];

// Minify JS files
jsFiles.forEach(file => {
  const filePath = path.join(wwwDir, file);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] File not found: ${file}`);
    return;
  }
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Simple minification (in production, use terser)
    if (isProduction) {
      // Remove comments
      content = content.replace(/\/\*[\s\S]*?\*\//g, '');
      content = content.replace(/\/\/.*$/gm, '');
      // Remove extra whitespace
      content = content.replace(/\s+/g, ' ');
      content = content.replace(/\s*([{}();,=[]{}:])\s*/g, '$1');
    }
    
    // Write file
    fs.writeFileSync(filePath, content, 'utf8');
    const sizeKB = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(2);
    console.log(`[OK] ${file} - ${sizeKB} KB`);
  } catch (err) {
    console.error(`[ERROR] Processing ${file}:`, err.message);
  }
});

// Verify critical files
console.log('\n[CHECK] Verifying critical files...');
const criticalFiles = [
  'index.html',
  'manifest.json',
  'db.js',
  'api.js',
  'sw.js',
  'assets/ml/vision-service.js',
  'assets/ml/food-detector.js',
  'assets/ml/pose-analyzer.js',
  'assets/ml/progress-tracker.js'
];

criticalFiles.forEach(file => {
  const filePath = path.join(wwwDir, file);
  if (fs.existsSync(filePath)) {
    const size = fs.statSync(filePath).size;
    console.log(`✓ ${file} (${(size / 1024).toFixed(2)} KB)`);
  } else {
    console.error(`✗ ${file} - MISSING!`);
  }
});

console.log('\n[BUILD] Build complete! App ready for deployment.');
console.log('[INFO] Next steps:');
console.log('  - Run: npm run build:android');
console.log('  - Or: npx cap sync && npx cap open android');
