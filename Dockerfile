# Usa la imagen oficial COMPLETA de Node.js (incluye herramientas de compilación)
FROM node:20

# Establece el directorio de trabajo en el contenedor
WORKDIR /app

# Copia los archivos de definición de dependencias
# (Se hace como root por defecto para evitar problemas de permisos iniciales)
COPY package.json package-lock.json ./

# Instala las dependencias del proyecto (omitimos las de desarrollo para producción)
RUN npm ci --omit=dev

# Copia el resto del código de la aplicación
COPY . .

# Ajustamos los permisos de la carpeta /app para el usuario 'node'
RUN chown -R node:node /app

# Exponemos el puerto
EXPOSE 3000

# Variable de entorno de producción
ENV NODE_ENV=production

# Cambiamos al usuario 'node' para ejecutar la aplicación (Seguridad Mejorada)
USER node

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
