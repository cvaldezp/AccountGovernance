namespace AccountGovernance.Application.DTOs;

/// <summary>
/// Response payload for GET /api/auth/me.
/// IsAuthorized is the single source of truth the frontend must check before granting
/// access — true only when Roles is non-empty (the user belongs to at least one mapped
/// AD group). PrimaryRole is the single highest-priority role (see
/// ISystemAuthorizationService.ResolvePrimaryRole) — the frontend must consume it as-is
/// and must not re-implement role-priority logic. Permissions = the gov.AppResources keys
/// (modules and actions, e.g. "users", "account-creation.create") the user can access —
/// union across all their roles, every active resource for SystemAdmin
/// (IRoleResourceAccessService). The frontend gates menu, routes and actions on it.
/// </summary>
public sealed record MeResponseDto(
    string   Upn,
    string?  DisplayName,
    string?  Email,
    string?  ObjectId,
    string[] Roles,
    string?  PrimaryRole,
    string[] Permissions,
    bool     IsAuthorized
);
