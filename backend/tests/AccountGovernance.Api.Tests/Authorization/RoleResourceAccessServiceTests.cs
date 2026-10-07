using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using AccountGovernance.Domain.Entities;

namespace AccountGovernance.Api.Tests.Authorization;

/// <summary>
/// Reglas de Accesos por Rol (docs/role-module-access-plan.md): bypass de
/// SystemAdmin, unión de roles, acción solo con su módulo padre, recursos
/// inactivos/no delegables nunca otorgados por tabla, rol nuevo sin filas.
/// </summary>
public sealed class RoleResourceAccessServiceTests
{
    private sealed class FakeCatalog(RoleResourceSnapshot snapshot) : IRoleResourceCatalogCache
    {
        public Task<RoleResourceSnapshot> GetSnapshotAsync(CancellationToken ct = default) => Task.FromResult(snapshot);
        public void Invalidate() { }
    }

    private static AppResource Res(string key, int order, string? parent = null, bool adminOnly = false, bool active = true)
        => new() { ResourceKey = key, ParentKey = parent, ResourceType = parent is null ? "Module" : "Action",
                   DisplayName = key, SortOrder = order, SystemAdminOnly = adminOnly, IsActive = active };

    private static RoleResourcePermission Grant(string role, string key)
        => new() { RoleKey = role, ResourceKey = key, IsActive = true };

    private static readonly AppResource[] Catalog =
    [
        Res("dashboard",               10),
        Res("users",                   20),
        Res("account-creation",        30),
        Res("account-creation.create", 31, parent: "account-creation"),
        Res("audit",                   40),
        Res("legacy",                  50, active: false),
        Res("config.system-roles",     140, adminOnly: true),
    ];

    private static RoleResourceAccessService Build(params RoleResourcePermission[] grants)
        => new(new FakeCatalog(new RoleResourceSnapshot(Catalog, grants)));

    [Fact]
    public async Task SystemAdmin_GetsEveryActiveResource_WithoutAnyGrant()
    {
        var allowed = await Build().GetAllowedResourcesAsync(["SystemAdmin"]);

        Assert.Equal(
            ["dashboard", "users", "account-creation", "account-creation.create", "audit", "config.system-roles"],
            allowed);
    }

    [Fact]
    public async Task NoRoles_GetsNothing()
    {
        var allowed = await Build(Grant("RRHH", "dashboard")).GetAllowedResourcesAsync([]);

        Assert.Empty(allowed);
    }

    [Fact]
    public async Task MultipleRoles_GetUnionOfGrants()
    {
        var svc = Build(Grant("RRHH", "dashboard"), Grant("Registro", "audit"));

        var allowed = await svc.GetAllowedResourcesAsync(["RRHH", "Registro"]);

        Assert.Equal(["dashboard", "audit"], allowed);
    }

    [Fact]
    public async Task Action_WithoutParentModule_IsNotEffective()
    {
        var svc = Build(Grant("DragonHelp", "account-creation.create"));

        Assert.False(await svc.HasAccessAsync(["DragonHelp"], "account-creation.create"));
    }

    [Fact]
    public async Task Action_WithParentModule_IsEffective()
    {
        var svc = Build(Grant("RRHH", "account-creation"), Grant("RRHH", "account-creation.create"));

        Assert.True(await svc.HasAccessAsync(["RRHH"], "account-creation.create"));
    }

    [Fact]
    public async Task SystemAdminOnlyResource_IsNeverGrantedByTable()
    {
        var svc = Build(Grant("Seguridades", "config.system-roles"));

        Assert.False(await svc.HasAccessAsync(["Seguridades"], "config.system-roles"));
    }

    [Fact]
    public async Task InactiveResource_IsNeverGranted()
    {
        var svc = Build(Grant("RRHH", "legacy"));

        Assert.False(await svc.HasAccessAsync(["RRHH"], "legacy"));
    }

    [Fact]
    public async Task NewRoleWithoutRows_GetsNothing()
    {
        var svc = Build(Grant("RRHH", "dashboard"));

        Assert.Empty(await svc.GetAllowedResourcesAsync(["Desarrollo"]));
    }

    [Fact]
    public async Task RoleKeyComparison_IsCaseInsensitive()
    {
        var svc = Build(Grant("RRHH", "dashboard"));

        Assert.True(await svc.HasAccessAsync(["rrhh"], "DASHBOARD"));
    }
}
