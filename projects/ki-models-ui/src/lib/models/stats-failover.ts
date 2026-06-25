/**
 * v0.18.0 — Failover-Aufschlüsselung (30 Tage, nur `switch_down`).
 * Quelle: `GET {base}/stats/failover-breakdown`. Konsumiert von
 * `<ki-failover-analytics>`.
 */
export interface FailoverByProvider {
  provider: string;
  failovers: number;
}

export interface FailoverByProviderReason {
  provider: string;
  reason: string;
  count: number;
}

export interface FailoverByReason {
  reason: string;
  count: number;
}

export interface FailoverBreakdown {
  byProvider: FailoverByProvider[];
  byProviderReason: FailoverByProviderReason[];
  byReason: FailoverByReason[];
}

/**
 * v0.19.0 — Einzelnes Failover-/Toggle-Event in der Timeline.
 * Quelle: `GET {base}/stats/failover` → `{ recent: [], total30d }`.
 * `type`: switch_down | switch_up | promote_primary | toggle_on | toggle_off.
 */
export interface FailoverEvent {
  type: string;
  fromModel?: string | null;
  toModel?: string | null;
  reason?: string | null;
  cooldownSec?: number | null;
  occurredAt: string;
}

export interface FailoverEvents {
  recent: FailoverEvent[];
  total30d: number;
}