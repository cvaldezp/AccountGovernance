using AccountGovernance.Application.Authorization;
using AccountGovernance.Application.Interfaces;
using AccountGovernance.Domain.Entities;
using AccountGovernance.Domain.Enums;
using Moq;

namespace AccountGovernance.Api.Tests.Authorization;

/// <summary>
/// Casos de prueba de docs/authorization-engine-increment-c-plan.md — orquestación
/// del rol efectivo → permiso de campo (RoleFieldPermissions) → ámbito
/// (Incremento B), con dobles de prueba para los 3 repositorios involucrados.
/// </summary>
public sealed class ShadowFieldScopeEvaluatorTests
{
    private const string FieldKey = "field-department";

    private static RoleFieldPermission Permission(RoleName role, string fieldKey, bool canEdit, bool isActive = true) => new()
    {
        RoleName = role, FieldKey = fieldKey, CanView = true, CanEdit = canEdit, IsActive = isActive,
    };

    private static AdministrativeScope Scope(string scopeKey, bool isActive = true) => new()
    {
        Id = 1, ScopeKey = scopeKey, Name = scopeKey, BaseDn = "OU=Test,DC=usfq,DC=edu,DC=ec", IsActive = isActive,
    };

    private static RoleScopeAssignment Assignment(string roleKey, string scopeKey, bool isActive = true) => new()
    {
        Id = 1, SystemRoleId = 1, AdministrativeScopeId = 1, IsActive = isActive,
        RoleKey = roleKey, ScopeKey = scopeKey,
    };

    private static AdministrativeScopeFilter Filter(string attributeName, ScopeFilterOperator op, string? value) => new()
    {
        Id = 1, AdministrativeScopeId = 1, FilterType = "Test",
        AttributeName = attributeName, Operator = op, Value = value, IsActive = true,
        CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
    };

    private sealed class Fixture
    {
        public Mock<IPermissionRepository>          Permissions { get; } = new();
        public Mock<IRoleScopeAssignmentRepository>  Assignments { get; } = new();
        public Mock<IAdministrativeScopeRepository>  Scopes      { get; } = new();

        public ShadowFieldScopeEvaluator Build() =>
            new(Permissions.Object, Assignments.Object, Scopes.Object);
    }

    [Fact]
    public async Task SystemAdmin_SiempreAutoriza_SinConsultarNadaMasParaEseRol()
    {
        var fx = new Fixture();
        var sut = fx.Build();

        var decision = await sut.EvaluateAsync(["SystemAdmin"], FieldKey, new Dictionary<string, string?>());

        Assert.Equal(ShadowAuthorizationOutcome.Permitted, decision.Outcome);
        Assert.Equal("SystemAdmin", decision.AuthorizedByRole);
        fx.Permissions.Verify(p => p.GetRolePermissionsAsync(It.IsAny<RoleName>(), It.IsAny<CancellationToken>()), Times.Never);
        fx.Assignments.Verify(a => a.GetAllAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RolSinRepresentacionEnEnum_QuedaMarcadoInconsistente_NoAutoriza()
    {
        var fx = new Fixture();
        var sut = fx.Build();

        var decision = await sut.EvaluateAsync(["RolQueNoExisteEnElEnum"], FieldKey, new Dictionary<string, string?>());

        Assert.Equal(ShadowAuthorizationOutcome.Denied, decision.Outcome);
        Assert.Equal("ROLE_UNMAPPED_INCONSISTENT", decision.PerRole.Single().Reason);
    }

    [Fact]
    public async Task SinPermisoDeCampo_NoAutoriza_NoConsultaAmbito()
    {
        var fx = new Fixture();
        fx.Permissions
            .Setup(p => p.GetRolePermissionsAsync(RoleName.Registro, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Permission(RoleName.Registro, FieldKey, canEdit: false)]);
        var sut = fx.Build();

        var decision = await sut.EvaluateAsync(["Registro"], FieldKey, new Dictionary<string, string?>());

        Assert.Equal(ShadowAuthorizationOutcome.Denied, decision.Outcome);
        Assert.Equal("FIELD_NOT_PERMITTED", decision.PerRole.Single().Reason);
        fx.Assignments.Verify(a => a.GetAllAsync(It.IsAny<string?>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConPermisoDeCampoPeroSinAsignacionDeAmbito_NoAutoriza()
    {
        var fx = new Fixture();
        fx.Permissions
            .Setup(p => p.GetRolePermissionsAsync(RoleName.Registro, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Permission(RoleName.Registro, FieldKey, canEdit: true)]);
        fx.Assignments
            .Setup(a => a.GetAllAsync("Registro", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        var sut = fx.Build();

        var decision = await sut.EvaluateAsync(["Registro"], FieldKey, new Dictionary<string, string?>());

        Assert.Equal(ShadowAuthorizationOutcome.Denied, decision.Outcome);
        Assert.Equal("NO_ACTIVE_SCOPE_ASSIGNED", decision.PerRole.Single().Reason);
    }

    [Fact]
    public async Task ConAmbitoQueMatchea_Autoriza()
    {
        var fx = new Fixture();
        fx.Permissions
            .Setup(p => p.GetRolePermissionsAsync(RoleName.Registro, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Permission(RoleName.Registro, FieldKey, canEdit: true)]);
        fx.Assignments
            .Setup(a => a.GetAllAsync("Registro", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Assignment("Registro", "empleados-cloud")]);
        fx.Scopes
            .Setup(s => s.GetByKeyAsync("empleados-cloud", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Scope("empleados-cloud"));
        fx.Scopes
            .Setup(s => s.GetFiltersByScopeKeyAsync("empleados-cloud", It.IsAny<CancellationToken>()))
            .ReturnsAsync([Filter("department", ScopeFilterOperator.Equals, "Cloud")]);
        var sut = fx.Build();

        var attributes = new Dictionary<string, string?> { ["department"] = "Cloud" };
        var decision = await sut.EvaluateAsync(["Registro"], FieldKey, attributes);

        Assert.Equal(ShadowAuthorizationOutcome.Permitted, decision.Outcome);
        Assert.Equal("Registro", decision.AuthorizedByRole);
        Assert.Equal("ROLE_MATCH", decision.PerRole.Single().Reason);
    }

    [Fact]
    public async Task ConAmbitoQueNoMatchea_OutOfScope_NoAutoriza()
    {
        var fx = new Fixture();
        fx.Permissions
            .Setup(p => p.GetRolePermissionsAsync(RoleName.Registro, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Permission(RoleName.Registro, FieldKey, canEdit: true)]);
        fx.Assignments
            .Setup(a => a.GetAllAsync("Registro", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Assignment("Registro", "empleados-cloud")]);
        fx.Scopes
            .Setup(s => s.GetByKeyAsync("empleados-cloud", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Scope("empleados-cloud"));
        fx.Scopes
            .Setup(s => s.GetFiltersByScopeKeyAsync("empleados-cloud", It.IsAny<CancellationToken>()))
            .ReturnsAsync([Filter("department", ScopeFilterOperator.Equals, "Cloud")]);
        var sut = fx.Build();

        var attributes = new Dictionary<string, string?> { ["department"] = "RRHH" };
        var decision = await sut.EvaluateAsync(["Registro"], FieldKey, attributes);

        Assert.Equal(ShadowAuthorizationOutcome.Denied, decision.Outcome);
        Assert.Equal("OUT_OF_SCOPE", decision.PerRole.Single().Reason);
    }

    [Fact]
    public async Task ConAtributoFaltanteParaElFiltro_Unavailable_NoAutoriza()
    {
        var fx = new Fixture();
        fx.Permissions
            .Setup(p => p.GetRolePermissionsAsync(RoleName.Registro, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Permission(RoleName.Registro, FieldKey, canEdit: true)]);
        fx.Assignments
            .Setup(a => a.GetAllAsync("Registro", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Assignment("Registro", "empleados-cloud")]);
        fx.Scopes
            .Setup(s => s.GetByKeyAsync("empleados-cloud", It.IsAny<CancellationToken>()))
            .ReturnsAsync(Scope("empleados-cloud"));
        fx.Scopes
            .Setup(s => s.GetFiltersByScopeKeyAsync("empleados-cloud", It.IsAny<CancellationToken>()))
            .ReturnsAsync([Filter("department", ScopeFilterOperator.Equals, "Cloud")]);
        var sut = fx.Build();

        var decision = await sut.EvaluateAsync(["Registro"], FieldKey, new Dictionary<string, string?>());

        Assert.Equal(ShadowAuthorizationOutcome.Denied, decision.Outcome);
        var roleResult = decision.PerRole.Single();
        Assert.Equal("SCOPE_ATTRIBUTE_UNAVAILABLE", roleResult.Reason);
        Assert.Equal(["department"], roleResult.MissingAttributes);
    }

    [Fact]
    public async Task VariosRolesEfectivos_UnoAutoriza_ResultadoGlobalPermitido()
    {
        // Rol A: campo permitido pero sin ámbito. Rol B: SystemAdmin, siempre autoriza.
        // El resultado global es OR — permitido, y se conserva el detalle de ambos.
        var fx = new Fixture();
        fx.Permissions
            .Setup(p => p.GetRolePermissionsAsync(RoleName.Registro, It.IsAny<CancellationToken>()))
            .ReturnsAsync([Permission(RoleName.Registro, FieldKey, canEdit: true)]);
        fx.Assignments
            .Setup(a => a.GetAllAsync("Registro", null, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        var sut = fx.Build();

        var decision = await sut.EvaluateAsync(["Registro", "SystemAdmin"], FieldKey, new Dictionary<string, string?>());

        Assert.Equal(ShadowAuthorizationOutcome.Permitted, decision.Outcome);
        Assert.Equal("SystemAdmin", decision.AuthorizedByRole);
        Assert.Equal(2, decision.PerRole.Count);
        Assert.Contains(decision.PerRole, r => r.RoleKey == "Registro" && r.Reason == "NO_ACTIVE_SCOPE_ASSIGNED");
        Assert.Contains(decision.PerRole, r => r.RoleKey == "SystemAdmin" && r.Reason == "SYSTEM_ADMIN_BYPASS");
    }

    [Fact]
    public async Task SinRolesEfectivos_Denegado()
    {
        var fx = new Fixture();
        var sut = fx.Build();

        var decision = await sut.EvaluateAsync([], FieldKey, new Dictionary<string, string?>());

        Assert.Equal(ShadowAuthorizationOutcome.Denied, decision.Outcome);
        Assert.Empty(decision.PerRole);
    }
}
