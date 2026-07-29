using AccountGovernance.Domain.Enums;
using AccountGovernance.Infrastructure.Authorization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace AccountGovernance.Api.Tests.Authorization;

/// <summary>
/// Caso de prueba 10 de docs/authorization-engine-increment-d-plan.md — la
/// normalización de Authorization:EnforceScopeOnUpdateAttributeRoles descrita
/// en la Decisión 1: null → vacía, trim, sin vacíos, sin duplicados,
/// OrdinalIgnoreCase, sin coincidencias parciales, nombres desconocidos no
/// rompen el arranque.
/// </summary>
public sealed class ScopeEnforcementPolicyTests
{
    private static ScopeEnforcementPolicy Build(params string?[] roles) =>
        new(Options.Create(new ScopeEnforcementOptions
        {
            EnforceScopeOnUpdateAttributeRoles = roles!,
        }), Mock.Of<ILogger<ScopeEnforcementPolicy>>());

    [Fact]
    public void ListaVacia_NingunRolEstaHabilitado()
    {
        var sut = Build();

        Assert.False(sut.IsEnforced(RoleName.DragonHelp));
        Assert.False(sut.IsEnforced(RoleName.SystemAdmin));
    }

    [Fact]
    public void ClaveAusenteONull_SeTrataComoListaVacia()
    {
        var sut = new ScopeEnforcementPolicy(
            Options.Create(new ScopeEnforcementOptions { EnforceScopeOnUpdateAttributeRoles = null! }),
            Mock.Of<ILogger<ScopeEnforcementPolicy>>());

        Assert.False(sut.IsEnforced(RoleName.DragonHelp));
    }

    [Fact]
    public void RolEnLaLista_EstaHabilitado()
    {
        var sut = Build("DragonHelp");

        Assert.True(sut.IsEnforced(RoleName.DragonHelp));
        Assert.False(sut.IsEnforced(RoleName.Registro));
    }

    [Fact]
    public void ComparacionEsCaseInsensitive()
    {
        var sut = Build("dragonhelp");

        Assert.True(sut.IsEnforced(RoleName.DragonHelp));
    }

    [Fact]
    public void NoAceptaCoincidenciasParciales()
    {
        var sut = Build("Dragon");

        Assert.False(sut.IsEnforced(RoleName.DragonHelp));
    }

    [Fact]
    public void EntradasConEspacios_SeRecortanAntesDeComparar()
    {
        var sut = Build("  DragonHelp  ");

        Assert.True(sut.IsEnforced(RoleName.DragonHelp));
    }

    [Fact]
    public void EntradasVaciasOBlancas_SeIgnoran()
    {
        var sut = Build("", "   ", "DragonHelp");

        Assert.True(sut.IsEnforced(RoleName.DragonHelp));
    }

    [Fact]
    public void EntradasDuplicadas_NoRompenNadaYSeComportanComoUnaSola()
    {
        var sut = Build("DragonHelp", "dragonhelp", "DRAGONHELP");

        Assert.True(sut.IsEnforced(RoleName.DragonHelp));
        Assert.False(sut.IsEnforced(RoleName.Registro));
    }

    [Fact]
    public void NombreDesconocido_NoRompeElArranqueYNoHabilitaNada()
    {
        // "DragonHlep" (typo) no coincide con ningún RoleName real — el
        // constructor no debe lanzar, y ningún rol real queda habilitado
        // por error.
        var sut = Build("DragonHlep");

        Assert.False(sut.IsEnforced(RoleName.DragonHelp));
        Assert.False(sut.IsEnforced(RoleName.Registro));
        Assert.False(sut.IsEnforced(RoleName.Seguridades));
        Assert.False(sut.IsEnforced(RoleName.RRHH));
        Assert.False(sut.IsEnforced(RoleName.SystemAdmin));
    }
}
