// ═══════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════
const DEFAULT_STATE = ()=>({
  stats:{hp:10,atk:2,mnd:0.7,mxd:1.2,spd:3000,rgn:0,ddc:0,crc:0,crd:1.5,arm:0,mth:0,acc:0,ctr:0},
  resources:{old:0,bronze:0,silver:0,gold:0,plat:0},
  victories:{},
  shopOwned:{},
  currentCreature:null,
  blood:0,
  bloodPending:0,
  bloodLifetime:0,
  bloodBankedLifetime:0,   // total blood ever banked via reincarnate (sum of all banks)
  bloodRef:0,        // blood banked at last reincarnation; drives diminishing-gain caps (0 = no cap yet)
  reincarnations:0,
  activeTime:0,
  deaths:0,
  lastSave:Date.now(),
  settings:{lightMode:false,combatLog:true,uiZoom:100,battleNav:'manual',numNotation:'mixed',fontSize:16},
  protocols:{autoChallenge:false,autoRetry:false,autoNext:false,autoBuy:false},
  gameSpeed:1,
  masteryUpgrades:{},
  battleUnlocked:[],
  battleQueue:[],
  spawnRarity:{},
  everMaxed:{},
  // Milestone system
  lifetimeEarned:{old:0},           // persists across reincarnations (only old)
  sessionEarned:{old:0,bronze:0,silver:0,gold:0,plat:0}, // resets on reincarnate (old here is SESSION old, for WELLSPRING; lifetimeEarned.old still drives milestones)
  mCoins:{old:0,bronze:0,silver:0,gold:0,plat:0},  // current M.Coin counts, resets on reincarnate
  mAccum:{old:0,bronze:0,silver:0,gold:0,plat:0},  // M.Coins PRODUCED by the tier above (grows over time, resets on reincarnate)
  codexBonusApplied: 0,  // how many codex bonuses have been applied
  codexUnlocked: {},     // creature ids that have ever granted the codex bonus (persists across reincarnate)
  mOldBest: 0,           // highest M.Old milestone level ever reached (persistent floor; survives reincarnate)

});
let S = DEFAULT_STATE();

// ═══════════════════════════════════════════════════════
// BATTLE STATE
// ═══════════════════════════════════════════════════════
let B = freshBattleState();


const STAT_DEFS=[
  {key:'hp',label:'HP\u00A0',icon:'si-hp',cat:'defense',fmt:'n',desc:'Health Points \u2014 damage you can take before dying.'},
  {key:'atk',label:'ATK',icon:'si-atk',cat:'offense',fmt:'n',desc:'Attack \u2014 base damage dealt per hit.'},
  {key:'mnd',label:'MND',icon:'si-mnd',cat:'offense',fmt:'pct',desc:'Minimum Damage \u2014 lowest % of ATK a hit can deal.'},
  {key:'mxd',label:'MXD',icon:'si-mxd',cat:'offense',fmt:'pct',desc:'Maximum Damage \u2014 highest % of ATK a hit can deal.'},
  {key:'spd',label:'SPD',icon:'si-spd',cat:'utility',fmt:'n',desc:'Speed \u2014 time between actions; lower is faster.'},
  {key:'rgn',label:'RGN',icon:'si-rgn',cat:'defense',fmt:'n',desc:'Regeneration \u2014 HP restored per second.'},
  {key:'ddc',label:'DDC',icon:'si-ddc',cat:'chance',fmt:'pct',desc:'Dodge Chance \u2014 chance to fully avoid an incoming hit.'},
  {key:'crc',label:'CRC',icon:'si-crc',cat:'chance',fmt:'pct',desc:'Critical Chance \u2014 chance for a hit to deal critical damage.'},
  {key:'crd',label:'CRD',icon:'si-crd',cat:'offense',fmt:'x',desc:'Critical Damage \u2014 damage multiplier on a critical hit.'},
  {key:'arm',label:'ARM',icon:'si-arm',cat:'defense',fmt:'n',desc:'Armor \u2014 flat damage reduction on each hit taken.'},
  {key:'mth',label:'MTH',icon:'si-mth',cat:'offense',fmt:'pct',desc:'Multi-Attack Chance \u2014 chance to strike more than once.'},
  {key:'acc',label:'ACC',icon:'si-acc',cat:'chance',fmt:'pct',desc:'Accuracy \u2014 chance for your attack to land.'},
  {key:'ctr',label:'CTR',icon:'si-ctr',cat:'chance',fmt:'pct',desc:'Counter Chance \u2014 chance to strike back when hit.'},
  ];
  // hp = healt points
  // atk = attack
  // mnd = minimal damage
  // mxd = maximal damage
  // spd = speed (time between actions)
  // rgn = regeneration (hp per second)
  // ddc = dodge chance
  // crc = critical hit chance
  // crd = critical hit damage multiplier
  // arm = armor damage reduction flat
  // mth = multi attack chance
  // acc = accuracy (chance to hit)
  // ctr = counter chance

// ── RARITY SYSTEM ─────────────────────────────────────
const RARITY_COLORS={common:'#888',uncommon:'#27ae60',rare:'#2980b9',epic:'#9b59b6',legendary:'#f0b429'};
const RARITY_LABELS={common:'COMMON',uncommon:'UNCOMMON',rare:'RARE',epic:'EPIC',legendary:'LEGENDARY'};
const RARITY_MULTS={common:1,uncommon:1.2,rare:1.6,epic:2,legendary:3};
const RARITY_BG={common:'rgba(80,80,80,0.15)',uncommon:'rgba(39,174,96,0.4)',rare:'rgba(41,128,185,0.18)',epic:'rgba(155,89,182,0.2)',legendary:'rgba(240,180,41,0.15)'};
// Old coin-paid attunement upgrades — REPLACED by the blood-paid RARITY mastery
// upgrades (rar_uncommon/rar_rare/rar_epic/rar_legendary in mastery.js).
// Kept as an empty array so legacy references (init.js, shop.js) stay valid.
const RARITY_UPGRADES=[];