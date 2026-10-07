using AccountGovernance.Api.Controllers;
using AccountGovernance.Api.Tests.Fakes;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace AccountGovernance.Api.Tests;

/// <summary>
/// Tipos de Cuenta y Grupos Iniciales — lectura y escritura exclusivas de
/// SystemAdmin. Antes de este gate cualquier usuario autenticado podía
/// modificar la configuración de tipos de cuenta y los grupos iniciales.
/// </summary>
public sealed class AccountTypeConfigControllerGateTests
{
    private const string ExpectedForbiddenMessage =
        "Solo el rol SystemAdmin puede administrar tipos de cuenta y grupos iniciales.";

    private static (AccountTypeConfigController Controller, Mock<IAccountTypeAdminService> Svc, Mock<IAccountTypeGroupService> GroupSvc) Build(
        IReadOnlyList<string>? roles = null)
    {
        var svc      = new Mock<IAccountTypeAdminService>();
        var groupSvc = new Mock<IAccountTypeGroupService>();
        var auth     = new FakeSystemAuthorizationService { Roles = roles ?? [] };
        var controller = new AccountTypeConfigController(svc.Object, groupSvc.Object, new FakeCurrentUserService(), auth);
        return (controller, svc, groupSvc);
    }

    public static IEnumerable<object[]> NotSystemAdminRoleSets =>
    [
        [new string[] { "Registro" }],
        [new string[] { "RRHH" }],
        [new string[] { }],
        [new string[] { "RolQueNoExiste" }],
    ];

    [Fact]
    public async Task GetAll_SystemAdmin_Returns200()
    {
        var (controller, svc, _) = Build(roles: ["SystemAdmin"]);
        svc.Setup(s => s.GetAllAsync(It.IsAny<bool>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(Result<IReadOnlyList<AccountTypeConfigDto>>.Ok([]));

        var result = await controller.GetAll(activeOnly: false, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        svc.Verify(s => s.GetAllAsync(false, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [MemberData(nameof(NotSystemAdminRoleSets))]
    public async Task GetAll_NotSystemAdmin_Returns403AndNeverCallsBackingService(string[] roles)
    {
        var (controller, svc, _) = Build(roles: roles);

        var result = await controller.GetAll(activeOnly: false, CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal(ExpectedForbiddenMessage, forbidden.GetErrorMessage());
        svc.Verify(s => s.GetAllAsync(It.IsAny<bool>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task DeleteGroup_SystemAdmin_Returns204()
    {
        var (controller, _, groupSvc) = Build(roles: ["SystemAdmin"]);
        groupSvc.Setup(s => s.DeleteGroupAsync(7, It.IsAny<CancellationToken>()))
                .ReturnsAsync(Result<bool>.Ok(true));

        var result = await controller.DeleteGroup(7, CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        groupSvc.Verify(s => s.DeleteGroupAsync(7, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [MemberData(nameof(NotSystemAdminRoleSets))]
    public async Task DeleteGroup_NotSystemAdmin_Returns403AndNeverCallsBackingService(string[] roles)
    {
        var (controller, _, groupSvc) = Build(roles: roles);

        var result = await controller.DeleteGroup(7, CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal(ExpectedForbiddenMessage, forbidden.GetErrorMessage());
        groupSvc.Verify(s => s.DeleteGroupAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Theory]
    [MemberData(nameof(NotSystemAdminRoleSets))]
    public async Task UpdateConfig_NotSystemAdmin_Returns403BeforeValidatingBody(string[] roles)
    {
        var (controller, svc, _) = Build(roles: roles);

        // Body inválido a propósito: el 403 debe ganarle al 400 de validación.
        var result = await controller.UpdateConfig("Estudiante", null!, CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
        svc.Verify(s => s.UpdateConfigAsync(It.IsAny<string>(), It.IsAny<UpdateAccountTypeConfigDto>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
