# ADR-004: Windows Authentication exclusivo (sin credenciales SQL)

**Fecha:** 2026-06-16  
**Estado:** Aceptado

## Contexto

El backend necesita conectarse a SQL Server (`USFQ_AccountManager`) en el entorno institucional. La alternativa estándar sería un usuario/contraseña SQL almacenado en `appsettings.json` o variables de entorno. Sin embargo, manejar credenciales SQL introduce riesgo de exposición en repositorios, logs o configuraciones de despliegue.

## Decisión

Usar exclusivamente Windows Authentication para la conexión SQL:

```
Server=D-SQL-DB-10;Database=USFQ_AccountManager;Trusted_Connection=True;TrustServerCertificate=True;
```

No existe ningún `Password=` en ningún archivo de configuración del proyecto. En IIS, la identidad del App Pool (o una cuenta de servicio de dominio) recibe los permisos `db_datareader + db_datawriter + EXECUTE` directamente en SQL Server.

## Consecuencias

**Ventajas:**
- Sin secretos SQL en el repositorio ni en `appsettings`
- La auditoría de acceso SQL se realiza a nivel de cuenta de dominio
- Compatible con las políticas de seguridad institucionales

**Limitaciones:**
- El servidor de aplicaciones debe estar unido al dominio AD
- `ApplicationPoolIdentity` no puede autenticarse a SQL Server remoto — se requiere cuenta de servicio de dominio
- En desarrollo local, el desarrollador debe tener acceso al SQL Server con su cuenta de dominio
- Las credenciales AD para el servicio LDAP sí se gestionan via `dotnet user-secrets` (fuera del repositorio)
