# Informe del Modo Entrenamiento

### 🤖 1. Generación de las Preguntas por la IA
La IA siempre genera **exactamente 5 preguntas** por cada sesión de entrenamiento.

**¿Cómo es el proceso de generación?**
1. **Configuración inicial**: En la pantalla de entrenamiento, el jugador define la *Temática* (hasta 3 palabras) y la *Dificultad* (`baby`, `conocedor`, `killer`).
2. **Cascada de Motores IA (Planes A al E)**: Para garantizar que el jugador nunca se quede sin preguntas, tu servidor (`aiService.js`) tiene un sistema inteligente de respaldo:
   - **Plan A**: Intenta primero con **Gemini** (3.1 Flash Lite) por ser el más rápido.
   - **Plan B**: Si falla, pasa a **Groq (Llama 3)**, el cual es inteligente y usa un modelo ligero (8B) si la dificultad es 'baby', o un modelo pesado (70B) si es 'conocedor' o 'killer'.
   - **Planes C, D y E**: Si hay caídas, sigue intentando con Cohere, HuggingFace y finalmente OpenRouter.
3. **El "Rol" de la IA**: Dependiendo de la dificultad, el servidor le inyecta a la IA una "personalidad":
   - **Baby**: Le pide que actúe como un "profesor de primaria amable" usando lenguaje muy simple y fácil de descartar.
   - **Conocedor**: Pide términos para un "entusiasta avanzado".
   - **Killer**: Le exige que actúe como un "arquitecto implacable" y le prohíbe usar términos comunes; debe ser muy técnica (preguntando por colisiones de memoria, logs, etc.).
4. **Formato estricto**: La IA es forzada a devolver un JSON puro con 5 preguntas, cada una con 4 opciones (A, B, C, D) y el índice exacto de la respuesta correcta.

### 🎮 2. El "Entrenamiento" (La Partida)
Una vez que la IA entrega las 5 preguntas, el jugador es enviado al componente `Arena`.

- **Inicio**: Comienza a sonar la música de tensión y se muestra la primera pregunta.
- **Reloj de 30 segundos**: El jugador tiene exactamente 30 segundos por pregunta (controlado por `tiempoRestante` en `arena.ts`).
- **Interacción**: 
   - Si el jugador elige una respuesta, se reproduce un sonido de *click*.
   - El sistema valida instantáneamente si coincide con el índice que dio la IA.
   - Se da feedback inmediato (sonido de `correcto` o `incorrecto`) y suma 1 punto al `puntaje` si acertó.
- **Tiempo Agotado**: Si el temporizador llega a cero, el juego asume que no se respondió, muestra la respuesta correcta (feedback visual) y avanza.

### 📊 3. Evaluación y Resultados Finales
Al finalizar la quinta y última pregunta (`esUltimaPregunta()`), ocurre lo siguiente:

1. **Cálculo Local**: El frontend recopila el total de aciertos (`puntaje`), las 5 preguntas y el `tiempoTotal` (cuántos segundos en total estuvo en la arena desde que inició).
2. **Envío al Servidor**: Esta información viaja al backend a través de `/games/submit-result`.
3. **Lógica Single-Player (`gameController.js`)**:
   - Como no hay un "código de sala multijugador" (`roomCode`), el backend detecta que es el modo Entrenamiento (un solo jugador).
   - Calcula el **porcentaje de efectividad**: `(aciertos / 5) * 100`.
   - **Guarda en la Base de Datos**: Llama a `statsService.guardarResultado(userId, resultData)`. Esto significa que, aunque sea un entrenamiento, **la partida cuenta para las estadísticas globales y el progreso del jugador** en su perfil.
   - **Ranking de 1**: Crea un "ranking virtual" donde este único jugador queda en la Posición 1 (Ganador indiscutido).
4. **Cierre**: El backend devuelve los datos procesados, el frontend los guarda en `localStorage` temporalmente y redirige al usuario a la pantalla de `/resultados` para que vea su trofeo, sus aciertos, su tiempo y su porcentaje de precisión.
