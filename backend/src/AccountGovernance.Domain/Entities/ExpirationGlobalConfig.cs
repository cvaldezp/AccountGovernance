namespace AccountGovernance.Domain.Entities;

/// <summary>Singleton row in gov.ExpirationGlobalConfig — controls which expiration options the operator may choose.</summary>
public sealed class ExpirationGlobalConfig
{
    public int      Id                { get; set; }
    public bool     AllowNoExpiration { get; set; }
    public bool     AllowCustomDate   { get; set; }
    public string   AllowedMonthsCsv  { get; set; } = "1,2,3,6,9,12,18,24,36,48,60";
    public DateTime UpdatedAt         { get; set; }
    public string?  UpdatedBy         { get; set; }
}
