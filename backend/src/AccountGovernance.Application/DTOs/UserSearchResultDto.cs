namespace AccountGovernance.Application.DTOs;

public sealed record UserSearchResultDto(
    string  SamAccountName,
    string  DisplayName,
    string? Email,
    string? Department,
    bool    IsEnabled,
    string? CustomBannerID
);
