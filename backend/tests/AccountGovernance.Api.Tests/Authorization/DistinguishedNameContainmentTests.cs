using AccountGovernance.Application.Authorization;

namespace AccountGovernance.Api.Tests.Authorization;

public sealed class DistinguishedNameContainmentTests
{
    private const string BaseDn = "OU=Cloud,OU=STUDENTS,OU=USERS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec";

    [Fact]
    public void DnDestinoIgualAlBaseDn_EstaContenido()
    {
        Assert.True(DistinguishedNameContainment.IsUnderBaseDn(BaseDn, BaseDn));
    }

    [Fact]
    public void DnDestinoHijoDirectoDelBaseDn_EstaContenido()
    {
        var candidate = $"CN=Juan Perez,{BaseDn}";
        Assert.True(DistinguishedNameContainment.IsUnderBaseDn(candidate, BaseDn));
    }

    [Fact]
    public void DnDestinoNietoDelBaseDn_EstaContenido()
    {
        var candidate = $"CN=Juan Perez,OU=2026,{BaseDn}";
        Assert.True(DistinguishedNameContainment.IsUnderBaseDn(candidate, BaseDn));
    }

    [Fact]
    public void DnDestinoFueraDelBaseDn_NoEstaContenido()
    {
        var candidate = "CN=Juan Perez,OU=Employees,OU=Cumbaya,DC=usfq,DC=edu,DC=ec";
        Assert.False(DistinguishedNameContainment.IsUnderBaseDn(candidate, BaseDn));
    }

    [Fact]
    public void BaseDnParecidoPeroNoReal_NoDaFalsoPositivoPorSubstring()
    {
        // "OU=Cloud2,..." no debe matchear contra "OU=Cloud,..." — la comparación es
        // por componente completo, nunca por substring.
        var candidate = "CN=Juan Perez,OU=Cloud2,OU=STUDENTS,OU=USERS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec";
        Assert.False(DistinguishedNameContainment.IsUnderBaseDn(candidate, BaseDn));
    }

    [Fact]
    public void DiferenciasDeMayusculasYEspacios_SigueContenido()
    {
        var candidate = "cn=Juan Perez,  ou=cloud , ou=students,ou=users,ou=cumbaya,dc=USFQ,dc=EDU,dc=EC";
        Assert.True(DistinguishedNameContainment.IsUnderBaseDn(candidate, BaseDn));
    }

    [Fact]
    public void DnDestinoMasCortoQueElBaseDn_NoEstaContenido()
    {
        var shorterCandidate = "OU=STUDENTS,OU=USERS,OU=Cumbaya,DC=usfq,DC=edu,DC=ec";
        Assert.False(DistinguishedNameContainment.IsUnderBaseDn(shorterCandidate, BaseDn));
    }
}
