using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using Dapper;

namespace AccountGovernance.Infrastructure.Persistence.Repositories;

public sealed class AccountCreationAuditRepository(IDbConnectionFactory dbFactory) : IAccountCreationAuditRepository
{
    private const string Sql = """
        INSERT INTO gov.AccountCreationAudit
            (Operator, AccountTypeKey, SubTypeKey, AccountName, SamAccountName, Upn,
             DisplayName, Company, Description, ExtAttr14, TargetOU, RecoveryEmail,
             Success, ErrorMessage, CreatedAt)
        VALUES
            (@Operator, @AccountTypeKey, @SubTypeKey, @AccountName, @SamAccountName, @Upn,
             @DisplayName, @Company, @Description, @ExtAttr14, @TargetOU, @RecoveryEmail,
             @Success, @ErrorMessage, GETUTCDATE())
        """;

    public async Task LogAsync(AccountCreationAuditEntry entry, CancellationToken ct)
    {
        using var conn = dbFactory.Create();
        await conn.ExecuteAsync(new CommandDefinition(Sql, new
        {
            entry.Operator,
            entry.AccountTypeKey,
            entry.SubTypeKey,
            entry.AccountName,
            entry.SamAccountName,
            entry.Upn,
            entry.DisplayName,
            entry.Company,
            entry.Description,
            entry.ExtAttr14,
            entry.TargetOU,
            entry.RecoveryEmail,
            entry.Success,
            entry.ErrorMessage,
            // Password is NEVER included here
        }, cancellationToken: ct));
    }
}
