namespace AccountGovernance.Application.DTOs;

public sealed record SystemRoleGroupDto(
    int      Id,
    int      SystemRoleId,
    string   GroupName,
    string   GroupDn,
    string?  GroupObjectGuid,
    string?  GroupSid,
    bool     IsActive,
    DateTime UpdatedAt,
    string?  UpdatedBy
);

public sealed record SystemRoleDto(
    int      Id,
    string   RoleKey,
    string   DisplayName,
    string?  Description,
    int      Priority,
    bool     IsActive,
    DateTime UpdatedAt,
    string?  UpdatedBy,
    IReadOnlyList<SystemRoleGroupDto> Groups
);

/// <summary>Alta de un rol nuevo. RoleKey es la clave técnica e inmutable (ej. "Desarrollo");
/// el rol nace activo, sin grupos AD y sin ningún acceso (fail-closed).</summary>
public sealed record CreateSystemRoleDto(
    string  RoleKey,
    string  DisplayName,
    string? Description,
    int     Priority
);

public sealed record UpdateSystemRoleDto(
    string  DisplayName,
    string? Description,
    int     Priority,
    bool    IsActive
);

public sealed record CreateSystemRoleGroupDto(
    string  GroupName,
    string  GroupDn,
    string? GroupObjectGuid,
    string? GroupSid,
    bool    IsActive = true
);

public sealed record UpdateSystemRoleGroupDto(
    string  GroupName,
    string  GroupDn,
    string? GroupObjectGuid,
    string? GroupSid,
    bool    IsActive
);
