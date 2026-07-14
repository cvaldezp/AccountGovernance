namespace AccountGovernance.Application.DTOs;

public sealed record DistributionListSummaryDto(
    string  Name,
    string? Mail,
    string  Dn
);

public sealed record DistributionListDetailDto(
    string  Name,
    string? Mail,
    string? Description,
    string? ManagerDisplayName,
    int     MemberCount,
    string  Dn
);

public sealed record DistributionListMemberDto(
    string  DisplayName,
    string? Mail,
    string  SamAccountName,
    string  Dn
);

/// <summary>
/// MemberAccount accepts a sAMAccountName, UPN, or mail address — the service resolves
/// whichever form was entered against Active Directory before adding the member.
/// </summary>
public sealed record AddDistributionListMemberRequestDto(
    string ListDn,
    string MemberAccount
);

public sealed record RemoveDistributionListMemberRequestDto(
    string ListDn,
    string MemberDn
);
