namespace AccountGovernance.Domain.Entities;

/// <summary>
/// Otorga un AppResource a un SystemRole (gov.RoleResourcePermissions). Mismo
/// modelo que RoleScopeAssignment: una fila por par (rol, recurso) en toda su
/// vida, sin DELETE — revocar es IsActive=0. SystemAdmin no tiene filas: tiene
/// todos los recursos siempre.
/// </summary>
public sealed class RoleResourcePermission
{
    public int      Id           { get; init; }
    public int      SystemRoleId { get; init; }
    public string   ResourceKey  { get; init; } = string.Empty;
    public bool     IsActive     { get; init; }
    public DateTime CreatedAt    { get; init; }
    public string?  CreatedBy    { get; init; }
    public DateTime UpdatedAt    { get; init; }
    public string?  UpdatedBy    { get; init; }

    // Navigation — populada por JOIN en el repositorio, mismo patrón que
    // RoleScopeAssignment.RoleKey.
    public string   RoleKey      { get; init; } = string.Empty;
}
