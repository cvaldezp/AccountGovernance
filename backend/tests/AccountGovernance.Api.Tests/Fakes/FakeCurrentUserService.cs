using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Api.Tests.Fakes;

public sealed class FakeCurrentUserService : ICurrentUserService
{
    public string? UserPrincipalName { get; set; } = "operador@example.com";
    public string? Email             { get; set; }
    public string? DisplayName       { get; set; }
    public string? ObjectId          { get; set; }
    public IReadOnlyList<string> Roles { get; set; } = [];
    public bool IsAuthenticated { get; set; } = true;
}
