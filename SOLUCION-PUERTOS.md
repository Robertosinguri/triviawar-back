# Solución de Conflictos de Puertos - Trivia War Backend

## Problema Común: `Error: listen EADDRINUSE: address already in use :::3000`

Este error ocurre cuando el puerto 3000 (o el puerto configurado) ya está siendo utilizado por otro proceso.

## Soluciones Rápidas

### Opción 1: Usar la herramienta de diagnóstico (Recomendado)

```bash
node scripts/check-port.js
```

Este script te mostrará:
- Si el puerto está en uso
- Qué proceso lo está usando
- Puertos alternativos disponibles
- Comandos para solucionar el problema

### Opción 2: Cambiar el puerto

**Windows:**
```bash
set PORT=3001
npm start
```

**Linux/Mac:**
```bash
export PORT=3001
npm start
```

**O modificar el archivo `.env`:**
```env
PORT=3001
```

### Opción 3: Terminar el proceso manualmente

1. Identificar el proceso:
```bash
netstat -ano | findstr :3000
```

2. Terminar el proceso (Windows):
```bash
taskkill /PID <NUMERO_PID> /F
```

Ejemplo:
```bash
taskkill /PID 12345 /F
```

## Solución Automática en el Código

El servidor ahora incluye manejo automático de conflictos de puertos:

1. **Verificación automática**: El servidor verifica si el puerto está disponible
2. **Puertos alternativos**: Si el puerto 3000 está en uso, prueba automáticamente 3001, 3002, etc.
3. **Mensajes informativos**: Proporciona soluciones específicas cuando hay conflictos

## Prevención de Problemas Futuros

### Para desarrollo:

1. **Usar nodemon**: Ya está configurado en `npm run dev`
2. **Script de utilidad**: Usar `node scripts/check-port.js` antes de iniciar
3. **Variables de entorno**: Configurar puertos diferentes para diferentes entornos

### Para producción:

1. **Puertos específicos**: Usar puertos altos (ej: 8080, 3001)
2. **Supervisión**: Monitorear procesos con herramientas como PM2
3. **Documentación**: Mantener esta guía actualizada

## Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `node scripts/check-port.js` | Diagnóstico completo de puertos |
| `node scripts/check-port.js 3001` | Verificar puerto específico |
| `netstat -ano \| findstr :3000` | Ver procesos usando puerto 3000 |
| `tasklist /FI "PID eq 12345"` | Ver información de proceso por PID |
| `taskkill /PID 12345 /F` | Terminar proceso por PID |

## Solución Permanente

El código del servidor (`server.js`) ha sido mejorado para:

1. **Detectar automáticamente** puertos en uso
2. **Buscar puertos alternativos** de forma inteligente
3. **Proporcionar mensajes de error útiles** con soluciones
4. **Manejar cierre graceful** con Ctrl+C o señales del sistema

## ¿Necesitas más ayuda?

1. Revisa los logs del servidor para mensajes específicos
2. Ejecuta la herramienta de diagnóstico: `node scripts/check-port.js`
3. Consulta el archivo README.md para instrucciones generales
4. Verifica que no tengas múltiples instancias del servidor ejecutándose

---

**Nota**: Esta documentación está específicamente diseñada para el entorno Windows donde se desarrolla Trivia War. Para otros sistemas operativos, los comandos pueden variar (ej: `lsof -i :3000` en Linux/Mac en lugar de `netstat`).