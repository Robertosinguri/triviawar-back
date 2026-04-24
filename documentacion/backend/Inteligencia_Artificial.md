# 🤖 Inteligencia Artificial - El Motor de Desafíos

Trivia War utiliza un sistema de IA de vanguardia para garantizar que ninguna partida sea igual a la anterior. El `aiService.js` es el cerebro encargado de orquestar múltiples modelos de lenguaje (LLMs).

## ⚡ Estrategia de Fallback (Resiliencia)

Para asegurar un tiempo de actividad del 100%, implementamos una **Cascada de Motores**. Si un servicio falla o tarda demasiado, el sistema salta automáticamente al siguiente:

1.  **Plan A (Gemini 1.5 Flash)**: Google Cloud. Ultra rápido y eficiente.
2.  **Plan B (Groq - Llama 3)**: Servidor de inferencia de baja latencia.
3.  **Plan C (Cohere)**: Especialista en estructuración de datos.
4.  **Plan D (HuggingFace)**: Modelos Open Source.
5.  **Plan E (OpenRouter)**: Agregador de modelos como backup final.

---

## 🎭 Personalidades de la IA (Prompts Dinámicos)

El sistema inyecta un "System Prompt" diferente según la dificultad elegida por los jugadores:

- **Dificultad Baby**: 
  - *Instrucción*: "Actúa como un profesor de primaria amable. Usa lenguaje simple y evita tecnicismos."
- **Dificultad Conocedor**: 
  - *Instrucción*: "Eres un entusiasta avanzado. Haz preguntas que requieran análisis y conocimiento detallado."
- **Dificultad Killer**: 
  - *Instrucción*: "Eres un arquitecto implacable. Prohibido usar términos comunes. Sé extremadamente técnico y específico."

---

## 📦 Formato de Salida

La IA está obligada a responder en un formato JSON estricto para que el Frontend pueda procesarlo sin errores:

```json
{
  "preguntas": [
    {
      "id": "uuid",
      "pregunta": "¿Qué es un puntero en C++?",
      "opciones": ["Una variable", "Una dirección de memoria", "Un objeto", "Una función"],
      "respuestaCorrecta": 1,
      "tematica": "Programación",
      "dificultad": "killer"
    }
  ],
  "aiUsada": "Gemini 1.5 Flash"
}
```

---

## 🧩 Mezcla de Temáticas (Multijugador)

En el modo multijugador, el servidor recolecta las temáticas de todos los jugadores y le pide a la IA que cree una **competencia balanceada**, repartiendo las preguntas equitativamente entre los temas elegidos.

---
[Volver al Índice](../Indice.md)
