# TRIVIA WAR - Backend

## 1. Descripción de la Aplicación

Backend del sistema Trivia War, una plataforma de trivia multijugador en tiempo real que permite a usuarios competir en partidas de preguntas y respuestas. El sistema gestiona autenticación, salas de juego, generación de preguntas mediante IA, y comunicación en tiempo real entre jugadores.

## 2. Arquitecturas y Tecnologías Usadas

### Arquitectura
- **API REST**: Para operaciones CRUD y gestión de usuarios
- **WebSockets (Socket.io)**: Para comunicación en tiempo real durante partidas
- **Microservicios**: Separación de responsabilidades por módulos
- **Stateless Design**: Sesiones manejadas mediante tokens

### Tecnologías Principales
- **Node.js**: Runtime de JavaScript
- **Express.js**: Framework para API REST
- **Socket.io**: Comunicación bidireccional en tiempo real
- **Firebase Firestore**: Base de datos NoSQL
- **Firebase Authentication**: Sistema de autenticación
- **Docker**: Contenedorización para despliegue

## 3. Estructura de Archivos

```
triviawar-back/
├── src/
│   ├── app.js                    # Configuración principal de Express
│   ├── config/
│   │   └── firebase.js           # Configuración de Firebase
│   ├── controllers/
│   │   ├── authController.js     # Controlador de autenticación
│   │   ├── dbController.js       # Controlador de base de datos
│   │   ├── gameController.js     # Controlador de juego
│   │   ├── roomController.js     # Controlador de salas
│   │   └── statsController.js    # Controlador de estadísticas
│   ├── repositories/
│   │   └── .keep                 # Para futuros repositorios
│   ├── routes/
│   │   └── apiRoutes.js          # Definición de rutas API
│   ├── services/
│   │   ├── aiService.js          # Servicio de IA
│   │   ├── authService.js        # Servicio de autenticación
│   │   ├── firestoreService.js   # Servicio de Firestore
│   │   ├── gameService.js        # Servicio de lógica del juego
│   │   ├── roomService.js        # Servicio de gestión de salas
│   │   └── statsService.js       # Servicio de estadísticas
│   ├── sockets/
│   │   ├── handlers/
│   │   │   ├── gameHandler.js    # Handler de eventos de juego
│   │   │   └── statsHandler.js   # Handler de eventos de estadísticas
│   │   └── socketManager.js      # Gestor principal de Socket.io
│   └── utils/
│       └── .keep                 # Para futuras utilidades
├── tests/                        # Tests de integración
├── .github/workflows/            # Configuración CI/CD
├── Dockerfile                    # Configuración Docker
├── docker-compose.yml           # Orquestación de contenedores
├── package.json                 # Dependencias y scripts
└── server.js                    # Punto de entrada
```

## 4. Instrucciones de Instalación y Ejecución

### Opción Local (Desarrollo)

1. **Clonar repositorio**
   ```bash
   git clone https://github.com/tu-usuario/triviawar-back.git
   cd triviawar-back
   ```

2. **Instalar dependencias**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**
   - Crear archivo `.env` basado en `.env.example`
   - Configurar credenciales necesarias

4. **Ejecutar servidor**
   ```bash
   npm start
   # O para desarrollo con recarga automática:
   npm run dev
   ```

5. **Verificar funcionamiento**
   - Servidor disponible en: `http://localhost:3000`
   - Health check: `http://localhost:3000/health`

### Sistemas de Despliegue Automático

El proyecto cuenta con dos pipelines de CI/CD independientes:

#### Opción 1: Servidor Local + Firebase Hosting
- **Backend**: Desplegado en servidor Linux local (NAS/VM)
- **Frontend**: Desplegado en Firebase Hosting Pages
- **Trigger**: Push a branch `main`
- **Configuración**: Ver `.github/workflows/deploy.yml`

#### Opción 2: AWS Cloud
- **Backend**: Desplegado en EC2 (VPS)
- **Frontend**: Desplegado en AWS Amplify
- **Configuración**: Configuración independiente para entornos cloud

Ambas opciones se ejecutan simultáneamente con cada push a `main`, permitiendo redundancia y alta disponibilidad.

## 5. Presentación del Equipo

### Equipo de Desarrollo
- **Desarrolladores Backend**: Especializados en Node.js, APIs y WebSockets
- **Desarrolladores Frontend**: Expertos en Angular y experiencia de usuario
- **Arquitectos de Sistemas**: Diseño de infraestructura y escalabilidad
- **QA/Testing**: Garantía de calidad y pruebas

### Metodología
- **Desarrollo Ágil**: Sprints de 2 semanas
- **Code Review**: Revisión de pares obligatoria
- **CI/CD**: Integración y despliegue continuos
- **Documentación**: Mantenimiento actualizado de APIs y procesos

## 6. Representantes y Coordinadores

### Representantes Técnicos
*(Esta sección será completada manualmente con información específica del equipo)*

**Representante Backend**: 
- Responsable: Arquitectura técnica y decisiones backend
- Contacto: Disponible para consultas técnicas

**Representante Frontend**:
- Responsable: Experiencia de usuario y interfaz
- Contacto: Coordinación frontend-backend

### Coordinadores de Proyecto
*(Esta sección será completada manualmente con información específica del equipo)*

**Coordinador General**:
- Responsable: Timeline y entregables
- Contacto: Comunicación con stakeholders

**Coordinador Técnico**:
- Responsable: Estándares de código y calidad
- Contacto: Resolución de bloqueos técnicos

---

*Nota: Para información específica sobre configuración de entornos, credenciales o detalles de implementación, contactar directamente con los representantes técnicos del proyecto.*