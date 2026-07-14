using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace AccountGovernance.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IUserService,                     UserService>();
        services.AddScoped<IAuditService,                    AuditService>();
        services.AddScoped<IPermissionService,               PermissionService>();
        services.AddScoped<IDashboardService,                DashboardService>();
        services.AddScoped<IAccountCreationService,          AccountCreationService>();
        services.AddScoped<IAccountTypeAdminService,         AccountTypeAdminService>();
        services.AddScoped<IAccountTypeGroupService,         AccountTypeGroupService>();
        services.AddScoped<IGroupAssignmentService,          GroupAssignmentService>();
        services.AddScoped<ISystemRoleService,               SystemRoleService>();
        services.AddScoped<IDistributionListService,         DistributionListService>();
        return services;
    }
}
