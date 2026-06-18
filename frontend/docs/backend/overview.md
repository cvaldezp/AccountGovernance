# Backend — Visión General

**Stack:** ASP.NET Core .NET 8 · Dapper · SQL Server · System.DirectoryServices.Protocols · Serilog · Swagger

**Repositorio:** `C:\RepositorioClaude\AccountGovernance.Api`

## Proyectos (Clean Architecture)

```
AccountGovernance.Domain          ← entidades, enums, sin dependencias externas
AccountGovernance.Application     ← interfaces, DTOs, servicios, Result<T>
AccountGovernance.Infrastructure  ← AdGateway (LDAP), repositorios SQL (Dapper)
AccountGovernance.Api             ← controllers, middleware, Program.cs, Swagger
```

## Reglas de dependencia

```
Api → Infrastructure → Application → Domain
```

Domain no depende de nada. Application solo depende de Domain + abstracciones DI.

## Configuración

| Setting | Valor |
|---------|-------|
| Base de datos | `USFQ_AccountManager`, schema `gov` |
| Autenticación SQL | Windows Authentication exclusivo (sin credenciales SQL) |
| CORS | `http://localhost:5173` (Vite dev server) |
| Secrets AD | dotnet user-secrets (`account-governance-api-dev`) |
| Puerto API local | `http://localhost:5000` |

## Patrones

- **`Result<T>`** — todas las operaciones de servicio retornan `Result<T>` con `IsSuccess`, `Data`, `Error`, `ErrorCode`
- **`IAdGateway`** — abstracción sobre LDAP; toda I/O AD pasa por esta interfaz
- **`ExceptionHandlingMiddleware`** — captura excepciones no controladas, expone detalle solo en Development
- **Serilog** — Console + File sinks, request logging middleware
