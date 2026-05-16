/**
 * Cascade-Konfiguration: globaler Cooldown-Override (Tri-State).
 *
 * - `null` → default (jedes Modell nutzt seine eigene Cooldown-Logik)
 * - `true` → Cooldown global erzwingen (auch wenn einzelne Modelle nichts haben)
 * - `false` → Cooldown global deaktivieren
 */
export type CooldownOverride = boolean | null;

/** Response von `GET /cascade-config`. */
export interface CascadeConfig {
  cooldownOverride: CooldownOverride;
  /** Effektiver Zustand vom Backend resolved: `default | explicit_on | explicit_off`. */
  effective: 'default' | 'explicit_on' | 'explicit_off';
  /** Wirklich angewendetes Cooldown-Verhalten (boolean nach Resolution). */
  effectiveCooldown: boolean;
}

/** Body für `PUT /cascade-config`. */
export interface CascadeConfigUpdate {
  cooldownOverride: CooldownOverride;
}

/** Modus für die Cascade-Ausführung (für `mode`-Param in generate-Calls). */
export type CascadeMode = 'cascade' | 'rotate' | 'fixed';

/** Auto-Failover-Konfiguration (konsumentenseitig, z.B. Switcher). */
export interface FailoverChain {
  mode: CascadeMode;
  /** Reihenfolge der Modell-IDs (`provider:modelId`) in der Chain. */
  modelIds: string[];
}

/**
 * Ein einzelner Eintrag in der editierbaren Failover-Chain (von
 * `<ki-failover-chain>` konsumiert). Die Komponente arbeitet generisch — was
 * der Konsument mit der geänderten Chain macht (in eine separate Config
 * schreiben wie Switcher, oder cascade-models CRUD wie EduPro) ist Sache des
 * Konsumenten.
 */
export interface ChainEntry {
  provider: string;
  model: string;
}
