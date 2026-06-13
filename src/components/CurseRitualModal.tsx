import { useState, useMemo } from "react";
import { X, Moon, Sun, Users, Sparkles, AlertTriangle, ArrowRight } from "lucide-react";
import { useGameStore } from "@/store/gameStore";
import {
  CURSE_SYMBOLS,
  RITUAL_HOURS,
  STAFF_POSITIONS,
  CURSE_RITUAL_REQUIREMENT,
  BREEDS,
  HERBS,
  DISEASE_NAMES,
} from "@/data/gameData";
import type { RitualHour, StaffPosition, Beast } from "@/types/game";

interface CurseRitualModalProps {
  open: boolean;
  onClose: () => void;
}

export function CurseRitualModal({ open, onClose }: CurseRitualModalProps) {
  const curseRitual = useGameStore(s => s.curseRitual);
  const queue = useGameStore(s => s.waitingQueue);
  const collectedSymbols = useGameStore(s => s.collectedSymbols);
  const staff = useGameStore(s => s.staff);
  const inventory = useGameStore(s => s.inventory);
  const currentTime = useGameStore(s => s.currentTime);
  const setupCurseRitual = useGameStore(s => s.setupCurseRitual);

  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [selectedHour, setSelectedHour] = useState<RitualHour | null>(null);
  const [staffPositions, setStaffPositions] = useState<Record<string, StaffPosition>>({});

  const beast = useMemo(() => {
    if (!curseRitual.beastId) return null;
    return queue.find(b => b.id === curseRitual.beastId) || null;
  }, [queue, curseRitual.beastId]);

  const breed = useMemo(() => {
    if (!beast) return null;
    return BREEDS.find(b => b.id === (beast as Beast).breedId);
  }, [beast]);

  const idleStaff = useMemo(() => staff.filter(s => s.status === "idle"), [staff]);

  const availableSymbols = useMemo(() => {
    return CURSE_SYMBOLS.filter(s => collectedSymbols.includes(s.id));
  }, [collectedSymbols]);

  const canAffordHerbs = useMemo(() => {
    return CURSE_RITUAL_REQUIREMENT.requiredHerbs.every(id => (inventory[id] ?? 0) >= 1);
  }, [inventory]);

  const currentHourKey = useMemo(() => {
    const hour = Math.floor(currentTime);
    const hours = Object.entries(RITUAL_HOURS) as [RitualHour, typeof RITUAL_HOURS[RitualHour]][];
    const sorted = hours.sort((a, b) => a[1].hour - b[1].hour);
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (hour >= sorted[i][1].hour) return sorted[i][0];
    }
    return sorted[sorted.length - 1][0];
  }, [currentTime]);

  const successRate = useMemo(() => {
    if (selectedSymbols.length < CURSE_RITUAL_REQUIREMENT.minSymbols || !selectedHour) return 0;

    let rate = CURSE_RITUAL_REQUIREMENT.baseSuccessRate;

    selectedSymbols.forEach(symId => {
      const sym = CURSE_SYMBOLS.find(s => s.id === symId);
      if (sym) rate += sym.rarity * 5;
    });

    if (selectedHour) {
      rate += RITUAL_HOURS[selectedHour]?.bonus ?? 0;
    }

    Object.values(staffPositions).forEach(pos => {
      rate += STAFF_POSITIONS[pos]?.bonus ?? 0;
    });

    Object.keys(staffPositions).forEach(staffId => {
      const stf = staff.find(s => s.id === staffId);
      if (stf) rate += stf.skillLevel * 3;
    });

    if (beast) {
      const sev = (beast as Beast).severity;
      const sevDebuff = { mild: 0, moderate: -5, severe: -10, critical: -15 }[sev] || 0;
      rate += sevDebuff;
    }

    return Math.max(10, Math.min(95, rate));
  }, [selectedSymbols, selectedHour, staffPositions, staff, beast]);

  if (!open || !curseRitual.isActive || !beast || !breed) return null;

  const toggleSymbol = (symId: string) => {
    setSelectedSymbols(prev => {
      if (prev.includes(symId)) return prev.filter(id => id !== symId);
      if (prev.length >= CURSE_RITUAL_REQUIREMENT.maxSymbols) return prev;
      return [...prev, symId];
    });
  };

  const assignStaffToPosition = (staffId: string, position: StaffPosition) => {
    setStaffPositions(prev => {
      const newPos = { ...prev };
      const existingStaff = Object.keys(newPos).find(k => newPos[k] === position);
      if (existingStaff) {
        delete newPos[existingStaff];
      }
      if (newPos[staffId] === position) {
        delete newPos[staffId];
      } else {
        newPos[staffId] = position;
      }
      return newPos;
    });
  };

  const canSubmit =
    selectedSymbols.length >= CURSE_RITUAL_REQUIREMENT.minSymbols &&
    selectedSymbols.length <= CURSE_RITUAL_REQUIREMENT.maxSymbols &&
    selectedHour !== null &&
    Object.keys(staffPositions).length >= 1 &&
    canAffordHerbs;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setupCurseRitual(selectedSymbols, selectedHour!, staffPositions);
    onClose();
  };

  const herbsCost = CURSE_RITUAL_REQUIREMENT.requiredHerbs.reduce((sum, id) => {
    const h = HERBS.find(x => x.id === id);
    return sum + (h?.price ?? 0);
  }, 0);

  const positions: StaffPosition[] = ["north", "east", "center", "west", "south"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-clinic-card shadow-2xl rounded-2xl border-2 border-purple-300 overflow-hidden animate-scale-in">
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 p-4 border-b border-purple-400/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-2xl shadow-lg">
              ✨
            </div>
            <div className="flex-1">
              <h2 className="font-display text-xl text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                祛咒仪式
              </h2>
              <p className="text-purple-200 text-xs">
                选择异常符号、仪式时辰和护理员站位，彻底根除咒怨
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-purple-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-4 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50">
              <div className="font-display text-sm text-purple-800 mb-3 flex items-center gap-2">
                <span className="text-xl">{breed.emoji}</span>
                仪式对象
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-clinic-deep">{(beast as Beast).name}</span>
                  <span className="text-xs text-gray-500">{breed.name}</span>
                </div>
                <div className="text-xs text-gray-600">
                  <span className="tag bg-rose-100 text-rose-700 border-rose-200 border">
                    {DISEASE_NAMES[(beast as Beast).disease]}
                  </span>
                  <span className="ml-2 text-gray-500">
                    严重度：{CURSE_RITUAL_REQUIREMENT && {
                      mild: "轻度", moderate: "中度", severe: "重度", critical: "危重"
                    }[(beast as Beast).severity]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(beast as Beast).symptoms.map((s: string) => (
                    <span key={s} className="tag bg-white border border-purple-200 text-purple-700 text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="card p-4 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
              <div className="font-display text-sm text-amber-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                仪式消耗
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">必需药材：</span>
                  {CURSE_RITUAL_REQUIREMENT.requiredHerbs.map(id => {
                    const h = HERBS.find(x => x.id === id);
                    const count = inventory[id] ?? 0;
                    return (
                      <span
                        key={id}
                        className={`tag border ${count >= 1 ? "bg-white border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}
                      >
                        {h?.emoji} {h?.name} ({count})
                      </span>
                    );
                  })}
                </div>
                <div className="text-gray-600">
                  药材费用：<span className="font-semibold text-clinic-deep">{herbsCost} 金</span>
                </div>
                <div className="text-gray-600">
                  预计时长：<span className="font-semibold text-clinic-deep">{CURSE_RITUAL_REQUIREMENT.ritualHours} 小时</span>
                </div>
                {!canAffordHerbs && (
                  <div className="text-red-600 text-xs flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3" />
                    药材不足，无法开始仪式
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 border-purple-200">
            <div className="font-display text-sm text-purple-800 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              选择异常符号（{CURSE_RITUAL_REQUIREMENT.minSymbols}-{CURSE_RITUAL_REQUIREMENT.maxSymbols}个）
              <span className="ml-auto text-xs text-gray-500">
                已选 {selectedSymbols.length}/{CURSE_RITUAL_REQUIREMENT.maxSymbols}
              </span>
            </div>
            {availableSymbols.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <div className="text-3xl mb-2">📜</div>
                <p className="text-sm">尚未收集到任何异常符号</p>
                <p className="text-xs mt-1">请先从咒怨症病历中收集符号</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {availableSymbols.map(sym => {
                  const selected = selectedSymbols.includes(sym.id);
                  const disabled = !selected && selectedSymbols.length >= CURSE_RITUAL_REQUIREMENT.maxSymbols;
                  return (
                    <button
                      key={sym.id}
                      onClick={() => toggleSymbol(sym.id)}
                      disabled={disabled}
                      className={`p-3 rounded-xl border-2 transition-all text-center ${
                        selected
                          ? "border-purple-500 bg-purple-100 shadow-md scale-105"
                          : disabled
                          ? "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
                          : "border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50"
                      }`}
                    >
                      <div className="text-2xl mb-1">{sym.emoji}</div>
                      <div className="text-xs font-medium text-clinic-deep">{sym.name}</div>
                      <div className="text-[9px] text-gray-500">
                        {"⭐".repeat(sym.rarity)} +{sym.rarity * 5}%
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-4 border-indigo-200">
            <div className="font-display text-sm text-indigo-800 mb-3 flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-500" />
              选择仪式时辰
              <span className="ml-auto text-xs text-gray-500">
                当前时辰：{RITUAL_HOURS[currentHourKey]?.name}
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {(Object.entries(RITUAL_HOURS) as [RitualHour, typeof RITUAL_HOURS[RitualHour]][]).map(([key, hour]) => {
                const selected = selectedHour === key;
                const isCurrent = key === currentHourKey;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedHour(selected ? null : key)}
                    className={`p-2 rounded-lg border transition-all text-center ${
                      selected
                        ? "border-indigo-500 bg-indigo-100 shadow-sm"
                        : isCurrent
                        ? "border-amber-300 bg-amber-50"
                        : "border-gray-200 bg-white hover:border-indigo-300"
                    }`}
                  >
                    <div className="text-sm font-medium text-clinic-deep">{hour.name}</div>
                    <div className="text-[9px] text-gray-500">
                      {hour.hour.toString().padStart(2, "0")}:00
                    </div>
                    <div className={`text-[9px] font-medium ${
                      hour.bonus > 10 ? "text-green-600" : hour.bonus > 0 ? "text-blue-600" : "text-gray-400"
                    }`}>
                      {hour.bonus > 0 ? `+${hour.bonus}%` : "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4 border-teal-200">
            <div className="font-display text-sm text-teal-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-500" />
              护理员站位（至少1人）
            </div>

            <div className="relative w-64 h-64 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50" />
              <div className="absolute inset-4 rounded-full border-2 border-dashed border-teal-300" />
              <div className="absolute inset-12 rounded-full border-2 border-teal-200 bg-white/50" />

              {positions.map((pos, idx) => {
                const posInfo = STAFF_POSITIONS[pos];
                const staffId = Object.keys(staffPositions).find(k => staffPositions[k] === pos);
                const assignedStaff = staffId ? staff.find(s => s.id === staffId) : null;

                const angleMap: Record<StaffPosition, { top: string; left: string }> = {
                  north: { top: "0%", left: "50%" },
                  east: { top: "50%", left: "100%" },
                  center: { top: "50%", left: "50%" },
                  west: { top: "50%", left: "0%" },
                  south: { top: "100%", left: "50%" },
                };

                const style = angleMap[pos];

                return (
                  <div
                    key={pos}
                    className="absolute transform -translate-x-1/2 -translate-y-1/2"
                    style={{ top: style.top, left: style.left }}
                  >
                    <div
                      className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center transition-all ${
                        assignedStaff
                          ? "border-teal-500 bg-teal-100 shadow-md"
                          : "border-gray-300 bg-white/70 border-dashed"
                      }`}
                    >
                      <span className="text-xl">{assignedStaff?.emoji || posInfo.emoji}</span>
                      <span className="text-[9px] text-gray-600">{posInfo.name.split("·")[0]}</span>
                    </div>
                    <div className="text-[9px] text-center text-gray-500 mt-1">
                      +{posInfo.bonus}%
                    </div>
                  </div>
                );
              })}

              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl">
                {breed.emoji}
              </div>
            </div>

            <div className="border-t border-teal-100 pt-3">
              <div className="text-xs text-gray-500 mb-2">选择护理员并点击方位分配：</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {idleStaff.length === 0 ? (
                  <div className="col-span-full text-center py-3 text-gray-400 text-xs italic">
                    暂无空闲护理员
                  </div>
                ) : (
                  idleStaff.map(s => {
                    const isAssigned = staffPositions[s.id];
                    return (
                      <div key={s.id} className="space-y-1">
                        <button
                          className={`w-full p-2 rounded-lg border text-left transition-all ${
                            isAssigned
                              ? "border-teal-500 bg-teal-50"
                              : "border-gray-200 bg-white hover:border-teal-300"
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg">{s.emoji}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-clinic-deep truncate">{s.name}</div>
                              <div className="text-[9px] text-gray-500">Lv.{s.skillLevel} +{s.skillLevel * 3}%</div>
                            </div>
                          </div>
                        </button>
                        <div className="grid grid-cols-5 gap-0.5">
                          {positions.map(pos => (
                            <button
                              key={pos}
                              onClick={() => assignStaffToPosition(s.id, pos)}
                              className={`p-1 rounded text-[8px] transition-all ${
                                staffPositions[s.id] === pos
                                  ? "bg-teal-500 text-white"
                                  : "bg-gray-100 text-gray-500 hover:bg-teal-100"
                              }`}
                              title={STAFF_POSITIONS[pos].name}
                            >
                              {STAFF_POSITIONS[pos].emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="card p-4 bg-gradient-to-r from-green-50 via-emerald-50 to-teal-50 border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                  <Sun className="w-4 h-4 text-yellow-500" />
                  预计成功率
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  基于符号、时辰、站位和护理员技能计算
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold font-display ${
                  successRate >= 80 ? "text-green-600" :
                  successRate >= 60 ? "text-emerald-600" :
                  successRate >= 40 ? "text-amber-600" :
                  "text-red-600"
                }`}>
                  {successRate}%
                </div>
                <div className="text-[10px] text-gray-500">
                  {successRate >= 80 ? "大吉之兆" :
                   successRate >= 60 ? "较为顺利" :
                   successRate >= 40 ? "风险较高" :
                   "凶多吉少"}
                </div>
              </div>
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  successRate >= 80 ? "bg-gradient-to-r from-green-400 to-emerald-500" :
                  successRate >= 60 ? "bg-gradient-to-r from-emerald-400 to-teal-500" :
                  successRate >= 40 ? "bg-gradient-to-r from-amber-400 to-orange-500" :
                  "bg-gradient-to-r from-red-400 to-rose-500"
                }`}
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-purple-200 bg-gradient-to-r from-purple-50 via-white to-indigo-50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border-2 border-gray-300 text-gray-600 hover:bg-white transition-colors text-sm font-medium"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex-1 py-2.5 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all ${
                canSubmit
                  ? "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              开始祛咒仪式
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
