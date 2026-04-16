#!/usr/bin/env node

/**
 * Script para verificar y solucionar conflictos de puertos
 * Uso: node scripts/check-port.js [puerto]
 */

const http = require('http');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const DEFAULT_PORT = 3000;
const PORT = parseInt(process.argv[2]) || DEFAULT_PORT;

/**
 * Verifica si un puerto está en uso
 */
async function checkPort(port) {
  return new Promise((resolve) => {
    const tester = http.createServer()
      .once('error', (err) => {
        resolve(err.code === 'EADDRINUSE');
      })
      .once('listening', () => {
        tester.close(() => resolve(false));
      })
      .listen(port);
  });
}

/**
 * Obtiene información del proceso que usa un puerto (Windows)
 */
async function getProcessInfo(port) {
  try {
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.trim().split('\n');
    
    const processes = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      return { pid, line };
    }).filter(p => p.pid && p.pid !== '0');
    
    return processes;
  } catch (error) {
    return [];
  }
}

/**
 * Obtiene el nombre del proceso por PID (Windows)
 */
async function getProcessName(pid) {
  try {
    const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}"`);
    const lines = stdout.trim().split('\n');
    if (lines.length > 2) {
      const parts = lines[2].trim().split(/\s+/);
      return parts[0]; // Nombre de la imagen
    }
    return `PID: ${pid}`;
  } catch (error) {
    return `PID: ${pid}`;
  }
}

/**
 * Mata un proceso por PID (Windows)
 */
async function killProcess(pid) {
  try {
    await execAsync(`taskkill /PID ${pid} /F`);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Encuentra puertos disponibles alternativos
 */
async function findAlternativePorts(startPort, count = 5) {
  const availablePorts = [];
  
  for (let i = 1; i <= count; i++) {
    const port = startPort + i;
    const inUse = await checkPort(port);
    
    if (!inUse) {
      availablePorts.push(port);
    }
  }
  
  return availablePorts;
}

/**
 * Muestra ayuda al usuario
 */
function showHelp() {
  console.log(`
🔧 HERRAMIENTA DE DIAGNÓSTICO DE PUERTOS - TRIVIA WAR
=====================================================

Uso:
  node scripts/check-port.js [puerto]

Ejemplos:
  node scripts/check-port.js          # Verifica puerto 3000
  node scripts/check-port.js 3001     # Verifica puerto 3001

Comandos útiles:
  netstat -ano | findstr :3000        # Ver procesos usando puerto 3000
  taskkill /PID <PID> /F              # Terminar proceso por PID
  set PORT=3001                       # Cambiar variable de entorno (Windows)
  export PORT=3001                    # Cambiar variable de entorno (Linux/Mac)
`);
}

/**
 * Función principal
 */
async function main() {
  console.log(`🔍 Verificando puerto ${PORT}...\n`);
  
  const isPortInUse = await checkPort(PORT);
  
  if (!isPortInUse) {
    console.log(`✅ Puerto ${PORT} está disponible.`);
    console.log(`   Puedes iniciar el servidor con: npm start\n`);
    return;
  }
  
  console.log(`❌ Puerto ${PORT} está en uso.\n`);
  
  // Obtener información del proceso
  const processes = await getProcessInfo(PORT);
  
  if (processes.length > 0) {
    console.log(`📋 Procesos usando el puerto ${PORT}:`);
    
    for (const proc of processes) {
      const name = await getProcessName(proc.pid);
      console.log(`   • ${name} (PID: ${proc.pid})`);
    }
    console.log('');
    
    // Mostrar opciones
    console.log(`💡 SOLUCIONES POSIBLES:`);
    console.log(`   1. Esperar a que el proceso termine`);
    console.log(`   2. Cambiar el puerto (ver opciones abajo)`);
    console.log(`   3. Terminar el proceso manualmente`);
    console.log('');
    
    // Mostrar comandos para terminar procesos
    console.log(`🛠️  COMANDOS PARA TERMINAR PROCESOS:`);
    for (const proc of processes) {
      console.log(`   taskkill /PID ${proc.pid} /F`);
    }
    console.log('');
  }
  
  // Buscar puertos alternativos
  console.log(`🔍 Buscando puertos alternativos disponibles...`);
  const alternativePorts = await findAlternativePorts(PORT, 10);
  
  if (alternativePorts.length > 0) {
    console.log(`✅ Puertos alternativos disponibles:`);
    alternativePorts.forEach(port => {
      console.log(`   • Puerto ${port}`);
    });
    console.log('');
    console.log(`🔄 Para usar un puerto alternativo:`);
    console.log(`   Windows: set PORT=${alternativePorts[0]} && npm start`);
    console.log(`   Linux/Mac: export PORT=${alternativePorts[0]} && npm start`);
    console.log(`   O modifica la variable PORT en el archivo .env`);
  } else {
    console.log(`⚠️  No se encontraron puertos alternativos disponibles cerca de ${PORT}.`);
    console.log(`   Considera revisar manualmente los puertos.`);
  }
  
  console.log(`\n📝 DOCUMENTACIÓN:`);
  console.log(`   El puerto por defecto es 3000, pero puedes cambiarlo:`);
  console.log(`   - Variable de entorno: PORT=3001`);
  console.log(`   - Archivo .env: PORT=3001`);
  console.log(`   - Línea de comandos: npm run dev -- --port=3001`);
}

// Ejecutar
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
} else {
  main().catch(console.error);
}