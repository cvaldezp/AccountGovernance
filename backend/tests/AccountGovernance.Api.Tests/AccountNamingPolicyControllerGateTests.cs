using AccountGovernance.Api.Controllers;
using AccountGovernance.Api.Tests.Fakes;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace AccountGovernance.Api.Tests;

/// <summary>
/// Characterization tests for AccountNamingPolicyController — Incremento A.
/// GET is deliberately open to any authenticated user (documented in the controller);
/// only PUT is gated to SystemAdmin. Both facts must survive the refactor unchanged.
/// </summary>
public sealed class AccountNamingPolicyControllerGateTests
{
    private const string ExpectedForbiddenMessage = "Solo el rol SystemAdmin puede administrar la política de nombres de cuenta.";

    private static readonly AccountNamingPolicyDto SampleDto =
        new("a-z0-9", 3, 20, false, false, DateTime.UtcNow, "seed");

    private static readonly UpdateAccountNamingPolicyDto SampleUpdateDto =
        new("a-z0-9", 3, 20, false, false);

    private static (AccountNamingPolicyController Controller, Mock<IAccountNamingPolicyService> Svc) Build(
        IReadOnlyList<string>? roles = null, Exception? throwOnRoles = null)
    {
        var svc  = new Mock<IAccountNamingPolicyService>();
        var auth = new FakeSystemAuthorizationService { Roles = roles ?? [], ThrowOnGetUserRoles = throwOnRoles };
        var currentUser = new FakeCurrentUserService();
        var controller  = new AccountNamingPolicyController(svc.Object, currentUser, auth);
        return (controller, svc);
    }

    public static IEnumerable<object[]> AnyRoleSets =>
    [
        [new string[] { "SystemAdmin" }],
        [new string[] { "Registro" }],
        [new string[] { }],
    ];

    [Theory]
    [MemberData(nameof(AnyRoleSets))]
    public async Task Get_AnyOrNoRole_Returns200AndNeverConsultsAuth(string[] roles)
    {
        var (controller, svc) = Build(roles: roles);
        svc.Setup(s => s.GetAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(Result<AccountNamingPolicyDto>.Ok(SampleDto));

        var result = await controller.Get(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
        svc.Verify(s => s.GetAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Update_SystemAdminActive_ReturnsOkAndCallsBackingService()
    {
        var (controller, svc) = Build(roles: ["SystemAdmin"]);
        svc.Setup(s => s.UpdateAsync(SampleUpdateDto, It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(Result<AccountNamingPolicyDto>.Ok(SampleDto));

        var result = await controller.Update(SampleUpdateDto, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
        svc.Verify(s => s.UpdateAsync(SampleUpdateDto, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    public static IEnumerable<object[]> NotSystemAdminRoleSets =>
    [
        [new string[] { "Registro" }],
        [new string[] { }],
        [new string[] { "RolQueNoExiste" }],
    ];

    [Theory]
    [MemberData(nameof(NotSystemAdminRoleSets))]
    public async Task Update_NotSystemAdmin_Returns403AndNeverCallsBackingService(string[] roles)
    {
        var (controller, svc) = Build(roles: roles);

        var result = await controller.Update(SampleUpdateDto, CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal(ExpectedForbiddenMessage, forbidden.GetErrorMessage());
        svc.Verify(s => s.UpdateAsync(It.IsAny<UpdateAccountNamingPolicyDto>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Update_RoleResolutionThrows_ExceptionPropagatesUncaught()
    {
        var failure = new InvalidOperationException("simulated SQL failure resolving active roles");
        var (controller, svc) = Build(throwOnRoles: failure);

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
            () => controller.Update(SampleUpdateDto, CancellationToken.None));

        Assert.Same(failure, thrown);
        svc.Verify(s => s.UpdateAsync(It.IsAny<UpdateAccountNamingPolicyDto>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
