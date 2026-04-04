require("dotenv").config();

function verifyConfiguration() {
  console.log("🔍 Verificación de Configuración - Trivia War Backend");
  console.log("=====================================================\n");

  const requiredVars = [
    {
      key: "GROQ_API_KEY",
      description: "Plan A - Groq API Key (Primera opción)",
    },
    {
      key: "COHERE_API_KEY",
      description: "Plan B - Cohere API Key (Segunda opción)",
    },
    {
      key: "HF_API_KEY",
      description: "Plan C - Hugging Face API Key (Tercera opción)",
    },
    {
      key: "OPENROUTER_API_KEY",
      description: "Plan D - OpenRouter API Key (Última opción)",
    },
    {
      key: "PORT",
      description: "Puerto del servidor",
      optional: true,
      defaultValue: "3000",
    },
    {
      key: "NODE_ENV",
      description: "Entorno de ejecución",
      optional: true,
      defaultValue: "development",
    },
  ];

  const firebaseVars = [
    {
      key: "FIREBASE_SERVICE_ACCOUNT_PATH",
      description: "Ruta a service-account.json",
    },
    {
      key: "FIREBASE_SERVICE_ACCOUNT_JSON",
      description: "JSON de Firebase como variable",
      optional: true,
    },
  ];

  console.log("📋 Variables de Entorno Requeridas:");
  console.log("-----------------------------------");

  let missingRequired = 0;
  let configured = 0;

  // Verificar variables principales
  for (const variable of requiredVars) {
    const value = process.env[variable.key];
    const isSet = value !== undefined && value !== "";

    if (!isSet && !variable.optional) {
      console.log(`❌ ${variable.key}: FALTANTE - ${variable.description}`);
      missingRequired++;
    } else if (!isSet && variable.optional) {
      console.log(
        `⚠️  ${variable.key}: NO CONFIGURADA (Opcional) - ${variable.description}`,
      );
      console.log(`   Valor por defecto: ${variable.defaultValue}`);
    } else {
      const displayValue = variable.key.includes("KEY")
        ? `${value.substring(0, 10)}...${value.substring(value.length - 4)}`
        : value;
      console.log(`✅ ${variable.key}: CONFIGURADA - ${variable.description}`);
      console.log(`   Valor: ${displayValue}`);
      configured++;
    }
  }

  console.log("\n🔥 Variables de Firebase:");
  console.log("------------------------");

  let firebaseConfigured = false;
  for (const variable of firebaseVars) {
    const value = process.env[variable.key];
    const isSet = value !== undefined && value !== "";

    if (isSet) {
      if (variable.key === "FIREBASE_SERVICE_ACCOUNT_JSON") {
        console.log(`✅ ${variable.key}: CONFIGURADA (JSON directo)`);
      } else {
        console.log(`✅ ${variable.key}: CONFIGURADA`);
        console.log(`   Valor: ${value}`);
      }
      firebaseConfigured = true;
    } else if (!variable.optional) {
      console.log(`❌ ${variable.key}: FALTANTE - ${variable.description}`);
    }
  }

  if (!firebaseConfigured) {
    console.log("⚠️  ADVERTENCIA: Ninguna variable de Firebase configurada");
    console.log("   El backend funcionará en modo fallback para Firebase");
  }

  console.log("\n📊 Resumen de Configuración:");
  console.log("----------------------------");
  console.log(`✅ Variables configuradas: ${configured}`);

  if (missingRequired > 0) {
    console.log(`❌ Variables faltantes: ${missingRequired}`);
    console.log("\n🚨 ACCIONES REQUERIDAS:");
    console.log("1. Crear archivo .env basado en .env.example");
    console.log("2. Configurar al menos una API Key para IA");
    console.log(
      "3. Para producción, configurar todas las variables requeridas",
    );
  } else {
    console.log(
      `⚠️  Variables opcionales no configuradas: ${requiredVars.filter((v) => v.optional && !process.env[v.key]).length}`,
    );
    console.log("\n🎉 ¡Configuración válida!");
    console.log("El backend puede iniciarse con:");
    console.log("   npm start          (producción)");
    console.log("   npm run dev        (desarrollo)");
  }

  console.log("\n🔧 Pruebas Disponibles:");
  console.log("----------------------");
  console.log("Para verificar la conexión con OpenRouter:");
  console.log("   node tests/test-openrouter.js");
  console.log("\nPara test completo del servicio de IA:");
  console.log("   node tests/test-ai.js");
  console.log("\nPara test de integración:");
  console.log("   node tests/test-ai-openrouter.js");

  console.log("\n📝 Notas:");
  console.log("--------");
  console.log(
    "• Orden de planes: Groq (A) → Cohere (B) → HF (C) → OpenRouter (D)",
  );
  console.log(
    "• OpenRouter es la última opción (Plan D) con modelo específico",
  );
  console.log("• Al menos un servicio de IA debe estar configurado");
  console.log("• Para producción, configurar todas las variables requeridas");

  return missingRequired === 0;
}

// Ejecutar verificación si se llama directamente
if (require.main === module) {
  const isConfigured = verifyConfiguration();
  process.exit(isConfigured ? 0 : 1);
}

module.exports = { verifyConfiguration };
