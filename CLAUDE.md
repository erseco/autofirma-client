@AGENTS.md

## Claude Code

Las instrucciones del proyecto viven en `AGENTS.md`, que este fichero importa
para que las lean por igual Claude Code y el resto de agentes. No dupliques
contenido aquí: añádelo allí.

Los procedimientos recurrentes están como skills en `.agents/skills/`, enlazadas
desde `.claude/skills/`. Antes de envolver una operación de AutoScript, de
adoptar un pin nuevo, de publicar o de depurar la demo, invoca la skill
correspondiente en vez de improvisar el procedimiento.
