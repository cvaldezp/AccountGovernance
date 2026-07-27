using AccountGovernance.Api.Controllers;
using AccountGovernance.Api.Tests.Fakes;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace AccountGovernance.Api.Tests;

/// <summary>Characterization tests for the SystemAdmin gate on AdministrativeScopesController — Incremento A.</summary>
public sealed class AdministrativeScopesControllerGateTests
{
    private const string ExpectedForbiddenMessage = "Solo el rol SystemAdmin puede administrar ámbitos administrativos.";

    private static (AdministrativeScopesController Controller, Mock<IAdministrativeScopeService> Svc) Build(
        IReadOnlyList<string>? roles = null, Exception? throwOnRoles = null)
    {
        var svc  = new Mock<IAdministrativeScopeService>();
        var auth = new FakeSystemAuthorizationService { Roles = roles ?? [], ThrowOnGetUserRoles = throwOnRoles };
        var currentUser = new FakeCurrentUserService();
        var controller  = new AdministrativeScopesController(svc.Object, currentUser, auth);
        return (controller, svc);
    }

    [Fact]
    public async Task GetAll_SystemAdminActive_ReturnsOkAndCallsBackingService()
    {
        var (controller, svc) = Build(roles: ["SystemAdmin"]);
        svc.Setup(s => s.GetAllAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(Result<IReadOnlyList<AdministrativeScopeDto>>.Ok([]));

        var result = await controller.GetAll(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
        svc.Verify(s => s.GetAllAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    public static IEnumerable<object[]> NotSystemAdminRoleSets =>
    [
        [new string[] { "Registro" }],
        [new string[] { }],
        [new string[] { "RolQueNoExiste" }],
    ];

    [Theory]
    [MemberData(nameof(NotSystemAdminRoleSets))]
    public async Task GetAll_NotSystemAdmin_Returns403AndNeverCallsBackingService(string[] roles)
    {
        var (controller, svc) = Build(roles: roles);

        var result = await controller.GetAll(CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal(ExpectedForbiddenMessage, forbidden.GetErrorMessage());
        svc.Verify(s => s.GetAllAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task GetAll_RoleResolutionThrows_ExceptionPropagatesUncaught()
    {
        var failure = new InvalidOperationException("simulated SQL failure resolving active roles");
        var (controller, svc) = Build(throwOnRoles: failure);

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
            () => controller.GetAll(CancellationToken.None));

        Assert.Same(failure, thrown);
        svc.Verify(s => s.GetAllAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
}
