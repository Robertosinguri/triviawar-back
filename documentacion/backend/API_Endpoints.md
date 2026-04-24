# 🔌 Referencia de API Endpoints

La API de Trivia War está organizada por módulos. Todas las rutas tienen el prefijo `/api` (o según configuración de entorno).

## 🔐 Autenticación (`/auth`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/auth/login` | Inicio de sesión con correo y contraseña. |
| `POST` | `/auth/signup` | Registro de nuevo usuario. |
| `POST` | `/auth/google-login` | Autenticación vía Google ID Token. |
| `POST` | `/auth/update-profile` | Actualización de Alias o Avatar. |

---

## 🏠 Salas y Multijugador (`/rooms`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/rooms` | Listado de salas públicas activas. |
| `GET` | `/rooms/:code` | Obtener detalles de una sala específica. |
| `POST` | `/rooms/create` | Crear una nueva sala de juego. |
| `DELETE` | `/rooms/clear` | (Dev) Limpiar todas las salas activas. |

---

## 🎮 Juego y Resultados (`/games`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `POST` | `/games/generate-questions` | Solicitar preguntas a la IA (Single Player). |
| `POST` | `/games/submit-result` | Guardar puntaje y actualizar ranking. |

---

## 📊 Estadísticas (`/stats`)

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/stats/my-stats` | Obtener estadísticas personales del usuario. |
| `GET` | `/stats/ranking` | Obtener el Top 50 global de jugadores. |

---

## 🛠️ Utilidades de Desarrollo (`/dev`)
- `GET /dev/api/db/status`: Verifica el estado de la conexión con Firestore o si está en modo memoria.

---
[Volver al Índice](../Indice.md)
