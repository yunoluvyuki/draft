# Draft Throne — Game Design Document (Living Doc)

> Browser idle/RPG game. No server, no dependencies.
> Save: `localStorage` (key: `draft_throne_save`)

> **This file is the project memory.** Update it after every change so future
> sessions don't need to re-read the whole codebase. Keep it accurate over complete —
> if something is unsure/TODO, mark it as such rather than guessing.

---

## File Map

| File | Contents |
|------|----------|
| `index.html` | All markup: topbar, tabs (Battle/Inventory/Shop/Prestige/Settings), bottom bar panels |
| `style.css` | All styles |
| `state.js` | Game state, DEFAULT_STATE, STAT_DEFS, RARITY system constants |
| `data.js` | CREATURES array, SHOP_ITEMS, SVGs, RESOURCE_LABELS |
| `utils.js` | fmt, fmtStat, fmtTime, toast, getCreature, getVictories, isMaxed, maxHP, formatStat |
| `battle.js` | Battle loop, startBattle, stopBattle, onWin, onLose, updateBattleUI, firePlayerTurn, fireEnemyTurn |
| `render.js` | renderStats, renderBattle, renderShop, renderMastery, renderCodex, updateResources, updateQuintUI |
| `shop.js` | buyShopItem, buyMasteryUpgrade |
| `save.js` | saveGame, loadGame |
| `milestone.js` | milestoneTick, getMilestoneCount, getNextMilestone — Blood Coin generation system |
| `init.js` | Game loop, tab switching, settings, reincarnate, font size override (FS_RULES) |

---

## Tabs

- **BATTLE** — `tab-battle`, `#battle-grid`, `renderBattle()`, 4-column grid, shows all 15 enemy stats
- **INVENTORY** — Codex system (was Glossary), `renderCodex()`, `#codex-grid`
- **SHOP** — `renderShop()`, `buyShopItem()`
- **PRESTIGE** — `tab-archive`, sub-tabs: Treasury (Blood Coin/Reincarnate), Mastery (rarity upgrades)
- **SETTINGS** — font size slider, zoom, combat log toggle

---

## Currency

| Internal key | Display name | Notes |
|---|---|---|
| `old` | **Old Coin** | base resource, from battle rewards |
| `bronze` | **Bronze Coin** | from battle rewards / synth chain |
| `silver` | **Silver Coin** | from synth chain |
| `gold` | **Gold Coin** | from synth chain |
| `plat` | **Platinum Coin** | from synth chain, top of chain |
| `quint` | **Blood Coin** | prestige currency, from milestone system |

**Synthesis chain** (`synthTick`): `plat→gold→silver→bronze→old`, gated behind `S.synthUnlocked` (shop item `synth_chain`).

---

## Milestone System (added 2026-06-15) — `milestone.js`

Blood Coin is generated passively via M.Coins earned by crossing thresholds.

**Thresholds:** `1,024 → 1,024,000 → 1,024,000,000 → ...` (×1000 each step)

| M.Coin | Tracked by | Resets on reincarnate? | Produces |
|---|---|---|---|
| M.Old | Lifetime Old earned (`S.lifetimeEarned.old`) | No (lifetime) | +1 Blood Coin/sec each |
| M.Bronze | Session Bronze earned (`S.sessionEarned.bronze`) | Yes | +1 M.Old equivalent/sec each |
| M.Silver | Session Silver earned | Yes | flows down chain |
| M.Gold | Session Gold earned | Yes | flows down chain |
| M.Plat | Session Plat earned | Yes | flows down chain |

**Production:** All M.Coins ultimately contribute to Blood Coin/sec via chain.
`milestoneTick()` runs every second from `gameLoop` (`frameCount % 30`).

**State fields added:**
- `S.lifetimeEarned = {old: N}` — persists across reincarnations
- `S.sessionEarned = {bronze, silver, gold, plat}` — resets on reincarnate
- `S.mCoins = {old, bronze, silver, gold, plat}` — current M.Coin counts, resets on reincarnate

---

## Rarity System

- `RARITY_MULTS = {common:1, uncommon:1.5, rare:3, epic:6, legendary:15}`
- Each creature's rarity rolled once, persisted in `S.spawnRarity[id]`
- Rewards multiplied by rarity mult + reincarnation mult + decay mult
- `RARITY_UPGRADES` in `state.js` — buyable in Mastery tab

---

## Reward Decay (added 2026-06-15)

Formula: `reward = base_reward / (1 + 0.3 * n)` where `n` = win count for that creature.
Applied in `onWin()` in `battle.js` and displayed on creature cards in `renderBattle()`.
Resets on reincarnation since `S.victories` is wiped.

---

## Player Stats (15 total) — `STAT_DEFS` in `state.js`

| Key | Label | Format | Default | Combat use |
|-----|-------|--------|---------|------------|
| hp | HP | n | 50 | health pool |
| atk | ATK | n | 3 | attack damage |
| mnd | MND | % | 0.7 | damage floor |
| mxd | MXD | % | 1.2 | damage multiplier |
| spd | SPD | n | 0 | not yet wired |
| rgn | RGN | n | 0 | heal per turn |
| ddc | DDC | % | 0 | dodge chance |
| crc | CRC | % | 0 | crit chance |
| crd | CRD | x | 1.0 | crit multiplier |
| arm | ARM | n | 0 | damage reduction |
| mth | MTH | % | 0 | multi-attack chance |
| acc | ACC | % | 1.0 | hit chance |
| blk | BLK | % | 0 | block chance |
| bld | BLD | n | 0 | block flat reduction |
| ctr | CTR | % | 0 | counter chance |

Note: enemy defense stat renamed from `def` to `arm` to match player stat naming.

---

## Damage Formulas

### Player attack
```
miss?  random() > acc        → no damage
crit?  random() < crc
base = max(mnd, atk * mxd - enemy.arm)
dmg  = base * (crit ? crd : 1)
if rgn > 0: playerHP = min(maxHP, playerHP + rgn*2)
```

### Enemy attack
```
dodge?  random() < ddc       → 0 damage
rawDmg  = max(1, enemy.atk / (1 + arm*0.15))
block?  random() < blk       → dmg = max(0, rawDmg - bld)
counter? random() < ctr      → counterDmg applied to enemy
playerHP -= dmg
```

---

## Battle System

- `startBattle(id)` — blocked during `B.dying` (recovery state)
- `onLose()` — sets `B.dying=true`, clears `B.creature`, `S.currentCreature`, calls `renderBattle()`
- Recovery: 10s death timer, then `B.dying=false`, `renderBattle()` restores CHALLENGE buttons
- `stopBattle()` — flee with 5s penalty

---

## Prestige — Reincarnate

- Cost: 100 pending Blood Coin (`S.quintPending`)
- Resets: stats, victories, resources, shop, battleQueue, sessionEarned, mCoins
- Persists: `S.reincarnations`, `S.quintLifetime`, `S.lifetimeEarned.old`
- Bonus: `1 + reincarnations * 0.05` applied to battle rewards

---

## Codex (was Glossary — renamed 2026-06-15)

- Shows unlocked creatures (at least 1 victory) + mystery locked slots
- `renderCodex()` in `render.js`
- All references renamed: `gloss*` → `codex*` in JS/CSS/HTML

---

## UI / Styling Notes

- Font size override system: `FS_RULES` in `init.js`, all sizes set to `14` base
- Default zoom: `120%` (`S.settings.uiZoom`)
- Default font size: `16px` (`S.settings.fontSize`)
- Battle grid: `repeat(4, 1fr)` — always 4 columns
- Stat grid: `repeat(2, 1fr)` — 2 columns
- Creature cards show all 15 stats in a 3-column grid
- Card image: `position:absolute`, fills `card-art` with `object-fit:cover`
- Rarity badge: inline-block above creature name in `card-info`
- ATK stat icon: `attached_assets/img/stat icon image/atk.png`

---

## Font Size Override — `FS_RULES` in `init.js`

All selectors set to base `14`. Key selectors:
`.stat-name` (16), `.stat-val` (17), `.card-name` (16), `.card-info .stat-grid .stat-name` (11), `.card-info .stat-grid .stat-val` (12), `.battle-btn` (14), `#death-overlay .timer` (14).

---

## Removed / Cleaned Up (this session)

- `turn-display` and `battle-status` divs removed from `index.html` and `battle.js`
- `calcGlossaryMult` → `calcCodexMult` (renamed)
- `countStr` removed from creature cards
- Card tagline (`c.tag`) removed from battle cards and battle screen
- `GLOSSARY MULTIPLIER` removed from `FUND_DEFS`

---

## NEXT UPDATE — TODO / Open Items

1. **M.Coin UI** — show milestone progress in Prestige tab (total earned, next threshold, M.Coin counts, Blood Coin/sec rate)
2. **synthTick tracking** — passive synth production should also feed `sessionEarned`
3. **Gold/Platinum battle drops** — currently only from synth chain
4. **`ddc` stat** — code uses `ddc` but readme previously said `dog` — verify combat formula uses correct key
5. **Min/Max Damage display** — cosmetic mismatch with real `mnd` floor
6. **Creature images** — only `hollow_wretch` has artwork
7. **M.Coin second+ milestone rates** — currently undefined, all milestones give +1 M.Coin

---

*Last updated: 2026-06-15*
