require("dotenv").config();
const aiService = require("../src/services/aiService");

async function testAIService() {
  console.log(
    "🧪 Iniciando prueba del Servicio de IA (Gemini como Plan A)...\n",
  );

  const testCases = [
    {
      name: "Test Básico - 1 temática (Baby)",
      tematicas: ["Programación"],
      dificultad: "baby",
      description: "Prueba básica con nivel fácil y una sola temática",
    },
    {
      name: "Test Intermedio - 2 temáticas (Conocedor)",
      tematicas: ["JavaScript", "Node.js"],
      dificultad: "conocedor",
      description: "Prueba intermedia con dos temáticas técnicas",
    },
    {
      name: "Test Avanzado - 3 temáticas (Killer)",
      tematicas: ["Arquitectura de Software", "Seguridad", "DevOps"],
      dificultad: "killer",
      description: "Prueba avanzada con temáticas complejas",
    },
  ];

  let totalTests = testCases.length;
  let passedTests = 0;

  for (const testCase of testCases) {
    console.log(`📋 ${testCase.name}`);
    console.log(`   📝 ${testCase.description}`);
    console.log(`   🏷️  Temáticas: ${testCase.tematicas.join(", ")}`);
    console.log(`   🎯 Dificultad: ${testCase.dificultad}`);
    console.log(`   ⏳ Solicitando preguntas...`);

    try {
      const startTime = Date.now();
      const result = await aiService.generateQuestions(
        testCase.tematicas,
        testCase.dificultad,
      );
      const duration = Date.now() - startTime;

      if (!result.success) {
        console.log(`   ❌ Falló: ${result.message}\n`);
        continue;
      }

      console.log(`   ✅ Éxito (${duration}ms)`);
      console.log(`   🤖 IA usada: ${result.aiUsada}`);
      console.log(`   📊 Preguntas generadas: ${result.preguntas.length}`);

      // Validar estructura básica
      let isValid = true;
      for (let i = 0; i < result.preguntas.length; i++) {
        const p = result.preguntas[i];

        if (!p.pregunta || p.pregunta.trim().length < 10) {
          console.log(`   ⚠️  Pregunta ${i + 1}: Texto muy corto o vacío`);
          isValid = false;
        }

        if (!Array.isArray(p.opciones) || p.opciones.length !== 4) {
          console.log(
            `   ⚠️  Pregunta ${i + 1}: Debe tener exactamente 4 opciones`,
          );
          isValid = false;
        }

        if (
          typeof p.respuestaCorrecta !== "number" ||
          p.respuestaCorrecta < 0 ||
          p.respuestaCorrecta > 3
        ) {
          console.log(
            `   ⚠️  Pregunta ${i + 1}: respuestaCorrecta debe ser 0-3`,
          );
          isValid = false;
        }
      }

      if (isValid) {
        passedTests++;
        console.log(`   ✅ Estructura válida\n`);

        // Mostrar ejemplo de la primera pregunta
        if (result.preguntas.length > 0) {
          const ejemplo = result.preguntas[0];
          console.log(`   📝 Ejemplo - Pregunta 1:`);
          console.log(`      "${ejemplo.pregunta.substring(0, 60)}..."`);
          console.log(`      Temática: ${ejemplo.tematica}`);
          console.log(`      Opciones: ${ejemplo.opciones.length}`);
          console.log(
            `      Respuesta correcta: índice ${ejemplo.respuestaCorrecta}\n`,
          );
        }
      } else {
        console.log(`   ⚠️  Estructura con problemas\n`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
  }

  console.log("📊 RESULTADOS FINALES:");
  console.log(`   ✅ Tests pasados: ${passedTests}/${totalTests}`);
  console.log(
    `   📈 Tasa de éxito: ${Math.round((passedTests / totalTests) * 100)}%`,
  );

  if (passedTests === totalTests) {
    console.log(
      "\n🎉 ¡Todos los tests pasaron! El servicio de IA está funcionando correctamente.",
    );
  } else if (passedTests > 0) {
    console.log(
      "\n⚠️  Algunos tests fallaron. Revisa la configuración de las APIs.",
    );
  } else {
    console.log("\n❌ Todos los tests fallaron. Verifica:");
    console.log("   1. GEMINI_API_KEY en .env");
    console.log("   2. Otras claves API para fallback (GROQ, COHERE, HF, OPENROUTER)");
    console.log("   3. Conexión a internet");
  }

  console.log("\n🔧 Para ejecutar tests específicos:");
  console.log(
    "   node tests/test-openrouter.js          (Test solo OpenRouter)",
  );
  console.log(
    "   node tests/test-ai-openrouter.js       (Test integración completo)",
  );
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testAIService().catch((error) => {
    console.error("❌ Error fatal:", error);
    process.exit(1);
  });
}

module.exports = { testAIService };
