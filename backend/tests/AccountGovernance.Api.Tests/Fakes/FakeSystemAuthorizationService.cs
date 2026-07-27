using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Api.Tests.Fakes;

/// <summary>
/// Test double for ISystemAuthorizationService. Deliberately a hand-written fake
/// (not a strict Moq mock) so the SAME configured state (<see cref="Roles"/> /
/// <see cref="ThrowOnGetUserRoles"/>) drives the identical outcome whether the
/// caller goes through <c>GetUserRolesAsync</c> (today) or the centralized
/// <c>IsSystemAdminAsync</c> added by Incremento A — the fake's implementation of
/// the new member, once added, is a pure derivation of the same fields, not new
/// behavior. This is what lets the Incremento A characterization tests exercise
/// identical scenarios before and after the refactor.
/// </summary>
public sealed class FakeSystemAuthorizationService : ISystemAuthorizationService
{
    /// <summary>Roles returned by GetUserRolesAsync — set per test case.</summary>
    public IReadOnlyList<string> Roles { get; set; } = [];

    /// <summary>When set, GetUserRolesAsync throws this instead of returning Roles —
    /// used to characterize how an unhandled dependency failure (e.g. a SQL error from
    /// SystemRoleRepository, which today is not caught anywhere in the chain) propagates.</summary>
    public Exception? ThrowOnGetUserRoles { get; set; }

    public int GetUserRolesCallCount { get; private set; }

    public Task<IReadOnlyList<string>> GetUserRolesAsync(string? upn, CancellationToken ct = default)
    {
        GetUserRolesCallCount++;
        if (ThrowOnGetUserRoles is not null)
            throw ThrowOnGetUserRoles;
        return Task.FromResult(Roles);
    }

    public Task<string?> ResolvePrimaryRoleAsync(IReadOnlyList<string> roles, CancellationToken ct = default)
        => Task.FromResult(roles.Count > 0 ? roles[0] : null);

    /// <summary>
    /// Added when Incremento A widened ISystemAuthorizationService. Pure derivation of the
    /// same Roles/ThrowOnGetUserRoles fields the pre-refactor tests already configure — not
    /// new behavior, so the "before" test scenarios keep producing the "after" outcome.
    /// </summary>
    public Task<bool> IsSystemAdminAsync(string? upn, CancellationToken ct = default)
    {
        GetUserRolesCallCount++;
        if (ThrowOnGetUserRoles is not null)
            throw ThrowOnGetUserRoles;
        return Task.FromResult(Roles.Contains("SystemAdmin", StringComparer.OrdinalIgnoreCase));
    }
}
