namespace AccountGovernance.Application.DTOs;

public sealed record UserDto(
    string    SamAccountName,
    string    DisplayName,
    string?   Email,
    string?   Department,
    string?   JobTitle,
    string?   Office,
    string?   TelephoneNumber,
    string?   ExternalEmail,
    string?   CustomBannerID,
    bool      IsEnabled,
    DateTime? LastLogon,
    string?   DistinguishedName
);
