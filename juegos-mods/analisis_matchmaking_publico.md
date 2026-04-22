# Análisis Integral: Matchmaking Público + Modelo Excel

Este documento consolida la reestructuración completa del sistema Multijugador, integrando la lógica de **Salas Públicas** con el **Modelo de Juego de Excel**.

## 🚀 Resumen del Rediseño

La idea principal es cambiar el flujo cerrado actual (donde los jugadores necesitan compartir un código por fuera) por un ecosistema abierto y dinámico:

1. **Creación de Salas (Host)**: El anfitrión solo define la sala (Nombre y Máx. de Jugadores). No escoge temática ni dificultad en este paso. Deja la sala abierta al público.
2. **Listado Público (Matchmaking)**: En "Unirse a Sala", en lugar de pedir un código, los jugadores verán una "Lista de Salas Activas" que están esperando jugadores.
3. **Lobby Simplificado**: Todos los que entran a la sala eligen **únicamente su temática**.
4. **Adopción del Modelo Excel**:
   - Se elimina por completo la selección de dificultad.
   - Cada jugador aporta automáticamente **3 preguntas (1 Baby, 1 Conocedor, 1 Killer)**.
   - Puntuación ponderada: Baby=10, Conocedor=20, Killer=30.
5. **Auto-Start**: Cuando la sala alcanza el número máximo de jugadores y todos tienen su temática, se habilita el botón "Iniciar Arena".

---

## 🛠️ Cambios Estructurales Necesarios

Para llevar esto a cabo, debemos modificar las siguientes áreas del código:

### Fase 1: Backend - Soporte de Salas Públicas
- Modificar `roomRepository.js` y `firestoreService.js` para crear un endpoint que devuelva las salas "públicas".
- Una sala pública es aquella cuyo `estado === 'esperando'` y la cantidad actual de jugadores es menor a su capacidad máxima.

### Fase 2: Frontend - Flujo de Menús
- **`crear-sala`**:
  - Eliminar los selectores de Temática y Dificultad.
  - El anfitrión define solo la capacidad. Al presionar "Crear", pasa automáticamente al Lobby.
- **`unirse-sala`**:
  - Reemplazar el input manual de código por una galería o lista de salas disponibles.
  - Las tarjetas mostrarán: Nombre de la Sala, Anfitrión, y Ocupación (ej: "2/4 Jugadores").

### Fase 3: Frontend - El Lobby
- En el Lobby, los jugadores (incluyendo al host) tendrán una casilla para escribir su Temática.
- Ya no se pregunta la dificultad.
- El botón de **"Iniciar Arena"** estará inactivo o bloqueado hasta que el sistema detecte que la sala está llena. Una vez llena, todos podrían ver el botón habilitado (o podríamos dejar que solo el Host dé el "Pistoletazo de salida").

### Fase 4: Integración del Modelo Excel (IA y Arena)
- **`aiService.js` (La Inteligencia Artificial)**:
  - El prompt será modificado para pedir estrictamente una distribución de Dificultad Creciente: *"Para la temática Cine, dame 1 pregunta Baby, 1 Conocedor y 1 Killer"*.
  - Se debe garantizar que la IA devuelva la dificultad real en el JSON de cada pregunta.
- **`arena.ts` (El Juego en Vivo)**:
  - La lógica de puntuación (`puntaje++`) será reemplazada por un sistema ponderado (+10, +20, +30).
  - Se implementará la lógica de "Intermedio" o "Ronda". Cada 3 o 4 preguntas (según la cantidad de jugadores), se hará una pequeña pausa de 5 segundos mostrando el ranking parcial para aumentar la competitividad.

---

## 🛑 Preguntas por Definir antes de Codificar

Si estamos de acuerdo con esta visión arquitectónica, solo quedan 3 detalles por definir para empezar a trabajar en el código:

1. **El botón "Iniciar Arena"**: Cuando la sala está llena, ¿cualquiera puede darle a Iniciar, o prefieres que solo el creador original de la sala tenga ese poder?
2. **Intervalo entre Rondas**: ¿Estás de acuerdo con implementar la pausa visual de 5 segundos donde se muestren los puntajes parciales en pantalla para mantener la adrenalina?
3. **Temáticas repetidas**: ¿Deberíamos bloquear que dos jugadores en la misma sala elijan la misma temática (ej. que dos elijan "Cine"), o lo permitimos?
