using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace AccountGovernance.Infrastructure.Persistence;

public interface IDbConnectionFactory
{
    IDbConnection Create();
}

/// <summary>
/// Opens SQL Server connections using Windows Authentication (Trusted_Connection=True).
/// No SQL username or password is stored anywhere in the application.
///
/// Identity requirements by host:
///   • dotnet run / dev  — the developer's Windows account must have at least
///                         db_datareader + db_datawriter + EXECUTE on schema gov.
///   • IIS               — grant the App Pool identity (e.g. "IIS AppPool\AccountGov")
///                         or a dedicated domain service account (e.g. USFQ\svc-accountgov)
///                         the same SQL Server permissions.
///                         The App Pool must NOT run as ApplicationPoolIdentity if the SQL
///                         Server is on a different machine; use a domain account instead.
///   • Windows Service   — the service account (LocalSystem / NETWORK SERVICE / domain account)
///                         must be granted SQL access explicitly.
/// </summary>
public sealed class SqlConnectionFactory(IConfiguration configuration) : IDbConnectionFactory
{
    private readonly string _cs =
        configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException("Connection string 'DefaultConnection' is not configured.");

    public IDbConnection Create() => new SqlConnection(_cs);
}
