# ADR-001: Router personalizado basado en estado (sin react-router-dom)

**Fecha:** 2026-06-16  
**Estado:** Aceptado

## Contexto

La aplicación necesita navegación entre pantallas en una SPA. La opción estándar en el ecosistema React es `react-router-dom`. Sin embargo, el sistema de permisos requiere que la navegación esté controlada por el rol del usuario y que los parámetros de ruta (como `userId`) se pasen de forma tipada.

## Decisión

Implementar un router mínimo basado en `useState<RouteKey>` + `RouterContext`. `RouteKey` es un union type TypeScript que lista todas las rutas válidas. La navegación con parámetros usa un segundo argumento `params` en la función `navigate()`.

```typescript
type RouteKey = 'dashboard' | 'search' | 'user-detail' | 'audit' | ...;
navigate('user-detail', { userId: sam });
```

`App.tsx` implementa un switch sobre `RouteKey` que renderiza el componente correspondiente.

## Consecuencias

**Ventajas:**
- El compilador garantiza que solo existan rutas declaradas en `RouteKey`
- No hay URLs expuestas en la barra del navegador (conveniente para una herramienta interna)
- Cero dependencias adicionales
- Los parámetros de ruta son tipados y no requieren parsing de strings

**Limitaciones:**
- No hay historial de navegación (back/forward del browser no funciona)
- Deep linking / bookmarks no son posibles
- Si la aplicación creciera a dozens de rutas o necesitara URLs compartibles, habría que migrar a react-router-dom
