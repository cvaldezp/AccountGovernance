using AccountGovernance.Application.Interfaces;
using AccountGovernance.Infrastructure.AdGateway;
using AccountGovernance.Infrastructure.Persistence;
using AccountGovernance.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AccountGovernance.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration          configuration)
    {
        // AD Gateway
        services.Configure<AdGatewayOptions>(
            configuration.GetSection(AdGatewayOptions.Section));
        services.AddScoped<IAdGateway, AdGateway.AdGateway>();

        // Database
        services.AddSingleton<IDbConnectionFactory, SqlConnectionFactory>();

        // Repositories
        services.AddScoped<IAuditRepository,                AuditRepository>();
        services.AddScoped<IPermissionRepository,            PermissionRepository>();
        services.AddScoped<IAccountTypeRepository,           AccountTypeRepository>();
        services.AddScoped<IAccountCreationAuditRepository,  AccountCreationAuditRepository>();

        return services;
    }
}
