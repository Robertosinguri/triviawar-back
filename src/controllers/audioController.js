const path = require('path');
const fs = require('fs');

/**
 * Controlador para servir archivos de audio como API
 */
exports.getAudio = (req, res) => {
  const { filename } = req.params;
  
  // Validar nombre de archivo (seguridad básica)
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ 
      success: false, 
      error: 'Nombre de archivo inválido' 
    });
  }

  // Ruta al archivo de audio (desde src/controllers -> ../public/audio)
  const audioPath = path.join(__dirname, '../../public/audio', filename);
  
  // Verificar que el archivo existe
  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ 
      success: false, 
      error: 'Archivo de audio no encontrado',
      filename: filename
    });
  }

  // Determinar Content-Type basado en extensión
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  
  if (ext === '.wav') {
    contentType = 'audio/wav';
  } else if (ext === '.mp3') {
    contentType = 'audio/mpeg';
  }
  
  // Establecer headers para audio
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache de 1 día
  
  // Servir el archivo
  res.sendFile(audioPath, (err) => {
    if (err) {
      console.error('❌ Error al servir archivo de audio:', err);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: 'Error interno al servir el archivo de audio' 
        });
      }
    }
  });
};

/**
 * Listar archivos de audio disponibles
 */
exports.listAudioFiles = (req, res) => {
  const audioDir = path.join(__dirname, '../../public/audio');
  
  try {
    const files = fs.readdirSync(audioDir)
      .filter(file => file.endsWith('.wav') || file.endsWith('.mp3'))
      .map(file => ({
        filename: file,
        url: `/api/audio/${file}`,
        size: fs.statSync(path.join(audioDir, file)).size,
        type: path.extname(file).toLowerCase() === '.wav' ? 'audio/wav' : 'audio/mpeg'
      }));
    
    res.json({
      success: true,
      files: files,
      count: files.length
    });
  } catch (error) {
    console.error('❌ Error al listar archivos de audio:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error al listar archivos de audio' 
    });
  }
};
