namespace AccountGovernance.Application.DTOs;

public sealed record AdministrativeScopeFilterDto(
    int     Id,
    string  FilterType,
    string  AttributeName,
    string  Operator,
    string? Value,
    bool    IsActive
);

public sealed record AdministrativeScopeDto(
    int      Id,
    string   ScopeKey,
    string   Name,
    string?  Description,
    string?  Category,
    string   BaseDn,
    string   ConnectionProfile,
    bool     IsActive,
    int      Priority,
    string?  CreatedBy,
    string?  UpdatedBy,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<AdministrativeScopeFilterDto> Filters
);

public sealed record CreateAdministrativeScopeDto(
    string  ScopeKey,
    string  Name,
    string? Description,
    string? Category,
    string  BaseDn,
    string? ConnectionProfile,
    int     Priority,
    bool    IsActive = false
);

public sealed record UpdateAdministrativeScopeDto(
    string  Name,
    string? Description,
    string? Category,
    string  BaseDn,
    string? ConnectionProfile,
    int     Priority
);

public sealed record UpdateAdministrativeScopeStatusDto(bool IsActive);

public sealed record CreateAdministrativeScopeFilterDto(
    string  FilterType,
    string  AttributeName,
    string  Operator,
    string? Value,
    bool    IsActive = true
);

public sealed record UpdateAdministrativeScopeFilterDto(
    string  FilterType,
    string  AttributeName,
    string  Operator,
    string? Value,
    bool    IsActive
);
