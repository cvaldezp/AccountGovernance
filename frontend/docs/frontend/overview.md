# Frontend — Visión General

**Stack:** React 19 · Vite 8 · TypeScript · CSS custom properties

## Capas de la arquitectura (orden de dependencia)

```
types/index.ts          ← contratos globales (sin dependencias)
config/                 ← roles, permisos, catálogo AD (depende de types)
auth/                   ← AuthContext + useAuth (depende de types)
api/                    ← mockData, fieldConfigApi, auditApi (depende de types)
skills/                 ← operaciones atómicas (depende de api + types)
agents/                 ← orquestación de skills con lógica de negocio
routes/AppRoutes.tsx    ← RouteKey union + RouterContext (state-based, sin react-router)
shared/ui/              ← Design System (sin dependencias de negocio)
components/layout/      ← Layout, Sidebar, RoleSelector
modules/*/              ← Pages (consumen agents + shared/ui)
App.tsx                 ← switch sobre RouteKey
```

## Router

No usa `react-router-dom`. El estado de navegación vive en `RouterContext` como `useState<RouteKey>`. La navegación con parámetros (ej. `userId`) se pasa como segundo argumento a `navigate()`.

```typescript
type RouteKey =
  | 'dashboard' | 'search' | 'user-detail'
  | 'audit' | 'attribute-catalog' | 'permissions-matrix';
```

## Roles y permisos

| Rol | Color |
|-----|-------|
| DragonHelp | azul `#2563eb` |
| Registro | verde `#16a34a` |
| Seguridades | naranja `#ea580c` |
| RRHH | morado `#7c3aed` |

Los permisos por campo AD se definen en `src/config/roleFieldPermissions.ts` y se resuelven mediante `resolveFieldMatrix()` → `FieldConfig[]`.

## Design System (`src/shared/ui/`)

Componentes: `AppButton`, `AppCard`, `AppInput`, `AppTable`, `AppBadge`, `AppPageHeader`

Variables CSS globales: `--ds-brand`, `--ds-neutral-*`, `--ds-font-heading`, `--ds-font-body`, `--ds-font-mono`
