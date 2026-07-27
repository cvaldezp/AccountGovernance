using AccountGovernance.Api.Controllers;
using AccountGovernance.Api.Tests.Fakes;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace AccountGovernance.Api.Tests;

/// <summary>
/// Characterization tests for the SystemAdmin gate on SystemRolesController — Incremento A.
/// Documents current behavior (private IsSystemAdminAsync, GetUserRolesAsync().Contains("SystemAdmin"))
/// so the same suite can be re-run unchanged against the centralized replacement.
/// </summary>
public sealed class SystemRolesControllerGateTests
{
    private const string ExpectedForbiddenMessage = "Solo el rol SystemAdmin puede administrar roles y grupos.";

    private static (SystemRolesController Controller, Mock<ISystemRoleService> Svc, FakeSystemAuthorizationService Auth) Build(
        IReadOnlyList<string>? roles = null, Exception? throwOnRoles = null)
    {
        var svc  = new Mock<ISystemRoleService>();
        var auth = new FakeSystemAuthorizationService { Roles = roles ?? [], ThrowOnGetUserRoles = throwOnRoles };
        var currentUser = new FakeCurrentUserService();
        var controller  = new SystemRolesController(svc.Object, currentUser, auth);
        return (controller, svc, auth);
    }

    [Fact]
    public async Task GetAll_SystemAdminActive_ReturnsOkAndCallsBackingService()
    {
        var (controller, svc, _) = Build(roles: ["SystemAdmin"]);
        svc.Setup(s => s.GetAllAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(Result<IReadOnlyList<SystemRoleDto>>.Ok([]));

        var result = await controller.GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
        svc.Verify(s => s.GetAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    public static IEnumerable<object[]> NotSystemAdminRoleSets =>
    [
        [new string[] { "Registro" }],      // otro rol activo, no SystemAdmin
        [new string[] { }],                  // sin ningún rol resuelto
        [new string[] { "RolQueNoExiste" }], // rol que no corresponde a ningún RoleKey real
    ];

    [Theory]
    [MemberData(nameof(NotSystemAdminRoleSets))]
    public async Task GetAll_NotSystemAdmin_Returns403AndNeverCallsBackingService(string[] roles)
    {
        var (controller, svc, _) = Build(roles: roles);

        var result = await controller.GetAll(CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal(ExpectedForbiddenMessage, forbidden.GetErrorMessage());
        svc.Verify(s => s.GetAllAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetAll_RoleResolutionThrows_ExceptionPropagatesUncaught()
    {
        var failure = new InvalidOperationException(
            "None of the resolved roles [...] are currently active in gov.SystemRoles [...].");
        var (controller, svc, _) = Build(throwOnRoles: failure);

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
            () => controller.GetAll(CancellationToken.None));

        Assert.Same(failure, thrown);
        svc.Verify(s => s.GetAllAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
