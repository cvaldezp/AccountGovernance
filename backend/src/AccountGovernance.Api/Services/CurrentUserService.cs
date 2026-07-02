using System.Security.Claims;
using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Api.Services;

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor)
    : ICurrentUserService
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public string? UserPrincipalName =>
        Principal?.FindFirstValue("upn")
        ?? Principal?.FindFirstValue("preferred_username");

    public string? Email =>
        Principal?.FindFirstValue("email")
        ?? Principal?.FindFirstValue("preferred_username");

    public string? DisplayName =>
        Principal?.FindFirstValue("name");

    public string? ObjectId =>
        Principal?.FindFirstValue("oid")
        ?? Principal?.FindFirstValue("http://schemas.microsoft.com/identity/claims/objectidentifier");

    public IReadOnlyList<string> Roles =>
        Principal?.FindAll("roles").Select(c => c.Value).ToList()
        ?? (IReadOnlyList<string>)[];

    public bool IsAuthenticated =>
        Principal?.Identity?.IsAuthenticated ?? false;
}
