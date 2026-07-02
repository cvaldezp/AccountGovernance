namespace AccountGovernance.Application.DTOs;

/// <summary>Response payload for GET /api/auth/me.</summary>
public sealed record MeResponseDto(
    string   Upn,
    string?  DisplayName,
    string?  Email,
    string?  ObjectId,
    string[] Roles
);
