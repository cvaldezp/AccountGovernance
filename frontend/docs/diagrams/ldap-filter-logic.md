# Diagrama — Lógica de Construcción del Filtro LDAP

```mermaid
flowchart TD
    Start([query recibido]) --> Trim[Trim + EscapeLdap RFC 4515]
    Trim --> Base["OR base siempre incluido:\n(CustomBannerID=q)\n(mail=q)\n(userPrincipalName=q)\n(sAMAccountName=q)"]
    Base --> HasAt{¿query\ncontiene @?}

    HasAt -->|Sí| SplitLocal["Extraer localPart = q.Split('@')[0]"]
    SplitLocal --> EmailExpand["Agregar:\n(sAMAccountName=localPart)\n(mail=localPart@usfq.edu.ec)\n(mail=localPart@estud.usfq.edu.ec)\n(UPN=localPart@usfq.edu.ec)\n(UPN=localPart@estud.usfq.edu.ec)"]

    HasAt -->|No| DomainExpand["Agregar:\n(mail=q@usfq.edu.ec)\n(mail=q@estud.usfq.edu.ec)\n(UPN=q@usfq.edu.ec)\n(UPN=q@estud.usfq.edu.ec)"]
    DomainExpand --> LenCheck{¿len(q) ≥ 4?}
    LenCheck -->|Sí| AddPrefix["Agregar:\n(sAMAccountName=q*)"]
    LenCheck -->|No| Build

    EmailExpand --> Build
    AddPrefix --> Build
    Build["Ensamblar:\n(&(objectClass=user)(objectCategory=person)(|...))"]
    Build --> Send["SearchRequest\nSizeLimit = min(maxResults, 20)\nTimeLimit = config.TimeoutSeconds"]
```
