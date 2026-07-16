using AccountGovernance.Application.Interfaces;
using AccountGovernance.Infrastructure.AdGateway;
using AccountGovernance.Infrastructure.Persistence;
using AccountGovernance.Infrastructure.Persistence.Repositories;
using AccountGovernance.Infrastructure.Services;
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

        // Cache — respaldo de IFieldDefinitionsCache (TTL corto, invalidado
        // explícitamente al crear/editar/activar/inactivar un atributo).
        services.AddMemoryCache();

        // Repositories
        services.AddScoped<IAuditRepository,                      AuditRepository>();
        services.AddScoped<IPermissionRepository,                  PermissionRepository>();
        services.AddScoped<IFieldDefinitionsCache,                 FieldDefinitionsCache>();
        services.AddScoped<IAccountTypeRepository,                 AccountTypeRepository>();
        services.AddScoped<IAccountCreationAuditRepository,        AccountCreationAuditRepository>();
        services.AddScoped<IAccountTypeGroupRepository,  AccountTypeGroupRepository>();
        services.AddScoped<IExpirationConfigRepository,  ExpirationConfigRepository>();
        services.AddScoped<ISystemRoleRepository,        SystemRoleRepository>();
        services.AddScoped<ISystemAuthorizationService,  SystemAuthorizationService>();

        return services;
    }
}
