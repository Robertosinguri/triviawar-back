# Cambios Final: Matchmaking y Modelo de Rondas

"Hoja de Ruta" técnica para implementar el nuevo sistema de Multijugador. Contiene todas tus definiciones y las reglas exactas que programaremos en el código.

## 1. El Nuevo Flujo del Matchmaking (Salas Públicas)

Se acabaron los códigos secretos. Ahora el sistema será abierto y dinámico.

- **Crear Sala**: El Anfitrión (Host) solo elige el "Nombre de la Sala" y el "Límite de Jugadores" (2 a 6). Una vez creada, la sala queda alojada en el servidor como "Pública" y el host entra al Lobby. Ya no elige temática ni dificultad aquí.
- **Unirse a Sala**: Los jugadores verán una lista en tiempo real de todas las salas que están "Esperando" y que aún tienen cupo. Al hacer clic en una, entran al Lobby.

## 2. El Nuevo Lobby (Sistema "Ready")

La pantalla de espera (Lobby) sufrirá una transformación completa orientada a la transparencia:

- **Selección de Temática**: Cada jugador (incluido el Host) tiene un campo de texto para elegir su Temática. (Se eliminó la Dificultad).
- **El botón "Iniciar" (Toggle Ready)**: Cada jugador tiene su propio botón de Iniciar. Funciona como un interruptor (ON/OFF).
- **Transparencia**: Al darle ON, el estado del jugador cambia a "Listo" y **se muestra públicamente su Temática elegida** al resto de la sala.
- **Bloqueo de Colisiones**: Si un jugador intenta darle ON con una temática que ya fue bloqueada por otro jugador listo, el sistema le lanzará un error: *"El tema ya fue elegido"* y lo obligará a cambiarlo.
- **Inicio Automático**: El juego inicia por sí solo únicamente cuando `Cantidad de Listos == Capacidad Máxima de la Sala`. El host ya no tiene un botón forzado de Start.

## 3. Integración del Modelo IA

Cuando la partida inicia, el servidor enviará las temáticas bloqueadas a la IA con una nueva lógica inflexible:

- **Estructura Fija**: Por CADA temática, la IA generará exactamente 3 preguntas con una curva predefinida:
  - 1 Pregunta Nivel Baby
  - 1 Pregunta Nivel Conocedor
  - 1 Pregunta Nivel Killer
- **Total Equitativo**: Si hay 4 jugadores, la IA devolverá exactamente 12 preguntas (3 por jugador). Ningún tema se queda afuera.

## 4. La Arena (Juego en Vivo)

El escenario de juego (`arena.ts`) se adaptará para darle una vibra real de torneo:

- **Rondas (Escenarios)**: Las preguntas se dividirán en Rondas matemáticas (`Jugadores - 1` o bloques predefinidos). 
- **Intervalos de Descanso**: Cada vez que termine una Ronda, el juego se pausará exactamente **5 segundos**. En ese momento aparecerá una pantalla superpuesta mostrando los **Puntajes Parciales**, generando tensión y adrenalina antes de la siguiente ronda.
- **Puntuación Ponderada**: El clásico "+1 punto" desaparece. Ahora el sistema leerá la metadata de la pregunta y otorgará:
  - **+10 Puntos** si era Baby.
  - **+20 Puntos** si era Conocedor.
  - **+30 Puntos** si era Killer.

---
*Este plan es la confirmación final de diseño. A partir de aquí, las modificaciones se realizarán directamente sobre los archivos `roomService.js`, `aiService.js`, `lobby.ts`, y `arena.ts`.*
