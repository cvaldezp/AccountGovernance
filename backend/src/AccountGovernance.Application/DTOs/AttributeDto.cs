namespace AccountGovernance.Application.DTOs;

public sealed record AttributeDto(
    string                 FieldKey,
    string                 AdAttributeName,
    string                 DisplayName,
    string                 Description,
    string                 FieldType,
    string?                Category,
    string?                DataType,
    bool                   IsSensitive,
    bool                   RequiresAudit,
    bool                   IsActive,
    int                    SortOrder,
    IReadOnlyList<string>? AllowedValues,
    string?                Placeholder,
    string?                CreatedBy,
    string?                UpdatedBy,
    DateTime               CreatedAt,
    DateTime               UpdatedAt
);

public sealed record CreateAttributeDto(
    string                 FieldKey,
    string                 AdAttributeName,
    string                 DisplayName,
    string?                Description,
    string                 FieldType,
    string?                Category,
    string?                DataType,
    bool                   IsSensitive,
    bool                   RequiresAudit,
    int                    SortOrder,
    IReadOnlyList<string>? AllowedValues,
    string?                Placeholder
);

public sealed record UpdateAttributeDto(
    string                 AdAttributeName,
    string                 DisplayName,
    string?                Description,
    string                 FieldType,
    string?                Category,
    string?                DataType,
    bool                   IsSensitive,
    bool                   RequiresAudit,
    int                    SortOrder,
    IReadOnlyList<string>? AllowedValues,
    string?                Placeholder
);

public sealed record UpdateAttributeStatusDto(bool IsActive);

// ── Permissions matrix — editable cells ──────────────────────────────────────

/// <summary>Tri-state cell value: "None" | "View" | "Edit". Encoding it as a single
/// value instead of separate CanView/CanEdit flags makes the "CanEdit implies
/// CanView" rule structurally impossible to violate.</summary>
public sealed record UpdateRolePermissionDto(string Access);

public sealed record RolePermissionCellDto(string RoleKey, string FieldKey, bool CanView, bool CanEdit);
