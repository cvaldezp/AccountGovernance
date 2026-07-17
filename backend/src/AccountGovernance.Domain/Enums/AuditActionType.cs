namespace AccountGovernance.Domain.Enums;

public enum AuditActionType
{
    UpdateField,
    EnableAccount,
    DisableAccount,
    DistributionListMemberAdded,
    DistributionListMemberRemoved,
    CreateAttribute,
    UpdateAttribute,
    ActivateAttribute,
    DeactivateAttribute,
    UpdateRolePermission,
    ScopeCreated,
    ScopeUpdated,
    ScopeActivated,
    ScopeDeactivated,
    ScopeFilterCreated,
    ScopeFilterUpdated,
    ScopeFilterDeleted,
}
