using System.Security.Claims;
using AccountGovernance.Application.Interfaces;

namespace AccountGovernance.Api.Services;

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor)
    : ICurrentUserService
{
    private const string XmlSoapUpnClaim   = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn";
    private const string XmlSoapEmailClaim = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";
    private const string MsIdentityOidClaim = "http://schemas.microsoft.com/identity/claims/objectidentifier";

    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    private string? FirstClaim(params string[] claimTypes)
    {
        if (Principal is null) return null;
        foreach (var type in claimTypes)
        {
            var value = Principal.FindFirstValue(type);
            if (!string.IsNullOrWhiteSpace(value))
                return value;
        }
        return null;
    }

    public string? UserPrincipalName => FirstClaim(
        "preferred_username", "upn", "unique_name", "email",
        XmlSoapUpnClaim, XmlSoapEmailClaim);

    public string? Email => FirstClaim(
        "email", "preferred_username", XmlSoapEmailClaim);

    public string? DisplayName => FirstClaim("name");

    public string? ObjectId => FirstClaim("oid", MsIdentityOidClaim);

    public IReadOnlyList<string> Roles =>
        Principal?.FindAll("roles").Select(c => c.Value).ToList()
        ?? (IReadOnlyList<string>)[];

    public bool IsAuthenticated =>
        Principal?.Identity?.IsAuthenticated ?? false;
}
