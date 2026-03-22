# TRIVIA WAR - Backend (Server) 🚀

Este es el backend de **Trivia War**, una API REST y servidor de **WebSockets (Socket.io)** encargado de la lógica del juego de trivia multijugador.

## 📦 Despliegue en un Contenedor (NAS / Docker)

Este proyecto está preparado para ser desplegado en un contenedor Docker, ideal para un NAS.

### Pasos para desplegar:
1. **Configurar el entorno:**
   - Asegúrate de tener el archivo `.env` configurado con tus claves de API para Gemini, Cohere, etc.
   - Si usas Firebase, asegúrate de que `service-account.json` sea correcto y su ruta esté bien definida en el `.env`.
2. **Construir la imagen Docker:**
   ```bash
   docker build -t triviawar-back .
   ```
3. **Ejecutar el contenedor:**
   ```bash
   docker run -d -p 3000:3000 --env-file .env --name triviawar-back triviawar-back
   ```
4. **En el NAS:**
   - Si tu NAS tiene soporte para Docker (como Synology o QNAP), puedes subir el código y construir la imagen, o subirla a un registro (como Docker Hub) y descargarla en el NAS.
   - No olvides mapear el puerto 3000.

## ⚙️ Desarrollo Local
1. Instalar dependencias con `npm install`.
2. Crear un archivo `.env` con las claves API necesarias.
3. Ejecutar `npm run dev` para iniciar el servidor con `nodemon`.
4. El servidor correrá en `http://localhost:3000`.

## 📁 Estructura
- `src/sockets/`: Gestión de conexiones Socket.io y lógica en tiempo real.
- `src/services/aiService.js`: Sistema híbrido de IA con triple redundancia (Gemini + Cohere + Llama).
- `src/routes/apiRoutes.js`: Definición de los endpoints REST para auth, stats, etc.
- `src/app.js`: Configuración central de Express y CORS.
- `server.js`: Punto de entrada del servidor.
- `Dockerfile`: Configuración para empaquetar en contenedor.
