using AccountGovernance.Api.Controllers;
using AccountGovernance.Api.Tests.Fakes;
using AccountGovernance.Application.Common;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace AccountGovernance.Api.Tests;

/// <summary>
/// Characterization tests for PermissionsController — Incremento A.
/// Reads (matrix, attribute catalog, fields/me) are deliberately open to any
/// authenticated user; only the attribute-catalog mutations are gated to
/// SystemAdmin. Both facts must survive the refactor unchanged.
/// </summary>
public sealed class PermissionsControllerGateTests
{
    private const string ExpectedForbiddenMessage = "Solo el rol SystemAdmin puede administrar atributos AD.";

    private static readonly CreateAttributeDto SampleCreateDto =
        new("field-x", "extensionAttribute5", "Campo X", null, "Text", null, null, false, false, 0, null, null);

    private static readonly AttributeDto SampleAttributeDto =
        new("field-x", "extensionAttribute5", "Campo X", "", "Text", null, null, false, false, true, 0, null, null, null, null, DateTime.UtcNow, DateTime.UtcNow);

    private static (PermissionsController Controller, Mock<IPermissionService> Svc) Build(
        IReadOnlyList<string>? roles = null, Exception? throwOnRoles = null)
    {
        var svc  = new Mock<IPermissionService>();
        var auth = new FakeSystemAuthorizationService { Roles = roles ?? [], ThrowOnGetUserRoles = throwOnRoles };
        var currentUser = new FakeCurrentUserService();
        var controller  = new PermissionsController(svc.Object, currentUser, auth);
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
    public async Task GetAllAttributes_AnyOrNoRole_Returns200AndNeverConsultsAuth(string[] roles)
    {
        var (controller, svc) = Build(roles: roles);
        svc.Setup(s => s.GetAllAttributesAsync(It.IsAny<CancellationToken>()))
           .ReturnsAsync(Result<IReadOnlyList<AttributeDto>>.Ok([SampleAttributeDto]));

        var result = await controller.GetAllAttributes(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Equal(200, ok.StatusCode);
        svc.Verify(s => s.GetAllAttributesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateAttribute_SystemAdminActive_ReturnsCreatedAndCallsBackingService()
    {
        var (controller, svc) = Build(roles: ["SystemAdmin"]);
        svc.Setup(s => s.CreateAttributeAsync(SampleCreateDto, It.IsAny<string>(), It.IsAny<CancellationToken>()))
           .ReturnsAsync(Result<AttributeDto>.Ok(SampleAttributeDto));

        var result = await controller.CreateAttribute(SampleCreateDto, CancellationToken.None);

        var created = Assert.IsType<ObjectResult>(result);
        Assert.Equal(201, created.StatusCode);
        svc.Verify(s => s.CreateAttributeAsync(SampleCreateDto, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    public static IEnumerable<object[]> NotSystemAdminRoleSets =>
    [
        [new string[] { "Registro" }],
        [new string[] { }],
        [new string[] { "RolQueNoExiste" }],
    ];

    [Theory]
    [MemberData(nameof(NotSystemAdminRoleSets))]
    public async Task CreateAttribute_NotSystemAdmin_Returns403AndNeverCallsBackingService(string[] roles)
    {
        var (controller, svc) = Build(roles: roles);

        var result = await controller.CreateAttribute(SampleCreateDto, CancellationToken.None);

        var forbidden = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, forbidden.StatusCode);
        Assert.Equal(ExpectedForbiddenMessage, forbidden.GetErrorMessage());
        svc.Verify(s => s.CreateAttributeAsync(It.IsAny<CreateAttributeDto>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task CreateAttribute_RoleResolutionThrows_ExceptionPropagatesUncaught()
    {
        var failure = new InvalidOperationException("simulated SQL failure resolving active roles");
        var (controller, svc) = Build(throwOnRoles: failure);

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
            () => controller.CreateAttribute(SampleCreateDto, CancellationToken.None));

        Assert.Same(failure, thrown);
        svc.Verify(s => s.CreateAttributeAsync(It.IsAny<CreateAttributeDto>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
