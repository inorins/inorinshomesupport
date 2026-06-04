import { PermissionModel } from '../models/Permission.model.js';

/** Full defaults — used when no rule is configured for the user/role. */
const DEFAULTS = {
  canViewHistoricalTickets: true,
  historicalTicketDays: 3650,   // ~10 years = effectively unlimited
  allowedBanks: null,
  canViewOthersOpen: true,
  canViewOthersInProgress: true,
  canViewOthersResolved: true,
  canViewOthersClosed: true,
  canCreateTickets: true,
  canAssignTickets: true,
  canUpdateTickets: true,
  canCloseTickets: true,
  canViewSystemChanges: true,
  canManageSystemChanges: true,
};

/**
 * Resolve effective permissions for a user.
 * Priority: user-specific > department rule > role default > system defaults.
 * Always returns a complete permissions object.
 */
export async function getEffectivePermissions(userId, role, department = null) {
  // 1. User-specific override
  const byUser = await PermissionModel.findByUser(Number(userId));
  if (byUser) return { ...DEFAULTS, ...byUser };

  // 2. Role + department (falls back to role default internally in findByRoleDept)
  const byRole = await PermissionModel.findByRoleDept(role, department || null);
  if (byRole) return { ...DEFAULTS, ...byRole };

  // 3. System defaults — no rules configured, everything is allowed
  return { ...DEFAULTS };
}

/**
 * Filter a list of tickets according to the user's resolved permissions.
 *
 * @param {object[]} tickets
 * @param {object}   sessionUser  - token payload: { id, role, bankDomain, bankName }
 * @param {object}   perms        - result of getEffectivePermissions()
 * @param {string|null} userEmail - full email of the requesting user (from DB lookup)
 */
export function filterTicketsByPermissions(tickets, sessionUser, perms, userEmail = null) {
  let result = tickets;

  // ── 1. Bank restriction ─────────────────────────────────────────────────────
  // applies to all roles; useful for scoping a staff account to a subset of banks
  if (Array.isArray(perms.allowedBanks) && perms.allowedBanks.length > 0) {
    const allowed = new Set(perms.allowedBanks.map((b) => b.toLowerCase()));
    result = result.filter(
      (t) => !t.bankName || allowed.has((t.bankName ?? '').toLowerCase())
    );
  }

  // ── 2. Historical ticket cutoff ─────────────────────────────────────────────
  if (!perms.canViewHistoricalTickets) {
    // Block all history — only tickets created today
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    result = result.filter((t) => new Date(t.createdAt) >= cutoff);
  } else if (perms.historicalTicketDays < 3650) {
    const cutoff = new Date(
      Date.now() - perms.historicalTicketDays * 24 * 60 * 60 * 1000
    );
    result = result.filter((t) => new Date(t.createdAt) >= cutoff);
  }

  // ── 3. "View others' tickets" restrictions ──────────────────────────────────
  const restrictOpen       = !perms.canViewOthersOpen;
  const restrictInProgress = perms.canViewOthersInProgress === false ? true : false;
  const restrictResolved   = !perms.canViewOthersResolved;
  const restrictClosed     = !perms.canViewOthersClosed;

  if (restrictOpen || restrictInProgress || restrictResolved || restrictClosed) {
    result = result.filter((t) => {
      // Determine whether this ticket "belongs to" the requesting user
      let isMine = false;
      if (sessionUser.role === 'inorins') {
        // For staff: "mine" = assigned to me
        isMine = Number(t.assigneeId) === Number(sessionUser.id);
      } else if (userEmail) {
        // For clients: "mine" = I reported it
        isMine = (t.reporterEmail ?? '').toLowerCase() === userEmail.toLowerCase();
      }

      if (isMine) return true;

      if (t.status === 'Open' || t.status === 'Pending Client') return !restrictOpen;
      if (t.status === 'In Progress') return !restrictInProgress;
      if (t.status === 'Resolved') return !restrictResolved;
      if (t.status === 'Closed')   return !restrictClosed;
      return true;
    });
  }

  return result;
}

/** Convenience: true if the session user is the super-admin (bypasses all restrictions). */
export function isSuperAdmin(sessionUser, userEmail) {
  return (userEmail ?? '').toLowerCase() === 'inorins@inorins.com';
}
