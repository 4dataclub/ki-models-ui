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