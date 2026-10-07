namespace AccountGovernance.Domain.Entities;

/// <summary>
/// Módulo, acción o pestaña del portal (gov.AppResources). Lo define el código —
/// cada recurso corresponde a una pantalla/endpoint real — y se siembra desde
/// schema.sql; no se edita desde la UI. Una acción (ParentKey != null) solo es
/// efectiva si el rol también tiene su módulo padre. SystemAdminOnly = no
/// delegable: nunca se otorga a otro rol que no sea SystemAdmin.
/// </summary>
public sealed class AppResource
{
    public string  ResourceKey     { get; init; } = string.Empty;
    public string? ParentKey       { get; init; }
    public string  ResourceType    { get; init; } = string.Empty; // Module | Action | Tab
    public string  DisplayName     { get; init; } = string.Empty;
    public string? Description     { get; init; }
    public int     SortOrder       { get; init; }
    public bool    SystemAdminOnly { get; init; }
    public bool    IsActive        { get; init; }
}
