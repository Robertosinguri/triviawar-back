# 🎨 Tecnologías y Arquitectura - Frontend

El cliente de Trivia War es una aplicación moderna de una sola página (SPA) construida con **Angular 17+**, enfocada en el rendimiento y una experiencia de usuario inmersiva.

## 🛠️ Stack Tecnológico

- **Framework**: Angular (v17+)
- **Gestión de Estado**: Angular Signals (Reactividad de alto rendimiento)
- **Componentes**: Standalone Components (Arquitectura modular sin módulos pesados)
- **Estilo**: SCSS con metodologías de variables dinámicas para temas.
- **Comunicación**:
  - **HTTP**: HttpClient para API REST.
  - **Real-Time**: Socket.io-client para comunicación bidireccional.

---

## 📂 Estructura del Proyecto

```text
triviawar-front/
├── src/app/
│   ├── componentes/      # Interfaz de Usuario
│   │   ├── arena/        # El motor de juego visual
│   │   ├── lobby/        # Gestión de sala antes de iniciar
│   │   ├── dashboard/    # Hub principal del jugador
│   │   └── navbar/       # Barra de estado y perfil
│   ├── servicios/        # Lógica de comunicación y estado
│   │   ├── auth/         # Integración con Firebase Auth
│   │   ├── websocket/    # Wrapper de Socket.io
│   │   └── audio/        # Motor de sonidos dinámicos
│   └── pipes/            # Utilidades de transformación de datos
└── assets/               # Imágenes, fuentes y archivos de audio
```

---

## ⚡ Reactividad con Signals

A diferencia de versiones anteriores de Angular, Trivia War utiliza **Signals** para manejar el estado del usuario y de las salas. Esto garantiza:
- **Zero Memory Leaks**: No requiere suscripciones manuales pesadas.
- **Actualización Granular**: Solo se repinta el elemento exacto que cambia (ej: el contador de tiempo en la Arena).

---

## 🎭 Estética Visual (Modern Dark UI)

El diseño está inspirado en interfaces de gaming modernas:
- **Glassmorphism**: Uso de transparencias y desenfoques.
- **Neon Accents**: Colores vibrantes sobre fondos oscuros para alta legibilidad.
- **Responsive Design**: Adaptado para jugar tanto en PC como en dispositivos móviles.

---
[Volver al Índice](../Indice.md)
