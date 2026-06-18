namespace AccountGovernance.Infrastructure.AdGateway;

public sealed class AdGatewayOptions
{
    public const string Section = "ActiveDirectory";

    public required string Server           { get; init; }
    public int             Port             { get; init; } = 389;
    public required string BaseDn           { get; init; }
    public required string Domain           { get; init; }
    public required string Username         { get; init; }
    public required string Password         { get; init; }
    public bool            UseSSL           { get; init; } = false;
    public int             TimeoutSeconds   { get; init; } = 30;
    public int             MaxSearchResults { get; init; } = 100;
}
