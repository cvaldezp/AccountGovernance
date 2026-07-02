namespace AccountGovernance.Application.Interfaces;

public interface ICurrentUserService
{
    string? UserPrincipalName { get; }
    string? Email             { get; }
    string? DisplayName       { get; }
    string? ObjectId          { get; }
    IReadOnlyList<string> Roles { get; }
    bool IsAuthenticated { get; }
}
