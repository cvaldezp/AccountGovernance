using AccountGovernance.Application.Authorization;
using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Application.Services;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;
using Microsoft.Extensions.Logging;
using Moq;

namespace AccountGovernance.Api.Tests;

/// <summary>
/// Incremento C — garantiza que la evaluación de sombra (docs/authorization-engine-increment-c-plan.md)
/// nunca puede influir el resultado real de UpdateAttributeAsync, sea cual sea su
/// resultado o si lanza una excepción. Estas son las pruebas centrales del incremento.
/// </summary>
public sealed class UserServiceShadowEvaluationTests
{
    private const string Sam       = "jperez";
    private const string AdAttr    = "department";
    private const string FieldKey  = "field-department";
    private const string OperatorUpn = "operador@usfq.edu.ec";

    private sealed class Fixture
    {
        public Mock<IAdGateway>               AdGateway   { get; } = new();
        public Mock<IPermissionRepository>    Permissions { get; } = new();
        public Mock<IAuditRepository>         Audit       { get; } = new();
        public Mock<IFieldDefinitionsCache>   FieldCache  { get; } = new();
        public Mock<ISystemAuthorizationService> SystemAuth { get; } = new();
        public Mock<IShadowFieldScopeEvaluator>  Shadow     { get; } = new();
        public Mock<ILogger<UserService>>        Logger     { get; } = new();

        public Fixture()
        {
            var fieldDef = new FieldDefinition
            {
                FieldKey = FieldKey, AdAttributeName = AdAttr, DisplayName = "Departamento",
                FieldType = FieldType.Text, IsActive = true, RequiresAudit = true, DataType = null,
            };
            FieldCache.Setup(c => c.GetActiveAsync(It.IsAny<CancellationToken>())).ReturnsAsync([fieldDef]);

            Permissions
                .Setup(p => p.GetRolePermissionsAsync(It.IsAny<RoleName>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([new RoleFieldPermission
                {
                    RoleName = RoleName.Registro, FieldKey = FieldKey, CanView = true, CanEdit = true, IsActive = true,
                }]);

            var user = new User
            {
                SamAccountName = Sam, DisplayName = "Juan Perez",
                RawAttributes = new Dictionary<string, string?> { [AdAttr] = "Valor Anterior" },
            };
            AdGateway.Setup(a => a.GetUserByAccountAsync(Sam, It.IsAny<CancellationToken>())).ReturnsAsync(user);
            AdGateway
                .Setup(a => a.UpdateUserAttributeAsync(Sam, AdAttr, It.IsAny<string?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            Audit
                .Setup(a => a.AddEntryAsync(It.IsAny<AuditEntry>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync((AuditEntry e, CancellationToken _) => e);

            SystemAuth
                .Setup(s => s.GetUserRolesAsync(OperatorUpn, It.IsAny<CancellationToken>()))
                .ReturnsAsync((IReadOnlyList<string>)["Registro"]);
        }

        public UserService Build() => new(
            AdGateway.Object, Permissions.Object, Audit.Object, FieldCache.Object,
            SystemAuth.Object, Shadow.Object, Logger.Object);
    }

    private static UpdateUserAttributeDto Dto(string newValue) => new(newValue, "Valor Anterior");

    [Fact]
    public async Task ShadowDevuelvePermitido_OperacionRealSigueExitosa()
    {
        var fx = new Fixture();
        fx.Shadow
            .Setup(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), FieldKey, It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ShadowAuthorizationDecision(ShadowAuthorizationOutcome.Permitted, "Registro", []));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
    }

    [Fact]
    public async Task ShadowDevuelveDenegado_OperacionRealSigueExitosaIgual()
    {
        // El caso más importante del incremento: aunque la sombra hubiera "denegado",
        // la operación real (gateada por CanEditFieldAsync, no por la sombra) no cambia.
        var fx = new Fixture();
        fx.Shadow
            .Setup(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), FieldKey, It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ShadowAuthorizationDecision(ShadowAuthorizationOutcome.Denied, null, []));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
        fx.AdGateway.Verify(a => a.UpdateUserAttributeAsync(Sam, AdAttr, "Valor Nuevo", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ShadowLanzaExcepcion_OperacionRealSigueExitosa()
    {
        var fx = new Fixture();
        fx.Shadow
            .Setup(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), FieldKey, It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Fallo simulado de la evaluación de sombra."));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
    }

    [Fact]
    public async Task SystemAuthLanzaExcepcion_OperacionRealSigueExitosa()
    {
        // La excepción puede venir de resolver los roles efectivos, no solo del
        // evaluador — la garantía cubre todo el bloque de sombra, no solo una mitad.
        var fx = new Fixture();
        fx.SystemAuth
            .Setup(s => s.GetUserRolesAsync(OperatorUpn, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Fallo simulado resolviendo roles."));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
        fx.Shadow.Verify(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task UsuarioNoEncontrado_LaSombraNuncaSeEjecuta()
    {
        var fx = new Fixture();
        fx.AdGateway.Setup(a => a.GetUserByAccountAsync(Sam, It.IsAny<CancellationToken>())).ReturnsAsync((User?)null);
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.False(result.IsSuccess);
        Assert.Equal("USER_NOT_FOUND", result.ErrorCode);
        fx.Shadow.Verify(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()), Times.Never);
        fx.SystemAuth.Verify(s => s.GetUserRolesAsync(It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SinPermisoDeCampoReal_LaSombraNuncaSeEjecuta()
    {
        // El gate real ya deniega antes de llegar a cargar el usuario — coherente con
        // que la sombra solo aporta señal sobre la población que el gate real permite.
        var fx = new Fixture();
        fx.Permissions
            .Setup(p => p.GetRolePermissionsAsync(RoleName.Registro, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new RoleFieldPermission
            {
                RoleName = RoleName.Registro, FieldKey = FieldKey, CanView = true, CanEdit = false, IsActive = true,
            }]);
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        fx.AdGateway.Verify(a => a.GetUserByAccountAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        fx.Shadow.Verify(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task LaSombraSeLlamaConLosRolesElFieldKeyYLosAtributosDelUsuarioYaCargado()
    {
        var fx = new Fixture();
        fx.Shadow
            .Setup(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ShadowAuthorizationDecision(ShadowAuthorizationOutcome.Permitted, "Registro", []));
        var sut = fx.Build();

        await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        fx.Shadow.Verify(s => s.EvaluateAsync(
            It.Is<IReadOnlyList<string>>(roles => roles.Count == 1 && roles[0] == "Registro"),
            FieldKey,
            It.Is<IReadOnlyDictionary<string, string?>>(attrs => attrs[AdAttr] == "Valor Anterior"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NoSeAgregaNingunaConsultaLdapAdicional_SigueSiendoUnaSolaLlamadaAGetUserByAccount()
    {
        var fx = new Fixture();
        fx.Shadow
            .Setup(s => s.EvaluateAsync(It.IsAny<IReadOnlyList<string>>(), It.IsAny<string>(), It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ShadowAuthorizationDecision(ShadowAuthorizationOutcome.Permitted, "Registro", []));
        var sut = fx.Build();

        await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        fx.AdGateway.Verify(a => a.GetUserByAccountAsync(Sam, It.IsAny<CancellationToken>()), Times.Once);
    }
}
