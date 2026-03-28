# Usa una imagen oficial de Node.js ligera como base
FROM node:20-slim

# Establece el directorio de trabajo en el contenedor
WORKDIR /app

# Aseguramos que el directorio pertenezca al usuario 'node'
RUN chown node:node /app

# Cambiamos al usuario 'node' para mayor seguridad
USER node

# Copia los archivos de definición de dependencias
COPY --chown=node:node package*.json ./

# Instala las dependencias del proyecto
RUN npm ci --only=production

# Copia el resto del código de la aplicación
# NOTA: Los secretos (.env, JSON) se inyectarán en el servidor en tiempo de ejecución
COPY --chown=node:node . .

# Expone el puerto que usa la aplicación
EXPOSE 3000

# Variable de entorno por defecto
ENV NODE_ENV=production

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
