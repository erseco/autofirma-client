---
id: SDD-0001
titulo: "Cliente TypeScript para AutoScript"
estado: Implementado
fecha: 2026-07-31
adrs: [ADR-0001, ADR-0002]
asistencia_ia:
  herramienta: "Codex"
  modelo: "GPT-5"
---

# SDD-0001: Cliente TypeScript para AutoScript

## Resumen

Crear una capa fina, tipada y comprobable sobre la API callback de AutoScript
1.9.

## Objetivos

- Promesas para firma, cofirma, contrafirma y selección de certificado.
- Conversión de entradas binarias.
- Serialización correcta de parámetros.
- Errores normalizados con detalle nativo.
- Mock público para proyectos consumidores.

## Fuera de alcance

Criptografía, validación de firmas, almacenamiento, UI, descarga de AutoScript e
integraciones específicas de frameworks.

## Diseño

La fachada depende de una interfaz mínima `AutoScriptApi`. El adaptador contiene
la conversión callback-promesa; las utilidades puras normalizan datos; el mock
implementa el contrato `SignatureClient`.

## Seguridad y privacidad

No hay red ni persistencia propias. Los valores de parámetros sustituyen saltos
de línea y las claves ambiguas se rechazan. La aplicación debe validar los
resultados en servidor.

## Compatibilidad

Primera línea `1.9.x`, conforme a ADR-0001.

## Plan de pruebas

Vitest cubre entradas, resultados, errores, operaciones opcionales, configuración
de servlets y serialización. La CI exige cobertura mínima.

## Despliegue

Los tags publican npm con OIDC, crean un tarball y un GitHub Release. `main`
despliega la documentación en GitHub Pages.
