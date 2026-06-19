using AccountGovernance.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AccountGovernance.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IUserService,            UserService>();
        services.AddScoped<IAuditService,           AuditService>();
        services.AddScoped<IPermissionService,      PermissionService>();
        services.AddScoped<IDashboardService,       DashboardService>();
        services.AddScoped<IAccountCreationService,  AccountCreationService>();
        services.AddScoped<IAccountTypeAdminService, AccountTypeAdminService>();
        return services;
    }
}
