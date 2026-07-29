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
/// Incremento D — casos de prueba 1 a 9 de
/// docs/authorization-engine-increment-d-plan.md: el interruptor por rol
/// (Authorization:EnforceScopeOnUpdateAttributeRoles) pasa de "solo auditar"
/// (Incremento C) a "bloquear de verdad" únicamente cuando el rol primario
/// de la operación tiene enforcement activo (IScopeEnforcementPolicy). El
/// caso 10 (normalización de la configuración) está en
/// Authorization/ScopeEnforcementPolicyTests.cs — acá se asume ya
/// normalizado, se mockea directamente IScopeEnforcementPolicy.
/// </summary>
public sealed class UserServiceScopeEnforcementTests
{
    private const string Sam         = "jperez";
    private const string AdAttr      = "department";
    private const string FieldKey    = "field-department";
    private const string OperatorUpn = "operador@usfq.edu.ec";

    private sealed class Fixture
    {
        public Mock<IAdGateway>                  AdGateway        { get; } = new();
        public Mock<IPermissionRepository>       Permissions      { get; } = new();
        public Mock<IAuditRepository>            Audit            { get; } = new();
        public Mock<IFieldDefinitionsCache>      FieldCache       { get; } = new();
        public Mock<ISystemAuthorizationService> SystemAuth       { get; } = new();
        public Mock<IShadowFieldScopeEvaluator>  Shadow           { get; } = new();
        public Mock<IScopeEnforcementPolicy>     ScopeEnforcement { get; } = new();
        public Mock<ILogger<UserService>>        Logger           { get; } = new();

        public Fixture(RoleName primaryRole)
        {
            var fieldDef = new FieldDefinition
            {
                FieldKey = FieldKey, AdAttributeName = AdAttr, DisplayName = "Departamento",
                FieldType = FieldType.Text, IsActive = true, RequiresAudit = true, DataType = null,
            };
            FieldCache.Setup(c => c.GetActiveAsync(It.IsAny<CancellationToken>())).ReturnsAsync([fieldDef]);

            Permissions
                .Setup(p => p.GetRolePermissionsAsync(primaryRole, It.IsAny<CancellationToken>()))
                .ReturnsAsync([new RoleFieldPermission
                {
                    RoleName = primaryRole, FieldKey = FieldKey, CanView = true, CanEdit = true, IsActive = true,
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
                .ReturnsAsync((IReadOnlyList<string>)[primaryRole.ToString()]);
        }

        public UserService Build() => new(
            AdGateway.Object, Permissions.Object, Audit.Object, FieldCache.Object,
            SystemAuth.Object, Shadow.Object, ScopeEnforcement.Object, Logger.Object);
    }

    private static UpdateUserAttributeDto Dto(string newValue) => new(newValue, "Valor Anterior");

    private static void SetupShadowDecision(Fixture fx, ShadowAuthorizationDecision decision) =>
        fx.Shadow
            .Setup(s => s.EvaluateAsync(
                It.IsAny<IReadOnlyList<string>>(), FieldKey,
                It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(decision);

    // Caso 1 — lista de roles habilitados vacía (default): comportamiento
    // idéntico al Incremento C, la sombra nunca bloquea aunque deniegue.
    [Fact]
    public async Task Caso1_SinEnforcement_ShadowDeniega_OperacionRealSigueExitosa()
    {
        var fx = new Fixture(RoleName.Registro);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.Registro)).Returns(false);
        SetupShadowDecision(fx, new ShadowAuthorizationDecision(ShadowAuthorizationOutcome.Denied, null, []));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
    }

    // Caso 2 — rol primario SystemAdmin, aunque DragonHelp también esté
    // habilitado en la lista: sigue permitido por el bypass incondicional.
    // El resolvedor real nunca produce "rol primario DragonHelp + SystemAdmin
    // efectivo" (nota de diseño, Decisión 1) — por eso acá el rol primario es
    // SystemAdmin, no DragonHelp.
    [Fact]
    public async Task Caso2_RolPrimarioSystemAdmin_PermitidoPorBypass_AunqueOtroRolEsteHabilitado()
    {
        var fx = new Fixture(RoleName.SystemAdmin);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.SystemAdmin)).Returns(false);
        SetupShadowDecision(fx, new ShadowAuthorizationDecision(ShadowAuthorizationOutcome.Permitted, "SystemAdmin", []));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.SystemAdmin, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
    }

    // Caso 3 — DragonHelp habilitado, sin SystemAdmin efectivo, ROLE_MATCH: permitido.
    [Fact]
    public async Task Caso3_DragonHelpHabilitado_RoleMatch_Permitido()
    {
        var fx = new Fixture(RoleName.DragonHelp);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.DragonHelp)).Returns(true);
        SetupShadowDecision(fx, new ShadowAuthorizationDecision(ShadowAuthorizationOutcome.Permitted, "DragonHelp", []));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.DragonHelp, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
        fx.AdGateway.Verify(a => a.UpdateUserAttributeAsync(Sam, AdAttr, "Valor Nuevo", It.IsAny<CancellationToken>()), Times.Once);
    }

    // Casos 4, 5 y 6 — DragonHelp habilitado, tres motivos de denegación de
    // ámbito distintos (OUT_OF_SCOPE / NO_ACTIVE_SCOPE_ASSIGNED /
    // SCOPE_ATTRIBUTE_UNAVAILABLE). UserService solo mira decision.Outcome,
    // no el motivo — los tres bloquean exactamente igual; se agrupan acá
    // para dejarlo explícito en vez de triplicar el mismo cuerpo de prueba.
    [Theory]
    [InlineData("OUT_OF_SCOPE")]
    [InlineData("NO_ACTIVE_SCOPE_ASSIGNED")]
    [InlineData("SCOPE_ATTRIBUTE_UNAVAILABLE")]
    public async Task Casos4a6_DragonHelpHabilitado_ShadowDeniega_OperacionBloqueada(string motivo)
    {
        var fx = new Fixture(RoleName.DragonHelp);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.DragonHelp)).Returns(true);
        SetupShadowDecision(fx, new ShadowAuthorizationDecision(
            ShadowAuthorizationOutcome.Denied, null,
            [new ShadowRoleEvaluation("DragonHelp", true, false, [], motivo)]));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.DragonHelp, OperatorUpn);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        Assert.Equal("No tienes permiso para editar este atributo.", result.Error);
        fx.AdGateway.Verify(a => a.UpdateUserAttributeAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Caso 7 — DragonHelp habilitado, excepción durante la evaluación de
    // ámbito: fail-closed (Decisión 3) — bloquea, no deja pasar la operación.
    [Fact]
    public async Task Caso7_DragonHelpHabilitado_ExcepcionEnEvaluacion_FailClosed_Bloquea()
    {
        var fx = new Fixture(RoleName.DragonHelp);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.DragonHelp)).Returns(true);
        fx.Shadow
            .Setup(s => s.EvaluateAsync(
                It.IsAny<IReadOnlyList<string>>(), FieldKey,
                It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Fallo simulado de la evaluación de ámbito."));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.DragonHelp, OperatorUpn);

        Assert.False(result.IsSuccess);
        Assert.Equal("FORBIDDEN", result.ErrorCode);
        fx.AdGateway.Verify(a => a.UpdateUserAttributeAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // Caso 8 — rol primario Registro NO habilitado, aunque DragonHelp sí lo
    // esté: la sombra evalúa y audita igual que siempre, pero nunca bloquea
    // esta operación. Prueba explícita de aislamiento entre roles.
    [Fact]
    public async Task Caso8_RolNoHabilitado_ShadowDeniega_OperacionRealNoSeBloquea()
    {
        var fx = new Fixture(RoleName.Registro);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.Registro)).Returns(false);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.DragonHelp)).Returns(true);
        SetupShadowDecision(fx, new ShadowAuthorizationDecision(
            ShadowAuthorizationOutcome.Denied, null,
            [new ShadowRoleEvaluation("Registro", true, false, [], "OUT_OF_SCOPE")]));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
    }

    // Caso 9 — rol no habilitado + excepción durante la evaluación: se
    // registra, pero la operación real conserva el comportamiento previo
    // (shadow-only). Complementa el caso 7: el fail-closed de la Decisión 3
    // aplica solo al rol habilitado, no globalmente.
    [Fact]
    public async Task Caso9_RolNoHabilitado_ExcepcionEnEvaluacion_NoBloquea()
    {
        var fx = new Fixture(RoleName.Registro);
        fx.ScopeEnforcement.Setup(s => s.IsEnforced(RoleName.Registro)).Returns(false);
        fx.Shadow
            .Setup(s => s.EvaluateAsync(
                It.IsAny<IReadOnlyList<string>>(), FieldKey,
                It.IsAny<IReadOnlyDictionary<string, string?>>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Fallo simulado de la evaluación de ámbito."));
        var sut = fx.Build();

        var result = await sut.UpdateAttributeAsync(Sam, AdAttr, Dto("Valor Nuevo"), RoleName.Registro, OperatorUpn);

        Assert.True(result.IsSuccess);
        Assert.True(result.Data!.Changed);
    }
}
