using AccountGovernance.Application.DTOs;

namespace AccountGovernance.Application.Services;

public interface IGroupAssignmentService
{
    Task<IReadOnlyList<GroupAssignmentResultDto>> AssignGroupsAsync(
        int               accountTypeId,
        int?              accountSubTypeId,
        string            userDn,
        string            operatorUpn,
        CancellationToken ct);
}
