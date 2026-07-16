# Diagrama — Flujo de Escritura de Atributos de Usuario

Cubre `PATCH /api/users/{samAccountName}/attributes/{adAttributeName}`. El
flujo de `PATCH /api/users/{samAccountName}/status` (habilitar/deshabilitar
cuenta) es idéntico en las capas de permisos y auditoría — solo difiere en
`AdGateway`, donde en vez de un `Replace`/`Delete` genérico se hace un toggle
del bit `ACCOUNTDISABLE` de `userAccountControl` preservando el resto de flags
(`SetAccountEnabledAsync`, ver `docs/backend/endpoints.md`).

```mermaid
sequenceDiagram
    actor Operator as Operador
    participant Page as UserDetailPage
    participant Api as usersApi.ts
    participant Ctrl as UsersController
    participant Svc as UserService
    participant Cache as IFieldDefinitionsCache
    participant Perm as IPermissionRepository
    participant GW as AdGateway
    participant AD as Active Directory
    participant Audit as IAuditRepository

    Operator->>Page: edita valor, click "Guardar"
    Page->>Api: updateUserAttribute(sam, attr, value, previousValue)
    Api->>Ctrl: PATCH /users/{sam}/attributes/{attr}
    Ctrl->>Ctrl: resuelve rol server-side<br/>(systemAuth.GetUserRolesAsync + ResolvePrimaryRoleAsync)<br/>— nunca desde el body
    Ctrl->>Svc: UpdateAttributeAsync(sam, attr, dto, role, operatorUpn)

    Svc->>Svc: ¿atributo en denylist protegida?
    alt protegido
        Svc-->>Ctrl: Fail("PROTECTED_ATTRIBUTE")
        Ctrl-->>Api: 400
    else no protegido
        Svc->>Cache: GetActiveAsync()
        Cache-->>Svc: FieldDefinition activo (o null)
        alt no existe / inactivo
            Svc-->>Ctrl: Fail("ATTRIBUTE_NOT_FOUND")
            Ctrl-->>Api: 404
        else existe
            Svc->>Perm: GetRolePermissionsAsync(role) — si role != SystemAdmin
            Perm-->>Svc: CanEdit?
            alt sin permiso
                Svc-->>Ctrl: Fail("FORBIDDEN")
                Ctrl-->>Api: 403
            else con permiso
                Svc->>Svc: AttributeValueValidator (DataType)
                Svc->>GW: GetUserByAccountAsync(sam)
                GW->>AD: LDAP search (lee valor actual)
                AD-->>GW: valor actual
                GW-->>Svc: User + RawAttributes[attr]
                Svc->>Svc: previousValue == valor actual?
                alt desactualizado
                    Svc-->>Ctrl: Fail("STALE_VALUE")
                    Ctrl-->>Api: 409
                else vigente
                    Svc->>Svc: valor nuevo == valor actual?
                    alt sin cambios
                        Svc-->>Ctrl: Ok(changed:false) — sin escritura LDAP
                        Ctrl-->>Api: 200
                    else cambia
                        Svc->>GW: UpdateUserAttributeAsync(sam, attr, value)
                        GW->>AD: LDAP ModifyRequest (Replace o Delete)
                        AD-->>GW: ok / error
                        GW-->>Svc: bool
                        Svc->>Audit: AddEntryAsync(UpdateField, ...)
                        Svc-->>Ctrl: Ok(changed:true) / Fail("LDAP_WRITE_FAILED")
                        Ctrl-->>Api: 200 / 502
                    end
                end
            end
        end
    end

    Api-->>Page: resultado
    alt éxito
        Page->>Api: (refreshProfile) GET /api/users/{sam}
        Api-->>Page: UserDetailDto actualizado desde AD real
        Page-->>Operator: mensaje de éxito + valor real en pantalla
    else error
        Page-->>Operator: mensaje de error del backend — valor anterior se conserva, sin mutación optimista
    end
```
