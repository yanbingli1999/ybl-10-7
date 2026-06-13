import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Beast,
  Bed,
  Staff,
  MedicalRecord,
  Transaction,
  BeastRelationship,
  Notification,
  DiseaseType,
  Severity,
  WeatherType,
  Prescription,
  TreatmentResult,
} from "@/types/game";
import {
  BREEDS,
  HERBS,
  PRESCRIPTIONS,
  INITIAL_STAFF,
  INITIAL_BEDS,
  DISEASE_SYMPTOMS,
  OWNER_NAMES,
  BEAST_NAMES,
  NOTES_SUCCESS,
  NOTES_FAIL,
  DISEASE_NAMES,
  CURSE_SYMBOLS,
  CURSE_SYMPTOMS_EXTRA,
  RITUAL_HOURS,
  STAFF_POSITIONS,
  NEGATIVE_EVENTS,
  CURSE_RITUAL_REQUIREMENT,
} from "@/data/gameData";
import type {
  CurseRitualState,
  RitualHour,
  StaffPosition,
  NegativeEvent,
} from "@/types/game";

const DISEASE_TYPES: DiseaseType[] = [
  "fever", "cold", "poisoning", "fatigue", "fracture",
  "mana_disorder", "curse", "parasite", "dehydration", "allergy",
];

const SEVERITIES: { sev: Severity; hours: number }[] = [
  { sev: "mild", hours: 6 },
  { sev: "moderate", hours: 9 },
  { sev: "severe", hours: 12 },
  { sev: "critical", hours: 14 },
];

const WEATHERS: WeatherType[] = ["sunny", "cloudy", "rainy", "stormy", "misty"];

function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateRandomBeast(day: number, time: number): Beast & { curseSymbolId?: string; extraSymptoms?: string[] } {
  const breed = rand(BREEDS.filter(b => b.rarity <= Math.min(5, 2 + Math.floor(day / 5))));
  const disease = rand(DISEASE_TYPES);
  const sevIdx = Math.min(3, Math.floor(Math.random() * Math.min(4, 1 + Math.floor(day / 4))));
  const severity = SEVERITIES[sevIdx].sev;
  const allSyms = DISEASE_SYMPTOMS[disease];
  const symCount = randomInt(2, 4);
  const picked: string[] = [];
  while (picked.length < symCount) {
    const s = rand(allSyms);
    if (!picked.includes(s)) picked.push(s);
  }

  const beast: Beast & { curseSymbolId?: string; extraSymptoms?: string[] } = {
    id: uid("beast"),
    breedId: breed.id,
    name: rand(BEAST_NAMES),
    age: randomInt(1, 10),
    stage: 0,
    disease,
    severity,
    symptoms: picked,
    trustLevel: randomInt(0, 20),
    waitHours: 0,
    satisfaction: 100,
    ownerName: rand(OWNER_NAMES),
    arrivedAt: time,
  };

  if (disease === "curse") {
    beast.curseSymbolId = rand(CURSE_SYMBOLS).id;
    const extraSymCount = randomInt(1, 2);
    const extraSyms: string[] = [];
    while (extraSyms.length < extraSymCount) {
      const s = rand(CURSE_SYMPTOMS_EXTRA);
      if (!extraSyms.includes(s)) extraSyms.push(s);
    }
    beast.extraSymptoms = extraSyms;
    beast.symptoms = [...beast.symptoms, ...extraSyms];
  }

  return beast;
}

function calcTreatmentHours(severity: Severity, staffBoost: boolean): number {
  const base = SEVERITIES.find(s => s.sev === severity)?.hours ?? 8;
  return staffBoost ? Math.ceil(base * 0.7) : base;
}

export function guessDiseaseFromSymptoms(symptoms: string[]): { disease: DiseaseType; matchRate: number }[] {
  const results: { disease: DiseaseType; matchRate: number }[] = [];
  for (const disease of DISEASE_TYPES) {
    const diseaseSyms = DISEASE_SYMPTOMS[disease];
    const matched = symptoms.filter(s => diseaseSyms.includes(s)).length;
    const matchRate = Math.floor((matched / symptoms.length) * 100);
    results.push({ disease, matchRate });
  }
  return results.sort((a, b) => b.matchRate - a.matchRate);
}

export interface GameState {
  money: number;
  reputation: number;
  currentDay: number;
  currentTime: number;
  weather: WeatherType;
  isPaused: boolean;
  speed: number;
  waitingQueue: Beast[];
  beds: Bed[];
  inventory: Record<string, number>;
  staff: Staff[];
  discoveredBreeds: string[];
  medicalRecords: MedicalRecord[];
  beastRelationships: Record<string, BeastRelationship>;
  transactions: Transaction[];
  notifications: Notification[];
  selectedBeastId: string | null;
  selectedBedId: string | null;
  lastBeastSpawn: number;
  collectedSymbols: string[];
  curseRitual: CurseRitualState;
  bedDisabledUntil: Record<string, number>;
  activeNegativeEvents: NegativeEvent[];

  // Actions
  togglePause: () => void;
  setSpeed: (s: number) => void;
  selectBeast: (id: string | null) => void;
  selectBed: (id: string | null) => void;
  dismissBeast: (id: string) => void;
  assignBedAndTreat: (beastId: string, bedId: string, staffId: string | null, herbIds: string[], playerDiagnosis: DiseaseType | null) => void;
  assignBedAndSuppressCurse: (beastId: string, bedId: string, staffId: string | null, herbIds: string[], playerDiagnosis: DiseaseType | null) => void;
  startCurseRitual: (beastId: string, bedId: string) => void;
  setupCurseRitual: (symbols: string[], hour: RitualHour, positions: Record<string, StaffPosition>) => void;
  collectCurseSymbol: (symbolId: string, recordId: string) => void;
  completeCurseRitual: (success: boolean) => void;
  triggerNegativeEvent: (event?: NegativeEvent) => void;
  purchaseHerb: (herbId: string, qty: number) => void;
  collectFromBed: (bedId: string) => void;
  addNotification: (type: Notification["type"], message: string) => void;
  clearNotification: (id: string) => void;
  resetGame: () => void;
  tickGame: (steps?: number) => void;
  _spawnInitialBeasts: () => void;
  _addTransaction: (type: Transaction["type"], category: string, amount: number, description: string) => void;
  _dailySettlement: () => void;
}

function createInitialBeds(): Bed[] {
  return INITIAL_BEDS.map(b => ({
    id: b.id,
    name: b.name,
    status: "empty",
    assignedBeastId: null,
    assignedStaffId: null,
    treatmentProgress: 0,
    treatmentTotal: 0,
    result: "pending",
    currentPrescriptionHerbs: [],
    playerDiagnosis: null,
    startedAt: null,
    isCurseSuppression: false,
    beastSnapshot: null,
  }));
}

function createInitialInventory(): Record<string, number> {
  const inv: Record<string, number> = {};
  HERBS.forEach(h => { inv[h.id] = 5; });
  return inv;
}

function buildInitialState() {
  return {
    money: 500,
    reputation: 50,
    currentDay: 1,
    currentTime: 8,
    weather: "sunny" as WeatherType,
    isPaused: false,
    speed: 1,
    waitingQueue: [] as Beast[],
    beds: createInitialBeds(),
    inventory: createInitialInventory(),
    staff: JSON.parse(JSON.stringify(INITIAL_STAFF)),
    discoveredBreeds: [] as string[],
    medicalRecords: [] as MedicalRecord[],
    beastRelationships: {} as Record<string, BeastRelationship>,
    transactions: [] as Transaction[],
    notifications: [] as Notification[],
    selectedBeastId: null,
    selectedBedId: null,
    lastBeastSpawn: 8,
    collectedSymbols: [] as string[],
    curseRitual: {
      isActive: false,
      beastId: null,
      bedId: null,
      selectedSymbols: [],
      selectedHour: null,
      staffPositions: {},
      progress: 0,
      total: 0,
      result: "pending",
      startedAt: null,
    } as CurseRitualState,
    bedDisabledUntil: {} as Record<string, number>,
    activeNegativeEvents: [] as NegativeEvent[],
  };
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...buildInitialState(),

      togglePause: () => set(s => ({ isPaused: !s.isPaused })),
      setSpeed: (s: number) => set({ speed: s }),
      selectBeast: (id) => set({ selectedBeastId: id, selectedBedId: null }),
      selectBed: (id) => set({ selectedBedId: id, selectedBeastId: null }),

      addNotification: (type, message) => set(s => ({
        notifications: [{
          id: uid("notif"),
          type, message, timestamp: Date.now(),
        }, ...s.notifications].slice(0, 30),
      })),
      clearNotification: (id) => set(s => ({
        notifications: s.notifications.filter(n => n.id !== id),
      })),

      _addTransaction: (type, category, amount, description) => {
        const { currentDay, currentTime } = get();
        set(s => ({
          transactions: [...s.transactions, {
            id: uid("tx"),
            date: `第${currentDay}天 ${Math.floor(currentTime).toString().padStart(2, "0")}:${(Math.floor(currentTime % 1 * 60)).toString().padStart(2, "0")}`,
            day: currentDay,
            type, category, amount, description,
          }],
        }));
      },

      _spawnInitialBeasts: () => {
        const { currentDay, currentTime } = get();
        const initial: Beast[] = [];
        const count = randomInt(1, 2);
        for (let i = 0; i < count; i++) initial.push(generateRandomBeast(currentDay, currentTime));
        set({ waitingQueue: initial });
      },

      dismissBeast: (id) => {
        const s = get();
        const beast = s.waitingQueue.find(b => b.id === id);
        if (!beast) return;
        const breed = BREEDS.find(b => b.id === beast.breedId);
        const loss = Math.min(s.reputation, 5 + Math.ceil(beast.satisfaction / 50));
        set(st => ({
          waitingQueue: st.waitingQueue.filter(b => b.id !== id),
          reputation: Math.max(0, st.reputation - loss),
          selectedBeastId: st.selectedBeastId === id ? null : st.selectedBeastId,
        }));
        get().addNotification("warning", `拒绝治疗${breed?.name || "灵兽"}(名：${beast.name})，声望-${loss}`);
      },

      purchaseHerb: (herbId, qty) => {
        const herb = HERBS.find(h => h.id === herbId);
        if (!herb) return;
        const totalCost = herb.price * qty;
        const s = get();
        if (s.money < totalCost) {
          s.addNotification("error", "金钱不足，无法采购药材");
          return;
        }
        set(st => ({
          money: st.money - totalCost,
          inventory: { ...st.inventory, [herbId]: (st.inventory[herbId] ?? 0) + qty },
        }));
        get()._addTransaction("expense", "药材采购", totalCost, `采购 ${herb.name} x${qty}`);
        get().addNotification("success", `采购 ${herb.name} x${qty}，花费${totalCost}金`);
      },

      assignBedAndTreat: (beastId, bedId, staffId, herbIds, playerDiagnosis) => {
        const s = get();
        const beast = s.waitingQueue.find(b => b.id === beastId);
        const bed = s.beds.find(b => b.id === bedId);
        if (!beast || !bed || bed.status !== "empty") {
          s.addNotification("error", "分配失败：灵兽或床位不可用");
          return;
        }
        for (const hid of herbIds) {
          if ((s.inventory[hid] ?? 0) < 1) {
            s.addNotification("error", `药材不足`);
            return;
          }
        }
        if (staffId) {
          const st = s.staff.find(x => x.id === staffId);
          if (!st || st.status !== "idle") {
            s.addNotification("error", "该护理员当前不可用");
            return;
          }
        }

        const newInventory = { ...s.inventory };
        herbIds.forEach(hid => { newInventory[hid] = (newInventory[hid] ?? 0) - 1; });
        const herbsCost = herbIds.reduce((sum, hid) => {
          const h = HERBS.find(x => x.id === hid);
          return sum + (h?.price ?? 0);
        }, 0);

        const hasStaff = !!staffId;
        const staffSkillBonus = staffId ? (s.staff.find(x => x.id === staffId)?.skillLevel ?? 1) * 5 : 0;
        void staffSkillBonus;

        const totalHours = calcTreatmentHours(beast.severity, hasStaff);

        const newBeds = s.beds.map(b => b.id === bedId ? {
          ...b,
          status: "occupied" as const,
          assignedBeastId: beastId,
          assignedStaffId: staffId,
          treatmentProgress: 0,
          treatmentTotal: totalHours,
          result: "pending" as const,
          currentPrescriptionHerbs: [...herbIds],
          playerDiagnosis,
          startedAt: s.currentTime,
          isCurseSuppression: false,
          beastSnapshot: {
            id: beast.id,
            breedId: beast.breedId,
            name: beast.name,
            disease: beast.disease,
            severity: beast.severity,
            satisfaction: beast.satisfaction,
            symptoms: beast.symptoms,
          },
        } : b);

        const newStaff = s.staff.map(st => st.id === staffId ? { ...st, status: "working" as const, assignedBedId: bedId } : st);

        const newDiscovered = s.discoveredBreeds.includes(beast.breedId)
          ? s.discoveredBreeds : [...s.discoveredBreeds, beast.breedId];

        set(st => ({
          waitingQueue: st.waitingQueue.filter(b => b.id !== beastId),
          beds: newBeds,
          staff: newStaff,
          inventory: newInventory,
          money: st.money - herbsCost,
          discoveredBreeds: newDiscovered,
          selectedBeastId: null,
        }));
        get()._addTransaction("expense", "药材消耗", herbsCost, `${beast.name} 治疗消耗药材`);
        get().addNotification("info", `${beast.name} 已入住 ${bed.name}，预计${totalHours}小时治疗`);
      },

      assignBedAndSuppressCurse: (beastId, bedId, staffId, herbIds, playerDiagnosis) => {
        const s = get();
        const beast = s.waitingQueue.find(b => b.id === beastId);
        const bed = s.beds.find(b => b.id === bedId);
        if (!beast || !bed || bed.status !== "empty") {
          s.addNotification("error", "分配失败：灵兽或床位不可用");
          return;
        }
        for (const hid of herbIds) {
          if ((s.inventory[hid] ?? 0) < 1) {
            s.addNotification("error", `药材不足`);
            return;
          }
        }
        if (staffId) {
          const st = s.staff.find(x => x.id === staffId);
          if (!st || st.status !== "idle") {
            s.addNotification("error", "该护理员当前不可用");
            return;
          }
        }

        const newInventory = { ...s.inventory };
        herbIds.forEach(hid => { newInventory[hid] = (newInventory[hid] ?? 0) - 1; });
        const herbsCost = herbIds.reduce((sum, hid) => {
          const h = HERBS.find(x => x.id === hid);
          return sum + (h?.price ?? 0);
        }, 0);

        const hasStaff = !!staffId;
        const totalHours = calcTreatmentHours(beast.severity, hasStaff);

        const newBeds = s.beds.map(b => b.id === bedId ? {
          ...b,
          status: "occupied" as const,
          assignedBeastId: beastId,
          assignedStaffId: staffId,
          treatmentProgress: 0,
          treatmentTotal: totalHours,
          result: "pending" as const,
          currentPrescriptionHerbs: [...herbIds],
          playerDiagnosis,
          startedAt: s.currentTime,
          isCurseSuppression: true,
          beastSnapshot: {
            id: beast.id,
            breedId: beast.breedId,
            name: beast.name,
            disease: beast.disease,
            severity: beast.severity,
            satisfaction: beast.satisfaction,
            symptoms: beast.symptoms,
          },
        } : b);

        const newStaff = s.staff.map(st => st.id === staffId ? { ...st, status: "working" as const, assignedBedId: bedId } : st);

        const newDiscovered = s.discoveredBreeds.includes(beast.breedId)
          ? s.discoveredBreeds : [...s.discoveredBreeds, beast.breedId];

        const beastWithCurse = beast as Beast & { curseSymbolId?: string };
        const record: MedicalRecord = {
          id: uid("rec"),
          beastId: beast.id,
          breedId: beast.breedId,
          beastName: beast.name,
          date: `第${s.currentDay}天`,
          disease: beast.disease,
          severity: beast.severity,
          prescriptions: herbIds,
          success: true,
          revenue: 0,
          daysToHeal: 1,
          evolved: false,
          notes: "咒怨症症状已暂时压制，需进行祛咒仪式才能根治。",
          curseSymbolId: beastWithCurse.curseSymbolId,
          isCurseSuppressed: true,
        };

        set(st => ({
          waitingQueue: st.waitingQueue.filter(b => b.id !== beastId),
          beds: newBeds,
          staff: newStaff,
          inventory: newInventory,
          money: st.money - herbsCost,
          discoveredBreeds: newDiscovered,
          selectedBeastId: null,
          medicalRecords: [record, ...st.medicalRecords],
        }));
        get()._addTransaction("expense", "药材消耗", herbsCost, `${beast.name} 咒怨压制消耗药材`);
        get().addNotification("warning", `${beast.name} 咒怨症状已暂时压制！请从病历中收集异常符号，准备祛咒仪式。`);
      },

      startCurseRitual: (beastId, bedId) => {
        const s = get();
        if (s.curseRitual.isActive) {
          s.addNotification("error", "已有祛咒仪式正在进行中");
          return;
        }
        const bed = s.beds.find(b => b.id === bedId);
        if (!bed || bed.status !== "empty") {
          s.addNotification("error", "床位不可用");
          return;
        }
        set(st => ({
          curseRitual: {
            ...st.curseRitual,
            isActive: true,
            beastId,
            bedId,
            selectedSymbols: [],
            selectedHour: null,
            staffPositions: {},
            progress: 0,
            total: CURSE_RITUAL_REQUIREMENT.ritualHours,
            result: "pending",
            startedAt: st.currentTime,
          },
          selectedBeastId: beastId,
          selectedBedId: bedId,
        }));
        s.addNotification("info", "祛咒仪式已启动，请选择仪式符号、时辰和护理员站位。");
      },

      setupCurseRitual: (symbols, hour, positions) => {
        const s = get();
        if (!s.curseRitual.isActive) return;

        const bed = s.beds.find(b => b.id === s.curseRitual.bedId);
        if (!bed || bed.status !== "empty") {
          s.addNotification("error", "床位不可用");
          return;
        }

        const requiredHerbs = CURSE_RITUAL_REQUIREMENT.requiredHerbs;
        for (const hid of requiredHerbs) {
          if ((s.inventory[hid] ?? 0) < 1) {
            s.addNotification("error", `药材不足：需要圣光草、净灵花、赤炎花各1份`);
            return;
          }
        }

        const newInventory = { ...s.inventory };
        requiredHerbs.forEach(hid => { newInventory[hid] = (newInventory[hid] ?? 0) - 1; });
        const herbsCost = requiredHerbs.reduce((sum, hid) => {
          const h = HERBS.find(x => x.id === hid);
          return sum + (h?.price ?? 0);
        }, 0);

        const staffIds = Object.keys(positions);
        const newStaff = s.staff.map(st => {
          if (staffIds.includes(st.id)) {
            return { ...st, status: "working" as const, assignedBedId: s.curseRitual.bedId };
          }
          return st;
        });

        const queueBeast = s.waitingQueue.find(b => b.id === s.curseRitual.beastId);
        const newBeds = s.beds.map(b => b.id === s.curseRitual.bedId ? {
          ...b,
          status: "occupied" as const,
          assignedBeastId: s.curseRitual.beastId,
          assignedStaffId: staffIds[0] || null,
          treatmentProgress: 0,
          treatmentTotal: CURSE_RITUAL_REQUIREMENT.ritualHours,
          result: "pending" as const,
          currentPrescriptionHerbs: requiredHerbs,
          playerDiagnosis: "curse" as DiseaseType,
          startedAt: s.currentTime,
          isCurseSuppression: false,
          beastSnapshot: queueBeast ? {
            id: queueBeast.id,
            breedId: queueBeast.breedId,
            name: queueBeast.name,
            disease: queueBeast.disease,
            severity: queueBeast.severity,
            satisfaction: queueBeast.satisfaction,
            symptoms: queueBeast.symptoms,
          } : null,
        } : b);

        const newQueue = queueBeast ? s.waitingQueue.filter(b => b.id !== s.curseRitual.beastId) : s.waitingQueue;

        set(st => ({
          inventory: newInventory,
          money: st.money - herbsCost,
          staff: newStaff,
          beds: newBeds,
          waitingQueue: newQueue,
          curseRitual: {
            ...st.curseRitual,
            selectedSymbols: symbols,
            selectedHour: hour,
            staffPositions: positions,
          },
          selectedBeastId: null,
          selectedBedId: null,
        }));

        get()._addTransaction("expense", "仪式消耗", herbsCost, `祛咒仪式消耗药材`);
        get().addNotification("info", `祛咒仪式开始！预计${CURSE_RITUAL_REQUIREMENT.ritualHours}小时后完成。`);
      },

      collectCurseSymbol: (symbolId, recordId) => {
        const s = get();
        if (s.collectedSymbols.includes(symbolId)) {
          s.addNotification("warning", "该符号已收集过");
          return;
        }

        const symbol = CURSE_SYMBOLS.find(sym => sym.id === symbolId);
        if (!symbol) return;

        set(st => ({
          collectedSymbols: [...st.collectedSymbols, symbolId],
          medicalRecords: st.medicalRecords.map(r =>
            r.id === recordId ? { ...r, curseSymbolId: undefined } : r
          ),
        }));
        s.addNotification("success", `已收集异常符号：${symbol.emoji} ${symbol.name}！`);
      },

      completeCurseRitual: (success) => {
        const s = get();
        if (!s.curseRitual.isActive) return;

        const bedId = s.curseRitual.bedId;
        const bed = s.beds.find(b => b.id === bedId);
        if (!bed || !bed.beastSnapshot) return;

        const beast = bed.beastSnapshot;
        const breed = BREEDS.find(b => b.id === beast.breedId);

        if (success && breed) {
          const severityMult = { mild: 1.5, moderate: 2, severe: 2.5, critical: 3 }[beast.severity] || 1.5;
          const satMult = beast.satisfaction / 100;
          const reputationBonus = s.reputation / 100;
          const revenue = Math.floor(breed.baseFees * severityMult * (1 + 0.5 * satMult) * (1 + reputationBonus * 0.5));
          const repGain = Math.ceil(8 * severityMult * satMult);
          const trustGain = Math.ceil(20 * severityMult * satMult);

          let evolved = false;
          const prevRel = s.beastRelationships[breed.id];
          const prevVisits = prevRel?.visits ?? 0;
          const prevTrust = prevRel?.trust ?? 0;
          const newVisits = prevVisits + 1;
          const newTrust = prevTrust + trustGain;
          const nextStage = Math.floor(newTrust / 25);
          if (nextStage > (prevRel?.highestStage ?? 0) && breed.evolutionEmojis[nextStage]) {
            evolved = true;
          }

          const notes = "祛咒仪式成功！诅咒已被彻底根除，灵兽恢复健康。";
          const record: MedicalRecord = {
            id: uid("rec"),
            beastId: beast.id,
            breedId: breed.id,
            beastName: beast.name,
            date: `第${s.currentDay}天`,
            disease: beast.disease,
            severity: beast.severity,
            prescriptions: CURSE_RITUAL_REQUIREMENT.requiredHerbs,
            success: true,
            revenue,
            daysToHeal: 1,
            evolved,
            notes: evolved ? `${notes} 灵兽发生了进化！` : notes,
          };

          const newRel: BeastRelationship = {
            breedId: breed.id,
            trust: newTrust,
            visits: newVisits,
            evolved: evolved || prevRel?.evolved || false,
            highestStage: Math.max(nextStage, prevRel?.highestStage ?? 0),
          };

          set(st => ({
            money: st.money + revenue,
            reputation: Math.min(100, st.reputation + repGain),
            beastRelationships: { ...st.beastRelationships, [breed.id]: newRel },
            medicalRecords: [record, ...st.medicalRecords],
          }));
          get()._addTransaction("income", "祛咒收入", revenue, `祛咒成功 治愈 ${breed.name}·${beast.name}${evolved ? "(进化加成)" : ""}`);
          const evolveMsg = evolved ? " 🎉灵兽发生进化！额外获得加成！" : "";
          get().addNotification("success", `✨ 祛咒仪式成功！获得 ${revenue} 金，声望+${repGain}，亲密度+${trustGain}${evolveMsg}`);
        } else {
          get().triggerNegativeEvent();
        }

        const staffToRelease = Object.keys(s.curseRitual.staffPositions);
        const newBeds = s.beds.map(b => b.id === bedId ? {
          ...b,
          status: "empty" as const,
          assignedBeastId: null,
          assignedStaffId: null,
          treatmentProgress: 0,
          treatmentTotal: 0,
          result: "pending" as const,
          currentPrescriptionHerbs: [],
          playerDiagnosis: null,
          startedAt: null,
          isCurseSuppression: false,
          beastSnapshot: null,
        } : b);
        const newStaff = s.staff.map(st =>
          staffToRelease.includes(st.id) ? { ...st, status: "idle" as const, assignedBedId: null } : st
        );

        set(st => ({
          beds: newBeds,
          staff: newStaff,
          curseRitual: {
            ...st.curseRitual,
            isActive: false,
            beastId: null,
            bedId: null,
            selectedSymbols: [],
            selectedHour: null,
            staffPositions: {},
            progress: 0,
            total: 0,
            result: "pending",
            startedAt: null,
          },
          selectedBedId: null,
        }));
      },

      triggerNegativeEvent: (event) => {
        const s = get();
        const selectedEvent = event || rand(NEGATIVE_EVENTS);
        const effect = selectedEvent.effect;

        let newMoney = s.money;
        let newReputation = s.reputation;
        let newInventory = { ...s.inventory };
        let newBedDisabled = { ...s.bedDisabledUntil };

        if (effect.money) {
          newMoney = Math.max(0, newMoney + effect.money);
        }
        if (effect.reputation) {
          newReputation = Math.max(0, newReputation + effect.reputation);
        }
        if (effect.inventoryLoss) {
          for (const [hid, qty] of Object.entries(effect.inventoryLoss)) {
            newInventory[hid] = Math.max(0, (newInventory[hid] ?? 0) - qty);
          }
        }
        if (effect.allBedDisableHours) {
          const currentAbsoluteHour = s.currentDay * 24 + s.currentTime;
          s.beds.forEach(b => {
            newBedDisabled[b.id] = currentAbsoluteHour + effect.allBedDisableHours!;
          });
        }

        set(st => ({
          money: newMoney,
          reputation: newReputation,
          inventory: newInventory,
          bedDisabledUntil: newBedDisabled,
          activeNegativeEvents: [...st.activeNegativeEvents, selectedEvent],
        }));

        get().addNotification("error", `💀 祛咒仪式失败！触发负面事件：${selectedEvent.name} - ${selectedEvent.description}`);
        if (effect.money) {
          get()._addTransaction("expense", "诅咒反噬", Math.abs(effect.money), `${selectedEvent.name}：${selectedEvent.description}`);
        }
      },

      collectFromBed: (bedId) => {
        const s = get();
        const bed = s.beds.find(b => b.id === bedId);
        if (!bed || bed.result === "pending" || !bed.beastSnapshot) return;
        const beast = bed.beastSnapshot;

        // 咒怨症压制治疗：不产生诊金，直接释放床位即可（病历已在assignBedAndSuppressCurse中创建）
        if (bed.isCurseSuppression) {
          const newBeds = s.beds.map(b => b.id === bedId ? {
            ...b,
            status: "empty" as const,
            assignedBeastId: null,
            assignedStaffId: null,
            treatmentProgress: 0,
            treatmentTotal: 0,
            result: "pending" as const,
            currentPrescriptionHerbs: [],
            playerDiagnosis: null,
            startedAt: null,
            isCurseSuppression: false,
            beastSnapshot: null,
          } : b);
          const newStaff = s.staff.map(st =>
            st.id === bed.assignedStaffId ? { ...st, status: "idle" as const, assignedBedId: null } : st
          );
          set(st => ({
            beds: newBeds,
            staff: newStaff,
            selectedBedId: null,
          }));
          s.addNotification("info", `${beast.name} 咒怨压制完成！请从病历中收集异常符号，随后可进行祛咒仪式。`);
          return;
        }

        const bedBeastId = bed.assignedBeastId;
        const treatmentHerbs = bed.currentPrescriptionHerbs;
        const matchedPresc = PRESCRIPTIONS.find(p =>
          JSON.stringify([...p.herbIds].sort()) === JSON.stringify([...treatmentHerbs].sort())
        );
        const usedPrescNames = matchedPresc ? matchedPresc.name : "自拟方";
        void usedPrescNames;

        const breed = BREEDS.find(b => b.id === (beast?.breedId || ""));

        if (bed.result === "success" && beast && breed) {
          const severityMult = { mild: 1, moderate: 1.4, severe: 1.8, critical: 2.3 }[beast.severity] || 1;
          const satMult = beast.satisfaction / 100;
          const reputationBonus = s.reputation / 100;
          const revenue = Math.floor(breed.baseFees * severityMult * (0.8 + 0.4 * satMult) * (1 + reputationBonus * 0.3));
          let repGain = Math.ceil(3 * severityMult * satMult);
          const trustGain = Math.ceil(10 * severityMult * satMult);

          const diagnosisCorrect = bed.playerDiagnosis === beast.disease;
          if (diagnosisCorrect) {
            repGain += 2;
          }

          let evolved = false;
          let newStage = 0;
          const prevRel = s.beastRelationships[breed.id];
          const prevVisits = prevRel?.visits ?? 0;
          const prevTrust = prevRel?.trust ?? 0;
          const newVisits = prevVisits + 1;
          const newTrust = prevTrust + trustGain;
          const nextStage = Math.floor(newTrust / 25);
          if (nextStage > (prevRel?.highestStage ?? 0) && breed.evolutionEmojis[nextStage]) {
            evolved = true;
            newStage = nextStage;
          }
          void newStage;

          const notes = rand(NOTES_SUCCESS);
          const days = 1;
          const daysToHeal = days;

          const record: MedicalRecord = {
            id: uid("rec"),
            beastId: bedBeastId!,
            breedId: breed.id,
            beastName: beast.name,
            date: `第${s.currentDay}天`,
            disease: beast.disease,
            severity: beast.severity,
            prescriptions: treatmentHerbs,
            success: true,
            revenue,
            daysToHeal,
            evolved,
            notes: evolved ? `${notes} 灵兽发生了进化！` : notes,
          };

          const newRel: BeastRelationship = {
            breedId: breed.id,
            trust: newTrust,
            visits: newVisits,
            evolved: evolved || prevRel?.evolved || false,
            highestStage: Math.max(nextStage, prevRel?.highestStage ?? 0),
          };

          set(st => ({
            money: st.money + revenue,
            reputation: Math.min(100, st.reputation + repGain),
            beastRelationships: { ...st.beastRelationships, [breed.id]: newRel },
            medicalRecords: [record, ...st.medicalRecords],
          }));
          get()._addTransaction("income", "诊金收入", revenue, `治愈 ${breed.name}·${beast.name}${evolved ? "(进化加成)" : ""}`);
          const evolveMsg = evolved ? " 🎉灵兽发生进化！额外获得加成！" : "";
          const diagMsg = diagnosisCorrect ? " 🔍诊断正确！" : "";
          get().addNotification("success", `治愈成功！获得 ${revenue} 金，声望+${repGain}，亲密度+${trustGain}${diagMsg}${evolveMsg}`);
        } else if (bed.result === "fail" && beast) {
          const penaltyMoney = Math.floor(s.money * 0.05) + 20;
          const penaltyRep = 5;
          const breedName = breed?.name || "灵兽";

          const notes = rand(NOTES_FAIL);
          const record: MedicalRecord = {
            id: uid("rec"),
            beastId: bedBeastId!,
            breedId: beast.breedId,
            beastName: beast.name,
            date: `第${s.currentDay}天`,
            disease: beast.disease,
            severity: beast.severity,
            prescriptions: treatmentHerbs,
            success: false,
            revenue: -penaltyMoney,
            daysToHeal: Math.max(1, Math.ceil((s.currentTime - (bed.startedAt ?? s.currentTime)) / 24) || 1),
            evolved: false,
            notes,
          };

          set(st => ({
            money: Math.max(0, st.money - penaltyMoney),
            reputation: Math.max(0, st.reputation - penaltyRep),
            medicalRecords: [record, ...st.medicalRecords],
          }));
          get()._addTransaction("expense", "误诊赔偿", penaltyMoney, `${breedName}·${beast.name} 治疗失败赔偿`);
          const realDiseaseName = DISEASE_NAMES[beast.disease];
          get().addNotification("error", `治疗失败！确诊为「${realDiseaseName}」。赔偿 ${penaltyMoney} 金，声望-${penaltyRep}`);
        }

        // Release staff & bed
        const newBeds = s.beds.map(b => b.id === bedId ? {
          ...b,
          status: "empty" as const,
          assignedBeastId: null,
          assignedStaffId: null,
          treatmentProgress: 0,
          treatmentTotal: 0,
          result: "pending" as const,
          currentPrescriptionHerbs: [],
          playerDiagnosis: null,
          startedAt: null,
          isCurseSuppression: false,
          beastSnapshot: null,
        } : b);
        const staffToRelease = bed.assignedStaffId;
        const newStaff = s.staff.map(st => st.id === staffToRelease ? {
          ...st, status: "idle" as const, assignedBedId: null,
        } : st);

        set({ beds: newBeds, staff: newStaff, selectedBedId: null });
      },

      _dailySettlement: () => {
        const s = get();
        const totalWage = s.staff.reduce((sum, st) => sum + st.dailyWage, 0);
        const day = s.currentDay;
        const newWeather = rand(WEATHERS);

        // 天气事件
        let eventMsg = "";
        let bonusMoney = 0;
        if (newWeather === "misty") { bonusMoney = -20; eventMsg = "大雾天气，客人稀少。"; }
        else if (newWeather === "stormy") { bonusMoney = -30; eventMsg = "雷暴天气，采购运输受阻。"; }
        else if (newWeather === "sunny") { bonusMoney = 10; eventMsg = "晴朗天气，心情舒畅。"; }

        const newRelStaff = s.staff.map(st => {
          const isAssignedToActiveBed = s.beds.some(b =>
            b.status === "occupied" && b.result === "pending" && b.assignedStaffId === st.id
          );
          if (isAssignedToActiveBed) return st;
          return { ...st, status: "idle" as const, assignedBedId: null };
        });

        set(st => ({
          currentDay: day + 1,
          currentTime: 8,
          weather: newWeather,
          staff: newRelStaff,
          money: Math.max(0, st.money - totalWage + bonusMoney),
          lastBeastSpawn: 8,
        }));
        get()._addTransaction("expense", "员工工资", totalWage, `第${day}天员工薪资`);
        if (bonusMoney !== 0) {
          get()._addTransaction(
            bonusMoney >= 0 ? "income" : "expense",
            "天气事件",
            Math.abs(bonusMoney),
            `第${day}天结算：${eventMsg} (${bonusMoney >= 0 ? "+" : ""}${bonusMoney}金)`
          );
        }
        get().addNotification("info", `=== 第${day}天结算 === 支付薪资${totalWage}金。${eventMsg} 新的一天开始啦！`);
      },

      resetGame: () => {
        set(buildInitialState());
        setTimeout(() => get()._spawnInitialBeasts(), 100);
      },

      tickGame: (steps = 1) => {
        for (let i = 0; i < steps; i++) {
          const s = get();
          if (s.isPaused) return;

          let newTime = s.currentTime + 1;
          let dayPassed = false;
          if (newTime >= 24) { dayPassed = true; }

          let state = { ...s };

          // 1. 队列恶化
          const newQueue: Beast[] = state.waitingQueue.map(b => {
            const waited = b.waitHours + 1;
            let sev = b.severity;
            let sat = Math.max(0, b.satisfaction - randomInt(2, 5));
            if (waited > 4 && sev === "mild") sev = "moderate";
            else if (waited > 7 && sev === "moderate") sev = "severe";
            else if (waited > 10 && sev === "severe") sev = "critical";
            return { ...b, waitHours: waited, severity: sev, satisfaction: sat };
          });
          const stillWaiting: Beast[] = [];
          let repLossQueue = 0;
          for (const b of newQueue) {
            if (b.waitHours > 14) {
              repLossQueue += 8;
              const breedName = BREEDS.find(x => x.id === b.breedId)?.name || "灵兽";
              get().addNotification("warning", `${breedName}·${b.name} 等待太久，失望离去。声望-8`);
            } else stillWaiting.push(b);
          }
          state.waitingQueue = stillWaiting;
          state.reputation = Math.max(0, state.reputation - repLossQueue);

          // 2. 治疗进度
          const absoluteHour = state.currentDay * 24 + newTime;
          const newBeds = state.beds.map(b => {
            if (b.status !== "occupied" || b.result !== "pending") return b;

            // 检查床位是否被禁用（使用绝对时间戳）
            if (state.bedDisabledUntil[b.id] && state.bedDisabledUntil[b.id] > absoluteHour) {
              return b;
            }

            const isCurseRitualBed = state.curseRitual.isActive && state.curseRitual.bedId === b.id;
            const staffBonus = b.assignedStaffId ? 1.3 : 1;
            const newProgress = b.treatmentProgress + staffBonus;
            let result: TreatmentResult = b.result;

            if (newProgress >= b.treatmentTotal) {
              if (isCurseRitualBed && state.curseRitual.selectedSymbols.length > 0) {
                // 祛咒仪式判定
                let finalRate = CURSE_RITUAL_REQUIREMENT.baseSuccessRate;

                // 符号加成
                const selectedSymbols = state.curseRitual.selectedSymbols;
                selectedSymbols.forEach(symId => {
                  const sym = CURSE_SYMBOLS.find(s => s.id === symId);
                  if (sym) {
                    finalRate += sym.rarity * 5;
                  }
                });

                // 时辰加成
                if (state.curseRitual.selectedHour) {
                  const hourBonus = RITUAL_HOURS[state.curseRitual.selectedHour]?.bonus ?? 0;
                  finalRate += hourBonus;
                }

                // 站位加成
                const positions = Object.values(state.curseRitual.staffPositions);
                positions.forEach(pos => {
                  const posBonus = STAFF_POSITIONS[pos]?.bonus ?? 0;
                  finalRate += posBonus;
                });

                // 护理员技能加成
                Object.keys(state.curseRitual.staffPositions).forEach(staffId => {
                  const stf = state.staff.find(x => x.id === staffId);
                  if (stf) finalRate += stf.skillLevel * 3;
                });

                // 疾病严重度减成
                const sev = b.beastSnapshot?.severity ?? "mild";
                const sevDebuff = { mild: 0, moderate: -5, severe: -10, critical: -15 }[sev] || 0;
                finalRate = Math.max(10, Math.min(95, finalRate + sevDebuff));

                result = Math.random() * 100 <= finalRate ? "success" : "fail";

                // 延迟调用completeCurseRitual
                setTimeout(() => {
                  get().completeCurseRitual(result === "success");
                }, 100);
              } else {
                // 普通治疗判定
                const herbs = b.currentPrescriptionHerbs;
                const matchedPresc = PRESCRIPTIONS.find(p =>
                  JSON.stringify([...p.herbIds].sort()) === JSON.stringify([...herbs].sort())
                );

                // 咒怨症特殊处理：普通药材只能压制，不能根治
                const isCurseDisease = b.beastSnapshot?.disease === "curse";
                if (isCurseDisease) {
                  // 咒怨症普通治疗总是"成功"但只是压制
                  result = "success";
                } else {
                  let finalRate = matchedPresc ? matchedPresc.successRate : 30;
                  // 员工加成
                  if (b.assignedStaffId) {
                    const stf = state.staff.find(x => x.id === b.assignedStaffId);
                    finalRate += (stf?.skillLevel ?? 1) * 5;
                  }
                  // 疾病严重度减成
                  const sev = b.beastSnapshot?.severity ?? "mild";
                  const sevDebuff = { mild: 0, moderate: -5, severe: -10, critical: -15 }[sev] || 0;
                  finalRate = Math.max(5, Math.min(98, finalRate + sevDebuff));
                  result = Math.random() * 100 <= finalRate ? "success" : "fail";
                }
              }
            }
            return { ...b, treatmentProgress: Math.min(newProgress, b.treatmentTotal), result };
          });
          state.beds = newBeds;

          // 2.5 床位禁用恢复检查（使用绝对时间戳）
          const absoluteHourForCheck = state.currentDay * 24 + newTime;
          const newBedDisabled = { ...state.bedDisabledUntil };
          for (const [bedId, until] of Object.entries(newBedDisabled)) {
            if (until <= absoluteHourForCheck) {
              delete newBedDisabled[bedId];
            }
          }
          state.bedDisabledUntil = newBedDisabled;

          // 3. 新灵兽生成
          if (!dayPassed && newTime >= 8 && newTime < 21) {
            const chance = 0.25 + Math.min(0.3, state.currentDay * 0.015);
            if (newTime - state.lastBeastSpawn >= randomInt(1, 2) && Math.random() <= chance && state.waitingQueue.length < 6) {
              const nb = generateRandomBeast(state.currentDay, newTime);
              state.waitingQueue = [...state.waitingQueue, nb];
              state.lastBeastSpawn = newTime;
              const breed = BREEDS.find(b => b.id === nb.breedId);
              get().addNotification("info", `新客人：${breed?.name || "灵兽"}·${nb.name} 前来就诊`);
            }
          }

          state.currentTime = dayPassed ? 8 : newTime;

          set(state);
          if (dayPassed) get()._dailySettlement();
        }
      },
    }),
    {
      name: "beast-clinic-save",
      version: 1,
      merge: (persisted, current) => ({ ...current, ...(persisted as object) }),
      onRehydrateStorage: () => (state) => {
        if (state && state.waitingQueue.length === 0 && state.medicalRecords.length === 0) {
          // 全新存档
          setTimeout(() => state._spawnInitialBeasts(), 100);
        }
      },
    }
  )
);
