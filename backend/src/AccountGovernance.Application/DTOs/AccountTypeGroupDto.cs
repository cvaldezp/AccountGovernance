namespace AccountGovernance.Application.DTOs;

public sealed record AccountTypeGroupDto(
    int      Id,
    string   TypeKey,
    string?  SubTypeKey,
    string   GroupName,
    string   GroupDn,
    string?  GroupObjectGuid,
    string?  GroupSid,
    bool     IsCritical,
    bool     ContinueOnFailure,
    bool     IsActive,
    int      SortOrder,
    DateTime UpdatedAt,
    string?  UpdatedBy
);

public sealed record CreateAccountTypeGroupDto(
    string?  SubTypeKey,
    string   GroupName,
    string   GroupDn,
    string?  GroupObjectGuid,
    string?  GroupSid,
    bool     IsCritical        = true,
    bool     ContinueOnFailure = true,
    bool     IsActive          = true,
    int      SortOrder         = 0
);

public sealed record UpdateAccountTypeGroupDto(
    string   GroupName,
    string   GroupDn,
    string?  GroupObjectGuid,
    string?  GroupSid,
    bool     IsCritical,
    bool     ContinueOnFailure,
    bool     IsActive,
    int      SortOrder
);

public sealed record InitialGroupPreviewDto(
    int    Id,
    string GroupName,
    string GroupDn,
    bool   IsCritical,
    bool?  ExistsInAd
);

public sealed record GroupAssignmentResultDto(
    string  GroupName,
    bool    Success,
    string? Error
);

public sealed record ValidateAdGroupRequestDto(string Query);

public sealed record ValidateAdGroupResponseDto(
    bool    IsValid,
    string? GroupName,
    string? Dn,
    string? ObjectGuid,
    string? Sid,
    bool    IsSecurity,
    string? Error
);
