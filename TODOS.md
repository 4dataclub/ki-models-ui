# ki-models-ui — Offene Todos

> **Source-of-Truth:** `~/obsidian-brain/shared/04 Ressourcen/KI & Automatisierung/Claude Memory/project_next_session.md`
>
> **Pattern:** Jedes 4dataclub-Repo bekommt eine `TODOS.md`.

Stand: 2026-05-16

---

## 🟡 Phase L — Library vervollständigen + npm-publish

> Brain-Master: `feedback_shared_ui_lib.md`. Aktuell L.1-Skeleton committed (`421ba00`),
> 4 von 6 Components da, npm-Publish + EduPro/Switcher-Migration offen.

| # | Task | Datei(en) | Status |
|---|---|---|---|
| L.2 | Fehlende Components ergänzen: `mode-panel` (manual/auto-failover Chain-Editor) + `key-card` | `projects/ki-models-ui/src/lib/components/` | offen |
| L.5 | `npm publish @dataclub/ki-models-ui@0.1.0` + Git-Tag + README mit ASCII-Architektur-Bild (analog llm-cascade-README) | `package.json`, `README.md` | offen |
| L.6 | Doku-Spiegel-Sektion für Konsumenten vorbereiten (Snippets für EduPro + Switcher) | `examples/`, `README.md` | offen |
| L.7 | Sanity-Check-Skript: ein Bugfix → version bump → npm publish → in beiden Konsumenten `npm update` → Fix sichtbar | `scripts/sanity-check.sh` (neu) | offen |

---

## 🟢 Phase N.7 — UI-Spalte „Standort" für lokale KI

> Plan-File: `~/.claude/plans/ich-werde-dir-fragen-lucky-pearl.md` (freigegeben 2026-05-16).
> Lokale KI (Ollama) soll im selben UI-Pattern erscheinen wie Cloud-Provider — User unterscheidet
> per Spalte „Standort" zwischen Cloud / Lokal-Container / Lokal-anderer-Rechner.

| # | Task | Datei(en) | Aufwand |
|---|---|---|---|
| N.7 | `models-table.component.ts`: neue Spalte „Standort" mit Icon (☁️ Cloud / 🖥️ Lokal) + URL als Tooltip | `projects/ki-models-ui/src/lib/components/models-table.component.ts` | 1h |
| N.7 | `add-model-form.component.ts`: Dropdown „Standort" mit 3 Optionen (Cloud / Lokal-dieser-Container / Lokal-anderer-Rechner). Letzte Option zeigt `baseUrl`-Input. | `projects/ki-models-ui/src/lib/components/add-model-form.component.ts` | 1h |
| N.7 | Models-API-Vertrag um optionales Feld `location: 'cloud' \| 'local-container' \| 'local-remote'` + optional `baseUrl` erweitern (read-only Phase N, editable Phase N+1) | `projects/ki-models-ui/src/lib/models/ai-model.ts` | 30min |
| N.7 | Beispiel-Component im `examples/`: zeigt eine Modell-Tabelle mit gemischten Cloud + Lokal Einträgen | `examples/` | 30min |

**Voraussetzung:** L.5 (npm-Publish) durchgegangen oder gleichzeitig — ohne npm-Distribution kein Konsument-Update.

**Phase N+1 (Multi-Host):** UI-Spalte „Standort" wird editierbar, Backend-`AiModelConfig` bekommt
`providerBaseUrl`-Spalte, Health-Check-Badge (grün/rot) pro Host.
