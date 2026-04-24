# 🏗️ Arquitectura y Estructura - Backend

El backend de Trivia War es una aplicación robusta construida sobre **Node.js** y **Express**, diseñada para manejar interacciones en tiempo real y procesamiento de IA.

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js
- **Framework Web**: Express.js
- **Tiempo Real**: Socket.io
- **Base de Datos & Auth**: Firebase (Firestore + Firebase Auth)
- **IA**: Google Gemini, Groq, Cohere, OpenRouter (vía API REST)

---

## 📂 Estructura de Carpetas

```text
triviawar-back/
├── src/
│   ├── config/             # Configuración de Firebase y variables de entorno
│   ├── controllers/        # Lógica de manejo de peticiones HTTP
│   ├── routes/             # Definición de rutas API (REST)
│   ├── services/           # Lógica de negocio (IA, Sockets, Firestore)
│   │   ├── aiService.js    # 🤖 Orquestador de Motores IA
│   │   ├── authService.js  # 🔐 Gestión de usuarios y alias
│   │   ├── socketService.js# 🚀 Core de comunicación en tiempo real
│   │   └── roomService.js  # 🏠 Lógica de gestión de salas
│   ├── repositories/       # Abstracción de acceso a datos
│   └── models/             # (Opcional) Esquemas de datos
├── juegos-mods/            # Planes de diseño y logs de cambios
├── public/                 # Archivos estáticos si fueran necesarios
└── server.js               # Punto de entrada de la aplicación
```

---

## ⚡ Modos de Operación

### 1. Modo Online (Producción/Firebase)
Utiliza las credenciales de Firebase para persistir estadísticas, rankings y manejar la autenticación real de Google. Requiere un archivo `service-account.json`.

### 2. Modo Offline (Desarrollo/Memoria)
Si el servidor no detecta credenciales de Firebase, se activa automáticamente el **Modo Memoria**. Los datos (salas, usuarios temporales) se guardan en un objeto volátil en RAM. Esto permite que el juego sea funcional para pruebas locales sin configuración compleja.

---

## 🚀 Puntos de Fuerza

- **Escalabilidad Horizontal**: Diseñado para separar la lógica de la sala del estado global.
- **Resiliencia de IA**: Sistema de 5 niveles de fallback para asegurar que siempre haya preguntas.
- **Privacidad**: Blindaje de identidad real (DisplayName) mediante el sistema de Alias forzado.

---
[Volver al Índice](../Indice.md)
