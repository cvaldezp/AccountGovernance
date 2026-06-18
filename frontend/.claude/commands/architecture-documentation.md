# ArchitectureDocumentationSkill

Mantiene la documentación técnica del proyecto sincronizada con el código real.

## Carpeta de documentación

```
docs/
├── adr/                    # Architecture Decision Records numerados
├── frontend/               # Documentación del frontend React
├── backend/                # Documentación del backend ASP.NET Core
├── diagrams/               # Diagramas Mermaid
└── changelog.md            # Historial de funcionalidades
```

## Cuándo actualizar (tabla de triggers)

| Se crea o modifica           | Qué actualizar                                              |
|------------------------------|-------------------------------------------------------------|
| Endpoint API nuevo           | `docs/backend/endpoints.md` + `docs/changelog.md`          |
| Pantalla nueva (Page)        | `docs/frontend/pages.md` + `docs/changelog.md`             |
| Agente o Skill frontend      | `docs/frontend/agents-skills.md`                           |
| Servicio backend             | `docs/backend/services.md`                                  |
| Entidad de dominio           | `docs/backend/entities.md`                                  |
| Tabla de base de datos       | `docs/backend/database.md`                                  |
| Flujo nuevo (UI o sistema)   | `docs/diagrams/{nombre-flujo}.md` con diagrama Mermaid      |
| Decisión arquitectónica      | `docs/adr/NNN-{titulo}.md` en formato ADR estándar         |
| Cualquier funcionalidad      | `docs/changelog.md`                                         |

## Reglas de ejecución

1. **Nunca asumir que el archivo ya existe.** Usar `Glob` para verificar antes de escribir.
2. **Leer el archivo actual** con `Read` antes de editarlo — no sobreescribir contenido válido.
3. **La documentación debe reflejar el código real**, no lo que se espera que haga.
4. **Los diagramas Mermaid** deben ser simples: máximo 20 nodos. Si hay más, dividir en diagramas por módulo.
5. **Los ADRs son inmutables** — nunca editar un ADR existente. Si la decisión cambió, crear un ADR nuevo que lo supere.
6. **Toda tarea que añada endpoint / pantalla / entidad / tabla / flujo** debe terminar con documentación actualizada.

## Formato ADR

```markdown
# ADR-NNN: Título de la decisión

**Fecha:** YYYY-MM-DD
**Estado:** Propuesto | Aceptado | Superado por ADR-NNN

## Contexto
Por qué fue necesaria esta decisión.

## Decisión
Qué se decidió y por qué se eligió esta opción sobre las alternativas.

## Consecuencias
Qué implica esta decisión: ventajas, limitaciones, deuda técnica si aplica.
```

## Formato changelog.md

Usar secciones por fecha descendente:

```markdown
## [YYYY-MM-DD]

### Agregado
- Descripción breve de la funcionalidad nueva

### Modificado
- Descripción del cambio

### Corregido
- Descripción del fix
```

## Pasos al invocar esta skill

1. Leer el contexto de la conversación para entender qué cambió.
2. Verificar qué archivos de `docs/` existen (Glob).
3. Identificar qué documentos deben actualizarse según la tabla de triggers.
4. Para flujos nuevos: generar diagrama Mermaid en `docs/diagrams/`.
5. Para decisiones arquitectónicas: crear ADR numerado en `docs/adr/`.
6. Actualizar `docs/changelog.md` con el feature o cambio.
7. Confirmar al usuario qué documentos se crearon o modificaron.
