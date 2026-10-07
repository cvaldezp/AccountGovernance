namespace AccountGovernance.Application.DTOs;

/// <summary>Columna de la matriz de Accesos por Rol (rol activo de gov.SystemRoles).</summary>
public sealed record RoleAccessRoleDto(
    string RoleKey,
    string DisplayName,
    bool   IsSystemAdmin);

/// <summary>Fila de la matriz: un módulo, acción o pestaña activo de gov.AppResources.</summary>
public sealed record RoleAccessResourceDto(
    string  ResourceKey,
    string? ParentKey,
    string  ResourceType,
    string  DisplayName,
    string? Description,
    int     SortOrder,
    bool    SystemAdminOnly);

/// <summary>Celda otorgada (fila activa en gov.RoleResourcePermissions).</summary>
public sealed record RoleAccessGrantDto(
    string RoleKey,
    string ResourceKey);

public sealed record RoleAccessMatrixDto(
    IReadOnlyList<RoleAccessRoleDto>     Roles,
    IReadOnlyList<RoleAccessResourceDto> Resources,
    IReadOnlyList<RoleAccessGrantDto>    Grants);

public sealed record SetRoleAccessDto(bool Granted);

public sealed record RoleAccessCellDto(
    string RoleKey,
    string ResourceKey,
    bool   Granted);
