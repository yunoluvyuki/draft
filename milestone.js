// ═══════════════════════════════════════════════════════
// MILESTONE SYSTEM
// ═══════════════════════════════════════════════════════

// Milestone thresholds: 1024, 1024*1000, 1024*1000*1000, ...
const MILESTONE_THRESHOLDS = [
  1024,
  1024 * 1000,
  1024 * 1000 * 1000,
  1024 * 1000 * 1000 * 1000,
  1024 * 1000 * 1000 * 1000 * 1000,
];

// How many milestones have been crossed for a given total
function getMilestoneCount(total){
  let count = 0;
  for(let i = 0; i < MILESTONE_THRESHOLDS.length; i++){
    if(total >= MILESTONE_THRESHOLDS[i]) count++;
    else break;
  }
  return count;
}

// ── DIMINISHING BLOOD GAIN ────────────────────────────
// Once this session's bloodPending passes the reference (blood banked last
// reincarnation), gain rate halves at each doubling cap: R×1 → 50%, R×2 → 25%,
// R×4 → 12.5%, ... Halving continues forever (never hits zero).
// First run (bloodRef 0) = no cap, full rate.
function bloodGainMult(){
  const ref = S.bloodRef || 0;
  const pending = S.bloodPending || 0;
  if(ref <= 0 || pending < ref) return 1;        // no reference yet, or below first cap
  const caps = Math.floor(Math.log2(pending / ref)) + 1; // how many caps passed
  return Math.pow(0.5, caps);
}

// ── MILESTONE TICK ────────────────────────────────────
// Called every second from gameLoop
// Updates M.Coin counts and generates Blood Coin
function milestoneTick(){
  if(!S.lifetimeEarned) S.lifetimeEarned = {old:0};
  if(!S.sessionEarned) S.sessionEarned = {bronze:0,silver:0,gold:0,plat:0};
  if(!S.mCoins) S.mCoins = {old:0,bronze:0,silver:0,gold:0,plat:0};
  if(!S.mAccum) S.mAccum = {old:0,bronze:0,silver:0,gold:0,plat:0};

  // Milestone counts (from crossing earning thresholds) — set the chain's "seed" rate.
  S.mCoins.old    = getMilestoneCount(S.lifetimeEarned.old || 0);
  S.mCoins.bronze = getMilestoneCount(S.sessionEarned.bronze || 0);
  S.mCoins.silver = getMilestoneCount(S.sessionEarned.silver || 0);
  S.mCoins.gold   = getMilestoneCount(S.sessionEarned.gold   || 0);
  S.mCoins.plat   = getMilestoneCount(S.sessionEarned.plat   || 0);

  // ── PRODUCTION CHAIN (per tick = per second) ──────────
  // TOTAL of a tier = milestone count + accumulated-from-above.
  // Each tier's TOTAL produces that many of the tier BELOW it per second,
  // accumulating into S.mAccum (which grows until reincarnate).
  // Process top→down so each tier sees the up-to-date total above it.
  // Plat → Gold → Silver → Bronze → Old → Blood.
  const totalPlat   = S.mCoins.plat   + S.mAccum.plat;
  S.mAccum.gold   += totalPlat;

  const totalGold   = S.mCoins.gold   + S.mAccum.gold;
  S.mAccum.silver += totalGold;

  const totalSilver = S.mCoins.silver + S.mAccum.silver;
  S.mAccum.bronze += totalSilver;

  const totalBronze = S.mCoins.bronze + S.mAccum.bronze;
  S.mAccum.old    += totalBronze;

  const totalOld    = S.mCoins.old    + S.mAccum.old;

  // Blood/sec = ACCUMULATED M.Old × M.Old MILESTONE LEVEL (multiplier) × mults.
  // The milestone level scales how much blood each accumulated M.Old is worth
  // (e.g. milestone 2 → each accumulated M.Old = 2 blood/sec).
  // Note: if M.Old milestone level is 0 (under 1024 lifetime Old), blood = 0.
  const bloodQty = S.mAccum.old * S.mCoins.old;
  if(bloodQty > 0){
    const gained = bloodQty
      * (typeof masteryGainMult==='function' ? masteryGainMult('blood') : 1)
      * bloodGainMult();   // diminishing-gain throttle past the reference caps
    S.bloodPending = (S.bloodPending || 0) + gained;
    S.bloodLifetime = (S.bloodLifetime || 0) + gained;
  }
}

// Total M.Coins for a tier (milestone count + accumulated). Used by the UI.
function mCoinTotal(coin){
  const mc = (S.mCoins && S.mCoins[coin]) || 0;
  const ac = (S.mAccum && S.mAccum[coin]) || 0;
  return mc + ac;
}

// Next milestone threshold for display
function getNextMilestone(total){
  for(let i = 0; i < MILESTONE_THRESHOLDS.length; i++){
    if(total < MILESTONE_THRESHOLDS[i]) return MILESTONE_THRESHOLDS[i];
  }
  return null; // all maxed
}

// Called every frame from gameLoop
// Exists to catch newly-earned M.Coins and fire a toast notification.
// Blood Coin generation itself is handled by milestoneTick() every 30 frames.
let _prevMCoinTotal = 0;
function checkBloodMilestone(){
  if(!S.mCoins) return;
  const total = (S.mCoins.old||0)+(S.mCoins.bronze||0)+(S.mCoins.silver||0)+(S.mCoins.gold||0)+(S.mCoins.plat||0);
  if(total > _prevMCoinTotal){
    toast(`★ Milestone reached! Blood Coin flowing faster.`, 3000);
    _prevMCoinTotal = total;
  }
}