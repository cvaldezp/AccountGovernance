# ADR-002: Clean Architecture para el backend ASP.NET Core

**Fecha:** 2026-06-16  
**Estado:** Aceptado

## Contexto

El backend necesita gestionar dos fuentes de datos heterogéneas: Active Directory (LDAP) y SQL Server (config + auditoría). Estas fuentes tienen ciclos de vida y mecanismos de acceso completamente distintos. Se necesita una estructura que aísle la lógica de negocio de la infraestructura y permita testear los servicios sin dependencias externas.

## Decisión

Organizar el backend en 4 proyectos con dependencias unidireccionales:

```
Domain ← Application ← Infrastructure ← Api
```

- **Domain**: entidades puras, enums, sin NuGet externos
- **Application**: interfaces (`IAdGateway`, `IUserService`...), DTOs, servicios, `Result<T>`
- **Infrastructure**: implementaciones (`AdGateway` con LDAP, repositorios con Dapper)
- **Api**: controllers, middleware, Swagger, `Program.cs`

Toda I/O de AD pasa por `IAdGateway`. Los servicios solo conocen la interfaz, nunca la implementación LDAP.

## Consecuencias

**Ventajas:**
- Los servicios son testables inyectando un `IAdGateway` en memoria
- Cambiar de `System.DirectoryServices.Protocols` a otra librería LDAP no afecta a Application ni Domain
- La regla de dependencia la refuerza el compilador: Domain no puede referenciar Infrastructure
- `Result<T>` elimina excepciones como mecanismo de flujo en la capa de servicio

**Limitaciones:**
- Más archivos y proyectos que una arquitectura monolítica
- Mapeo manual entre entidades de dominio y DTOs (sin AutoMapper por decisión intencional)
