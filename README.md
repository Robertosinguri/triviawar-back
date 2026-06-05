# 🎮 TRIVIA WAR - Backend

## 1. Descripción de la Aplicación

Backend del sistema **Trivia War**, una plataforma de trivia multijugador en tiempo real que permite a usuarios competir en partidas de preguntas y respuestas generadas dinámicamente mediante **Inteligencia Artificial**. El sistema gestiona autenticación, salas de juego, generación de preguntas con múltiples motores de IA (con fallback automático), chat en tiempo real, y comunicación bidireccional entre jugadores.

---

## 2. Arquitectura y Tecnologías Usadas

### Arquitectura
- **API REST**: Para operaciones CRUD, gestión de usuarios y estadísticas
- **WebSockets (Socket.io)**: Para comunicación en tiempo real durante partidas, chat global y por sala
- **Microservicios**: Separación de responsabilidades por módulos (controllers, services, repositories)
- **Stateless Design**: Sesiones manejadas mediante tokens JWT de Firebase
- **Fallback Mode**: Almacenamiento en memoria cuando no hay credenciales de Firestore disponibles

### Tecnologías Principales
| Tecnología | Versión | Propósito |
|---|---|---|
| **Node.js** | 20+ | Runtime de JavaScript |
| **Express.js** | ^4.22.1 | Framework para API REST |
| **Socket.io** | ^4.8.1 | Comunicación bidireccional en tiempo real |
| **Firebase Admin SDK** | ^12.7.0 | Autenticación y base de datos Firestore |
| **Firebase Firestore** | — | Base de datos NoSQL (colecciones: `mvpp-salas`, `mvpp-estadisticas`, `mvpp-resultados-partida`) |
| **Firebase Authentication** | — | Sistema de autenticación de usuarios |
| **Helmet** | ^8.1.0 | Seguridad de headers HTTP |
| **Morgan** | ^1.10.0 | Logging de peticiones HTTP |
| **Docker** | — | Contenedorización para despliegue |
| **GitHub Actions** | — | CI/CD automatizado |

### Motores de IA (Generación de Preguntas)
El sistema cuenta con **5 motores de IA** con fallback automático en cascada:

| Plan | Motor | Modelo | Timeout |
|---|---|---|---|
| **Plan A** | Google Gemini | `gemini-3.1-flash-lite-preview` | 8s |
| **Plan B** | Groq | `llama-3.3-70b-versatile` | 15s |
| **Plan C** | Cohere | `command-r-08-2024` | 15s |
| **Plan D** | Hugging Face | `meta-llama/Llama-3.1-8B-Instruct` | 20s |
| **Plan E** | OpenRouter | `liquid/lfm-2.5-1.2b-thinking:free` | 25s |

---

## 3. Estructura de Archivos

```
triviawar-back/
├── src/
│   ├── app.js                       # Configuración principal de Express (middlewares, rutas, errores)
│   ├── config/
│   │   └── firebase.js              # Inicialización de Firebase Admin SDK
│   ├── controllers/
│   │   ├── authController.js        # Controlador de autenticación (login, signup, Google, perfil)
│   │   ├── audioController.js       # Controlador para servir archivos de audio
│   │   ├── dbController.js          # Controlador de estado de Firestore
│   │   ├── gameController.js        # Controlador de juego (generar preguntas, enviar resultados)
│   │   ├── roomController.js        # Controlador de salas (obtener, listar activas)
│   │   └── statsController.js       # Controlador de estadísticas y ranking
│   ├── repositories/
│   │   └── roomRepository.js        # Repositorio de salas (CRUD sobre Firestore)
│   ├── routes/
│   │   └── apiRoutes.js             # Definición de todas las rutas API REST
│   ├── services/
│   │   ├── aiService.js             # Servicio de IA con 5 motores y fallback automático
│   │   ├── authService.js           # Servicio de autenticación (Firebase Auth + REST API)
│   │   ├── firestoreService.js      # Servicio de Firestore con fallback a memoria
│   │   ├── gameService.js           # Servicio de lógica del juego (iniciar, submit)
│   │   ├── roomService.js           # Servicio de gestión de salas (crear, unir, salir)
│   │   └── statsService.js          # Servicio de estadísticas y ranking global
│   ├── sockets/
│   │   ├── socketManager.js         # Gestor principal de Socket.io
│   │   └── handlers/
│   │       ├── chatHandler.js       # Handler de chat global y por sala
│   │       ├── gameHandler.js       # Handler de eventos de juego (salas, inicio, resultados)
│   │       └── statsHandler.js      # Handler de eventos de estadísticas
│   └── utils/                       # Utilidades (pendiente de implementación)
├── tests/                           # Tests de integración y scripts de prueba
│   ├── test-ai.js                   # Test de generación de preguntas con IA
│   ├── test-cohere.js               # Test específico de Cohere
│   ├── test-gemini.js               # Test específico de Gemini
│   ├── test-groq.js                 # Test específico de Groq
│   ├── test-hf.js                   # Test específico de Hugging Face
│   ├── test-openrouter.js           # Test específico de OpenRouter
│   ├── test-difficulty-levels.js    # Test de niveles de dificultad
│   ├── test-update-profile.js       # Test de actualización de perfil
│   └── verify-config.js             # Verificación de configuración
├── public/
│   └── audio/                       # Archivos de audio (efectos, música de fondo)
├── scripts/
│   └── check-port.js                # Script de verificación de puertos
├── assets/                          # Recursos estáticos
├── .github/workflows/
│   ├── deploy.yml                   # CI/CD para servidor local + Firebase Hosting
│   └── deploy-aws.yml               # CI/CD para AWS EC2
├── Dockerfile                       # Configuración Docker (Node 20, multi-etapa)
├── docker-compose.yml               # Orquestación de contenedores (producción)
├── docker-compose.aws.yml           # Orquestación para AWS
├── server.js                        # Punto de entrada (servidor HTTP + Socket.io)
├── package.json                     # Dependencias y scripts
└── README.md                        # Este archivo
```

---

## 4. Instrucciones de Instalación y Ejecución

### Opción Local (Desarrollo)

1. **Clonar repositorio**
   ```bash
   git clone https://github.com/Robertosinguri/triviawar-back.git
   cd triviawar-back
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   - Crear archivo `.env` en la raíz del proyecto
   - Variables requeridas:
     ```env
     PORT=3000
     NODE_ENV=development
     FIREBASE_WEB_API_KEY=tu_api_key
     GEMINI_API_KEY=tu_gemini_key
     GROQ_API_KEY=tu_groq_key
     COHERE_API_KEY=tu_cohere_key
     HF_API_KEY=tu_huggingface_key
     OPENROUTER_API_KEY=tu_openrouter_key
     ```
   - Opcional: `FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json`

4. **Ejecutar servidor**
   ```bash
   npm start
   # O para desarrollo con recarga automática:
   npm run dev
   ```

5. **Verificar funcionamiento**
   - Servidor disponible en: `http://localhost:3000`
   - Health check: `http://localhost:3000/health`
   - API base: `http://localhost:3000/api` (también disponible en `/dev/api`)

### Opción Docker

```bash
# Construir imagen
npm run docker:build

# O directamente:
docker build -t trivia-war-backend .

# Ejecutar con docker-compose
docker-compose up -d
```

### Sistemas de Despliegue Automático

El proyecto cuenta con **dos pipelines de CI/CD independientes** que se ejecutan simultáneamente con cada push a `main`:

#### Opción 1: Servidor Local + Firebase Hosting
- **Backend**: Desplegado en servidor Linux local (NAS/VM)
- **Frontend**: Desplegado en Firebase Hosting Pages
- **Trigger**: Push a branch `main`
- **Configuración**: `.github/workflows/deploy.yml`

#### Opción 2: AWS Cloud
- **Backend**: Desplegado en EC2 (VPS)
- **Frontend**: Desplegado en AWS Amplify
- **Configuración**: `.github/workflows/deploy-aws.yml`

---

## 5. API REST - Endpoints

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Inicio de sesión (email + password) |
| POST | `/api/auth/signup` | Registro de nuevo usuario |
| POST | `/api/auth/google-login` | Inicio de sesión con Google |
| POST | `/api/auth/update-profile` | Actualizar perfil (avatar, nombre) |
| POST | `/api/auth/resend-verification` | Reenviar email de verificación |
| POST | `/api/auth/forgot-password` | Recuperación de contraseña |

### Estadísticas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/stats/personal` | Estadísticas personales del usuario |
| GET | `/api/stats/ranking` | Ranking global (top 50 por defecto) |

### Juego
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/games/generate-questions` | Generar preguntas con IA (competitivo o entrenamiento) |
| POST | `/api/games/submit-result` | Enviar resultado de partida |

### Salas
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/rooms` | Listar salas activas disponibles |
| GET | `/api/rooms/:code` | Obtener información de una sala |

### Audio
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/audio/list` | Listar archivos de audio disponibles |
| GET | `/api/audio/:filename` | Obtener archivo de audio |

### Base de Datos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/db/status` | Estado de conexión a Firestore |
| GET | `/api/db/clear-rooms` | Limpiar todas las salas |

---

## 6. Eventos WebSocket (Socket.io)

### Eventos del Cliente → Servidor
| Evento | Descripción |
|---|---|
| `create_room` | Crear una nueva sala de juego |
| `join_room` | Unirse a una sala existente |
| `leave_room` | Salir de una sala |
| `update_config` | Actualizar configuración del jugador (temática) |
| `start_game` | Iniciar la partida |
| `save_game_result` | Guardar resultado de partida |
| `get_my_stats` | Solicitar estadísticas personales |
| `get_global_ranking` | Solicitar ranking global |
| `chat:join` | Unirse al chat global o de sala |
| `chat:send_message` | Enviar mensaje de chat |
| `chat:join_room` | Unirse a sala de chat específica |
| `chat:leave_room` | Salir de sala de chat específica |

### Eventos del Servidor → Cliente
| Evento | Descripción |
|---|---|
| `room_created` | Sala creada exitosamente |
| `room_updated` | Estado de la sala actualizado |
| `game_loading` | Generando preguntas con IA (spinner) |
| `game_started` | Juego iniciado con preguntas |
| `ranking_update` | Actualización de ranking en tiempo real |
| `my_stats_received` | Estadísticas personales recibidas |
| `global_ranking_received` | Ranking global recibido |
| `game_result_saved` | Resultado guardado exitosamente |
| `chat:message` | Nuevo mensaje de chat |
| `chat:history` | Historial de mensajes |
| `chat:users_list` | Lista de usuarios conectados |
| `error` | Error general |

---

## 7. Colecciones de Firestore

| Colección | Propósito |
|---|---|
| `mvpp-salas` | Almacenamiento de salas de juego activas |
| `mvpp-estadisticas` | Estadísticas agregadas por usuario (puntaje total, partidas jugadas) |
| `mvpp-resultados-partida` | Resultados individuales de cada partida |

---

## MVPP

Equipo de trabajo: Antonella Z. - Gerarlis R. - Ariadna P. - Jesica G. - Roberto S. --

