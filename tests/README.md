# Tests del Servicio de IA - Trivia War Backend

Esta carpeta contiene los scripts de prueba para validar las integraciones con las APIs de IA utilizadas en el sistema Trivia War.

## 📋 Tests Disponibles (Estructura Simplificada)

### Tests de Integración Principal

1. **`test-ai.js`** - Test completo del servicio `aiService.js`
   - Prueba todos los niveles de dificultad (Baby, Conocedor, Killer)
   - Valida estructura de preguntas generadas
   - Mide tiempos de respuesta
   - Verifica fallback automático entre proveedores
   - Ejecutar: `node tests/test-ai.js`

### Tests por Proveedor de IA (1 test por modelo)

2. **`test-openrouter.js`** - Test específico de OpenRouter API (Plan D)
   - Prueba conexión básica con OpenRouter
   - Test de generación de trivia
   - Medición de performance
   - Ejecutar: `node tests/test-openrouter.js`

3. **`test-groq.js`** - Test de Groq API (Plan A)
   - Prueba conexión con Groq
   - Verifica modelos: llama-3.1-8b-instant y llama-3.3-70b-versatile
   - Ejecutar: `node tests/test-groq.js`

4. **`test-cohere.js`** - Test de Cohere API (Plan B)
   - Prueba conexión con Cohere
   - Verifica modelo: command-r-08-2024
   - Ejecutar: `node tests/test-cohere.js`

5. **`test-hf.js`** - Test de Hugging Face API (Plan C)
   - Prueba conexión con Hugging Face
   - Verifica modelo: meta-llama/Llama-3.1-8B-Instruct
   - Ejecutar: `node tests/test-hf.js`

### Tests de Funcionalidad Específica

6. **`test-difficulty-levels.js`** - Prueba de niveles de dificultad
   - Compara resultados entre Baby, Conocedor y Killer
   - Valida que cada nivel genere preguntas apropiadas
   - Ejecutar: `node tests/test-difficulty-levels.js`

7. **`test-update-profile.js`** - Test de actualización de perfil
   - Prueba endpoint API de actualización de perfil
   - Valida integración con Firebase
   - Ejecutar: `node tests/test-update-profile.js`

### Tests de Verificación

8. **`verify-config.js`** - Verificación de configuración
   - Valida que todas las variables de entorno requeridas estén configuradas
   - Verifica formato de claves API
   - Ejecutar: `node tests/verify-config.js`

## 🚀 Arquitectura de Fallback

El sistema implementa una arquitectura de fallback con 4 planes:

### **Plan A: OpenRouter** (Nuevo - Principal)
- **Modelo**: `liquid/lfm-2.5-1.2b-thinking:free`
- **URL**: `https://openrouter.ai/api/v1/chat/completions`
- **Variable de entorno**: `OPENROUTER_API_KEY`

### **Plan B: Groq** (Respaldo 1)
- **Modelos**: 
  - `llama-3.3-70b-versatile` (Killer/Conocedor)
  - `llama-3.1-8b-instant` (Baby)
- **Variable de entorno**: `GROQ_API_KEY`

### **Plan C: Cohere** (Respaldo 2)
- **Modelo**: `command-r-08-2024`
- **Variable de entorno**: `COHERE_API_KEY`

### **Plan D: Hugging Face** (Respaldo 3)
- **Modelo**: `meta-llama/Llama-3.1-8B-Instruct`
- **Variable de entorno**: `HF_API_KEY`

## 🔧 Configuración Requerida

### Variables de Entorno (.env)
```env
# Plan A - Principal
OPENROUTER_API_KEY=tu_clave_openrouter_aqui

# Plan B - Respaldo 1
GROQ_API_KEY=tu_clave_groq_aqui

# Plan C - Respaldo 2
COHERE_API_KEY=tu_clave_cohere_aqui

# Plan D - Respaldo 3
HF_API_KEY=tu_clave_huggingface_aqui
```

### Obtener Claves API
1. **OpenRouter**: https://openrouter.ai/keys
2. **Groq**: https://console.groq.com/keys
3. **Cohere**: https://dashboard.cohere.com/api-keys
4. **Hugging Face**: https://huggingface.co/settings/tokens

## 📊 Flujo de Ejecución de Tests

### Para Desarrollo Local
```bash
# 1. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus claves API

# 2. Ejecutar test completo de integración
node tests/test-ai.js

# 3. Ejecutar tests específicos por proveedor
node tests/test-openrouter.js    # OpenRouter (Plan D)
node tests/test-groq.js          # Groq (Plan A)
node tests/test-cohere.js        # Cohere (Plan B)
node tests/test-hf.js            # Hugging Face (Plan C)

# 4. Ejecutar tests de funcionalidad
node tests/test-difficulty-levels.js  # Niveles de dificultad
node tests/test-update-profile.js     # Actualización de perfil

# 5. Verificar configuración
node tests/verify-config.js
```

### Para CI/CD
Los tests se pueden integrar en pipelines de CI/CD para validar:
- Conexión a todas las APIs configuradas
- Estructura correcta de respuestas
- Tiempos de respuesta aceptables
- Fallback automático entre servicios

## 🧪 Criterios de Validación

Cada test valida:

1. **Conexión**: HTTP status 200 y respuesta válida
2. **Estructura**: Formato JSON correcto con campos requeridos
3. **Contenido**: 
   - 5 preguntas por solicitud
   - 4 opciones por pregunta
   - Índice de respuesta correcta (0-3)
   - Temática asignada
4. **Performance**: Tiempo de respuesta < 10 segundos
5. **Fallback**: Transición automática entre planes si uno falla

## 🔍 Solución de Problemas

### Error: "API key not found"
```bash
# Verificar variables de entorno
echo $OPENROUTER_API_KEY
# O en Windows:
echo %OPENROUTER_API_KEY%

# Verificar archivo .env
cat .env | grep OPENROUTER
```

### Error: "Connection timeout"
1. Verificar conexión a internet
2. Revisar firewall/proxy
3. Probar con curl manual:
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "liquid/lfm-2.5-1.2b-thinking:free", "messages": [{"role": "user", "content": "Test"}]}'
```

### Error: "Invalid JSON response"
1. Verificar prompt y system instruction
2. Revisar límite de tokens
3. Probar con mensaje más simple

## 📈 Métricas de Performance

- **Tiempo de respuesta aceptable**: < 5 segundos
- **Tiempo de respuesta óptimo**: < 2 segundos
- **Tasa de éxito mínima**: 90%
- **Fallback automático**: < 15 segundos total

## 🤝 Contribución

1. Ejecutar todos los tests antes de hacer cambios
2. Agregar nuevos tests para nuevas funcionalidades
3. Documentar cambios en este README
4. Mantener compatibilidad con fallback existente

## 📄 Notas

- Los tests NO se ejecutan en producción
- Son herramientas de desarrollo y validación
- No committear archivos .env con claves reales
- Usar GitHub Secrets para CI/CD

---

*Última actualización: Simplificación de estructura de tests - 1 test por modelo*
*Cambios realizados:*
*- Eliminada GEMINI_API_KEY del .env*
*- Eliminados tests redundantes (test-ai-openrouter.js, test-killer-mode.js, etc.)*
*- Mantenidos solo tests esenciales: 1 test por modelo + tests de funcionalidad clave*
*- Actualizada documentación*
