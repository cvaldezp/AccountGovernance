using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;
using Moq;

namespace AccountGovernance.Api.Tests.Authorization;

/// <summary>
/// Pantalla Accesos por Rol (fase 2): validaciones de SetAccessAsync, primera vez
/// = INSERT, después solo IsActive, auditoría e invalidación del caché.
/// </summary>
public sealed class RoleResourceAdminServiceTests
{
    private static readonly AppResource[] Catalog =
    [
        new() { ResourceKey = "account-creation",        ResourceType = "Module", DisplayName = "Creación de Cuentas", IsActive = true },
        new() { ResourceKey = "account-creation.create", ResourceType = "Action", DisplayName = "Crear cuenta", ParentKey = "account-creation", IsActive = true },
        new() { ResourceKey = "config.system-roles",     ResourceType = "Module", DisplayName = "Roles y Grupos", SystemAdminOnly = true, IsActive = true },
        new() { ResourceKey = "legacy",                  ResourceType = "Module", DisplayName = "Legacy", IsActive = false },
    ];

    private sealed record Ctx(
        RoleResourceAdminService Svc,
        Mock<IRoleResourceRepository> Repo,
        Mock<IRoleResourceCatalogCache> Cache,
        Mock<IAuditRepository> Audit);

    private static Ctx Build(RoleResourcePermission? existing = null, bool roleActive = true)
    {
        var repo = new Mock<IRoleResourceRepository>();
        repo.Setup(r => r.GetResourcesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(Catalog);
        repo.Setup(r => r.GetPermissionAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(existing);

        var roles = new Mock<ISystemRoleRepository>();
        roles.Setup(r => r.GetByKeyAsync("RRHH", It.IsAny<CancellationToken>()))
             .ReturnsAsync(new SystemRole { Id = 3, RoleKey = "RRHH", DisplayName = "Recursos Humanos", IsActive = roleActive });
        roles.Setup(r => r.GetByKeyAsync("SystemAdmin", It.IsAny<CancellationToken>()))
             .ReturnsAsync(new SystemRole { Id = 1, RoleKey = "SystemAdmin", DisplayName = "Admin", IsActive = true });

        var cache = new Mock<IRoleResourceCatalogCache>();
        var audit = new Mock<IAuditRepository>();
        return new Ctx(new RoleResourceAdminService(repo.Object, roles.Object, cache.Object, audit.Object), repo, cache, audit);
    }

    private static void AssertNothingWritten(Ctx c)
    {
        c.Repo.Verify(r => r.CreatePermissionAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        c.Repo.Verify(r => r.SetPermissionStatusAsync(It.IsAny<int>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        c.Audit.Verify(a => a.AddEntryAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Revoke_ExistingActiveGrant_SetsInactive_Audits_InvalidatesCache()
    {
        var c = Build(new RoleResourcePermission { Id = 42, RoleKey = "RRHH", ResourceKey = "account-creation.create", IsActive = true });

        var result = await c.Svc.SetAccessAsync("RRHH", "account-creation.create", new SetRoleAccessDto(false), "admin@usfq.edu.ec");

        Assert.True(result.IsSuccess);
        Assert.False(result.Data!.Granted);
        c.Repo.Verify(r => r.SetPermissionStatusAsync(42, false, "admin@usfq.edu.ec", It.IsAny<CancellationToken>()), Times.Once);
        c.Cache.Verify(x => x.Invalidate(), Times.Once);
        c.Audit.Verify(a => a.AddEntryAsync(
            It.Is<AuditEntry>(e => e.ActionType == AuditActionType.RoleResourceRevoked && e.TargetUser == "RRHH" && e.FieldKey == "account-creation.create"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Grant_FirstTime_InsertsRow()
    {
        var c = Build(existing: null);

        var result = await c.Svc.SetAccessAsync("RRHH", "account-creation", new SetRoleAccessDto(true), "admin");

        Assert.True(result.IsSuccess);
        c.Repo.Verify(r => r.CreatePermissionAsync(3, "account-creation", "admin", It.IsAny<CancellationToken>()), Times.Once);
        c.Repo.Verify(r => r.SetPermissionStatusAsync(It.IsAny<int>(), It.IsAny<bool>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Grant_PreviouslyRevoked_ReactivatesSameRow()
    {
        var c = Build(new RoleResourcePermission { Id = 7, RoleKey = "RRHH", ResourceKey = "account-creation", IsActive = false });

        var result = await c.Svc.SetAccessAsync("RRHH", "account-creation", new SetRoleAccessDto(true), "admin");

        Assert.True(result.IsSuccess);
        c.Repo.Verify(r => r.SetPermissionStatusAsync(7, true, "admin", It.IsAny<CancellationToken>()), Times.Once);
        c.Repo.Verify(r => r.CreatePermissionAsync(It.IsAny<int>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SystemAdmin_IsFixed()
    {
        var c = Build();

        var result = await c.Svc.SetAccessAsync("SystemAdmin", "account-creation", new SetRoleAccessDto(false), "admin");

        Assert.Equal("SYSTEM_ADMIN_FIXED", result.ErrorCode);
        AssertNothingWritten(c);
    }

    [Fact]
    public async Task SystemAdminOnlyResource_CannotBeDelegated()
    {
        var c = Build();

        var result = await c.Svc.SetAccessAsync("RRHH", "config.system-roles", new SetRoleAccessDto(true), "admin");

        Assert.Equal("NOT_DELEGABLE", result.ErrorCode);
        AssertNothingWritten(c);
    }

    [Theory]
    [InlineData("legacy")]
    [InlineData("no-existe")]
    public async Task InactiveOrUnknownResource_IsRejected(string resourceKey)
    {
        var c = Build();

        var result = await c.Svc.SetAccessAsync("RRHH", resourceKey, new SetRoleAccessDto(true), "admin");

        Assert.Equal("RESOURCE_NOT_FOUND", result.ErrorCode);
        AssertNothingWritten(c);
    }

    [Fact]
    public async Task InactiveRole_IsRejected()
    {
        var c = Build(roleActive: false);

        var result = await c.Svc.SetAccessAsync("RRHH", "account-creation", new SetRoleAccessDto(true), "admin");

        Assert.Equal("ROLE_INACTIVE", result.ErrorCode);
        AssertNothingWritten(c);
    }

    [Fact]
    public async Task NoStateChange_IsRejectedWithoutAudit()
    {
        var c = Build(existing: null);

        var result = await c.Svc.SetAccessAsync("RRHH", "account-creation", new SetRoleAccessDto(false), "admin");

        Assert.Equal("NO_STATE_CHANGE", result.ErrorCode);
        AssertNothingWritten(c);
    }
}
