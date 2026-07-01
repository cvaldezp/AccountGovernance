using AccountGovernance.Application.DTOs;
using AccountGovernance.Application.Interfaces;
using Microsoft.Extensions.Logging;

namespace AccountGovernance.Application.Services;

public sealed class GroupAssignmentService(
    IAccountTypeGroupRepository      groupRepository,
    IAdGateway                       adGateway,
    ILogger<GroupAssignmentService>  logger
) : IGroupAssignmentService
{
    public async Task<IReadOnlyList<GroupAssignmentResultDto>> AssignGroupsAsync(
        int               accountTypeId,
        int?              accountSubTypeId,
        string            userDn,
        string            operatorUpn,
        CancellationToken ct)
    {
        // [DIAG] Log entry point and params before SQL call
        logger.LogInformation(
            "[AssignGroupsAsync] Fetching groups — accountTypeId={AccountTypeId}, accountSubTypeId={AccountSubTypeId}, userDn={UserDn}",
            accountTypeId, accountSubTypeId, userDn);

        var groups  = await groupRepository.GetForCreationAsync(accountTypeId, accountSubTypeId, ct);

        logger.LogInformation(
            "[AssignGroupsAsync] GetForCreationAsync returned {Count} group(s) for accountTypeId={AccountTypeId}",
            groups.Count, accountTypeId);

        var results = new List<GroupAssignmentResultDto>(groups.Count);

        foreach (var grp in groups)
        {
            bool    assigned   = false;
            string? groupError = null;

            try
            {
                assigned = await adGateway.AddUserToGroupAsync(userDn, grp.GroupDn, ct);
                if (!assigned)
                    groupError = $"AddUserToGroupAsync devolvió false para '{grp.GroupName}'.";
            }
            catch (Exception ex)
            {
                assigned   = false;
                groupError = ex.Message;
            }

            results.Add(new GroupAssignmentResultDto(grp.GroupName, assigned, assigned ? null : groupError));

            logger.LogInformation(
                "Group assignment — Operator: {Operator}, UserDn: {UserDn}, Group: {Group}, Success: {Ok}",
                operatorUpn, userDn, grp.GroupName, assigned);

            if (!assigned && !grp.ContinueOnFailure)
            {
                logger.LogWarning(
                    "Group assignment chain stopped — '{Group}' failed and ContinueOnFailure=false. "
                    + "Remaining groups skipped. Account NOT deleted. UserDn: {UserDn}",
                    grp.GroupName, userDn);
                break;
            }
        }

        return results;
    }
}
