namespace AccountGovernance.Domain.Entities;

public sealed class SystemRoleGroup
{
    public int      Id              { get; set; }
    public int      SystemRoleId    { get; set; }
    public string   GroupName       { get; set; } = string.Empty;
    public string   GroupDn         { get; set; } = string.Empty;
    public string?  GroupSid        { get; set; }
    public string?  GroupObjectGuid { get; set; }
    public bool     IsActive        { get; set; }
    public DateTime CreatedAt       { get; set; }
    public DateTime UpdatedAt       { get; set; }
    public string?  UpdatedBy       { get; set; }

    // Navigation — populated by repository JOIN queries
    public string   RoleKey         { get; set; } = string.Empty;
}
