import type { AuditEntry, AuditFilters } from '../types/audit';
import type { AgentResult } from '../types';
import { getAuditLogs } from '../skills/AuditSkill';

export class AuditAgent {
  async getLogs(filters?: AuditFilters): Promise<AgentResult<AuditEntry[]>> {
    const entries = await getAuditLogs(filters);
    return { success: true, data: entries };
  }

  async getLogsByUser(username: string): Promise<AgentResult<AuditEntry[]>> {
    return this.getLogs({ targetUser: username });
  }

  async getLogsByRole(roleName: AuditFilters['roleName']): Promise<AgentResult<AuditEntry[]>> {
    return this.getLogs({ roleName });
  }
}

export const auditAgent = new AuditAgent();
