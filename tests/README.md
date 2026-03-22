Scripts de prueba de IA para el backend de Trivia War
=====================================================

Esta carpeta agrupa los **scripts de prueba manuales** que se usaron para validar
distintas integraciones con APIs de IA (Gemini, Cohere, Hugging Face, Llama 3, etc.).

Ninguno de estos archivos se ejecuta en producción ni está referenciado en los
scripts de `package.json`; se usan únicamente para hacer pruebas puntuales desde
la línea de comandos.

Ejemplos de uso
---------------

Desde la carpeta `backend-server`:

```bash
node tests/test-ai.js
node tests/test-cohere.js
node tests/test-hf.js
node tests/test-llama3.js
node tests/list-models.js
```

Si en el futuro dejas de usar alguno de estos scripts, puedes eliminarlo con
seguridad siempre que no lo estés llamando desde otros scripts o automatizaciones.

