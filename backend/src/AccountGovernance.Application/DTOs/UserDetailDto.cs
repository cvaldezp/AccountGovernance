namespace AccountGovernance.Application.DTOs;

public sealed record UserDetailDto(
    // Identity
    string    SamAccountName,
    string?   CustomBannerID,
    string    DisplayName,
    string?   GivenName,
    string?   Sn,
    string?   Mail,
    string?   UserPrincipalName,

    // Organization
    string?   Company,
    string?   Department,
    string?   Title,
    string?   Manager,
    string?   PhysicalDeliveryOfficeName,

    // Contact
    string?   TelephoneNumber,
    string?   Mobile,
    string?   ExternalEmail,

    // Extension attributes
    string?   ExtensionAttribute1,
    string?   ExtensionAttribute2,
    string?   ExtensionAttribute3,

    // Account state
    int?      UserAccountControl,
    bool      IsEnabled,
    DateTime? WhenCreated,
    DateTime? WhenChanged,
    DateTime? LastLogon,
    string?   DistinguishedName
);
