namespace AccountGovernance.Application.DTOs;

public sealed record PermissionsMatrixDto(
    IReadOnlyList<PermissionsMatrixRowDto> Fields,
    IReadOnlyList<string>                  Roles
);

public sealed record PermissionsMatrixRowDto(
    string                               FieldKey,
    string                               DisplayName,
    string                               AdAttributeName,
    bool                                 IsSensitive,
    IReadOnlyDictionary<string, FieldAccessDto> ByRole
);

public sealed record FieldAccessDto(bool CanView, bool CanEdit);
