const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const avatarsDir = path.join(__dirname, 'public', 'avatares');

// Archivos a optimizar: todos los .png de avatares (01.png a 17.png)
const files = fs.readdirSync(avatarsDir).filter(f => /^\d+\.png$/.test(f));

async function optimize() {
  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const file of files) {
    const filePath = path.join(avatarsDir, file);
    const originalSize = fs.statSync(filePath).size;
    totalOriginal += originalSize;

    // Resize a 200px de ancho (suficiente para avatares circulares) y convertir a WebP
    const outputName = file.replace('.png', '.webp');
    const outputPath = path.join(avatarsDir, outputName);

    await sharp(filePath)
      .resize(200, 200, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toFile(outputPath);

    const optimizedSize = fs.statSync(outputPath).size;
    totalOptimized += optimizedSize;

    const reduction = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
    console.log(`${file}: ${(originalSize/1024).toFixed(0)}KB → ${(optimizedSize/1024).toFixed(0)}KB (${reduction}% reducción)`);
  }

  console.log('\n--- RESUMEN ---');
  console.log(`Total original: ${(totalOriginal/1024/1024).toFixed(2)}MB`);
  console.log(`Total optimizado: ${(totalOptimized/1024/1024).toFixed(2)}MB`);
  console.log(`Reducción total: ${((1 - totalOptimized/totalOriginal)*100).toFixed(1)}%`);
}

optimize().catch(console.error);
