namespace AccountGovernance.Application.DTOs;

public sealed record RoleScopeAssignmentDto(
    int      Id,
    string   RoleKey,
    string   ScopeKey,
    bool     IsActive,
    DateTime CreatedAt,
    string?  CreatedBy,
    DateTime UpdatedAt,
    string?  UpdatedBy
);

public sealed record CreateRoleScopeAssignmentDto(string RoleKey, string ScopeKey);

public sealed record UpdateRoleScopeAssignmentStatusDto(bool IsActive);
