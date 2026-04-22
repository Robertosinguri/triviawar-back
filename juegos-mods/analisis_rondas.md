# Análisis de Modalidad por Rondas (Hasta 6 jugadores)

Implementar un sistema de rondas es una excelente manera de organizar la partida y hacerla sentir como un verdadero torneo. A partir de tu idea ("2 jugadores = 1 round, 3 jugadores = 2 rounds..."), podemos crear una **fórmula matemática perfecta y justa** que garantice que todos los temas participen por igual y ninguna pregunta quede afuera.

Aquí te presento la lógica matemática que podemos imaginar para que el juego escale automáticamente.

## La Fórmula: Rondas = (Jugadores - 1)

Si tomamos tu idea de ir incrementando las rondas según la cantidad de jugadores, el cálculo ideal sería que cada temática aporte una cantidad de preguntas equivalente a la cantidad de rondas.

### 👥 Escenario 1: 2 Jugadores
- **Fórmula**: 2 Jugadores - 1 = **1 Ronda**.
- **Preguntas por tema**: 1 a 3 (podemos poner un mínimo para que no sea tan corto).
- **Mecánica**: Un "Duelo Directo". Las preguntas de ambos temas se mezclan en una sola ronda rápida y el que más acierte gana.

### 👥👥 Escenario 2: 3 Jugadores
- **Fórmula**: 3 Jugadores - 1 = **2 Rondas**.
- **Preguntas por tema**: 2 (Cada jugador aporta 2 preguntas al pozo).
- **Total de preguntas**: 6 preguntas (2 del Jugador A, 2 del B, 2 del C).
- **Mecánica**: 
  - **Ronda 1**: 3 preguntas (1 de cada tema).
  - **Ronda 2**: 3 preguntas (1 de cada tema).
  - Al dividirlo así, las rondas son perfectamente iguales en duración y en justicia temática.

### 👥👥👥 Escenario 3: 4 Jugadores
- **Fórmula**: 4 Jugadores - 1 = **3 Rondas**.
- **Preguntas por tema**: 3 (Cada jugador aporta 3 preguntas).
- **Total de preguntas**: 12 preguntas en total.
- **Mecánica**:
  - **Ronda 1**: 4 preguntas (1 de cada tema).
  - **Ronda 2**: 4 preguntas (1 de cada tema).
  - **Ronda 3**: 4 preguntas (1 de cada tema).

### 👥👥👥👥 Escenario 4: 6 Jugadores (Máximo)
- **Fórmula**: 6 Jugadores - 1 = **5 Rondas**.
- **Preguntas por tema**: 5.
- **Total de preguntas**: 30 preguntas en total.
- **Mecánica**:
  - 5 rondas emocionantes. En cada ronda hay exactamente 6 preguntas (una de cada temática). Esto garantiza que todos compitan en igualdad de condiciones en cada etapa del juego.

---

## 🛠️ Cómo funcionaría en la Interfaz y el Backend

Para que esta lógica cobre vida, tendríamos que ajustar el juego de la siguiente manera:

1. **El Rol del Host (Creador de Sala)**:
   - Al crear la sala, el Host elige el "Límite de Jugadores" (de 2 a 6).
   - El sistema le avisa automáticamente: *"Partida de 4 jugadores = 3 Rondas (12 preguntas)"*. Así ya se delimita el tamaño del juego desde antes que entren los invitados.

2. **La Inteligencia Artificial (`aiService.js`)**:
   - En lugar de pedirle "5 preguntas al azar", le pediríamos a la IA una matriz exacta. Por ejemplo para 4 jugadores: *"Genera 3 preguntas de Cine, 3 de Deportes, 3 de Historia y 3 de Arte"*.
   - Luego, el backend se encarga de "barajarlas" y separarlas en las rondas correspondientes.

3. **El Flujo de la Arena (`arena.ts`)**:
   - Entre cada ronda, habría una pequeña pausa (ej. 5 segundos) mostrando una tabla parcial: *"Fin de la Ronda 1. Así van los puntajes..."* antes de pasar a la Ronda 2. Esto le da muchísimo más dinamismo y competitividad que responder todo de corrido.

4. **Solución a la Dificultad**:
   - Como ahora cada jugador aporta exactamente "X preguntas" (dependiendo de las rondas), **la IA puede respetar la dificultad individual**. Las 3 preguntas del Jugador A (Cine) pueden ser fáciles (`baby`), y las 3 del Jugador B (Deportes) pueden ser difíciles (`killer`). ¡Cada quien es dueño de la dificultad de su propia temática!

### ¿Qué te parece este diseño?
Esta lógica cumple perfectamente con tu idea de escalar los rounds de manera matemática y garantiza que **ninguna pregunta quede afuera** y todos los temas pesen exactamente lo mismo en cada ronda.
