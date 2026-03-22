# Usa una imagen oficial de Node.js ligera como base
FROM node:20-slim

# Establece el directorio de trabajo en el contenedor
WORKDIR /app

# Copia los archivos de definición de dependencias
COPY package*.json ./

# Instala las dependencias del proyecto
# Usamos ci para una instalación más consistente en entornos de construcción
RUN npm ci --only=production

# Copia el resto del código de la aplicación
COPY . .

# Expone el puerto que usa la aplicación (por defecto 3000)
EXPOSE 3000

# Variable de entorno por defecto
ENV NODE_ENV=production

# Comando para iniciar la aplicación
CMD ["node", "server.js"]
