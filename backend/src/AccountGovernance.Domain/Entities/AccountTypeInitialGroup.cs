namespace AccountGovernance.Domain.Entities;

public sealed class AccountTypeInitialGroup
{
    public int      Id               { get; set; }
    public int      AccountTypeId    { get; set; }
    public int?     AccountSubTypeId { get; set; }
    public string   GroupName        { get; set; } = string.Empty;
    public string   GroupDn          { get; set; } = string.Empty;
    public string?  GroupObjectGuid  { get; set; }
    public string?  GroupSid         { get; set; }
    public bool     IsCritical       { get; set; }
    public bool     IsActive         { get; set; }
    public int      SortOrder        { get; set; }
    public DateTime CreatedAt        { get; set; }
    public DateTime UpdatedAt        { get; set; }
    public string?  UpdatedBy        { get; set; }

    // Navigation — populated by repository JOIN queries
    public string   TypeKey    { get; set; } = string.Empty;
    public string?  SubTypeKey { get; set; }
}
