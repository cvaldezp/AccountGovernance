namespace AccountGovernance.Domain.Entities;

public sealed class SystemRole
{
    public int      Id          { get; set; }
    public string   RoleKey     { get; set; } = string.Empty;
    public string   DisplayName { get; set; } = string.Empty;
    public string?  Description { get; set; }
    public int      Priority    { get; set; }
    public bool     IsActive    { get; set; }
    public DateTime CreatedAt   { get; set; }
    public DateTime UpdatedAt   { get; set; }
    public string?  UpdatedBy   { get; set; }
}
