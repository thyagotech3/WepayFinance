import { FamilyMember, IncomeStream, FixedExpenseItem, Transaction } from '../types';
import { db, doc, getDoc, setDoc, sanitizeForFirestore } from '../lib/firebase';

export interface MonthlyIncomeResult {
  totalFixedIncome: number;
  totalValesIncome: number;
  totalExtraIncome: number;
  totalFamilyIncome: number;
  memberTotals: Record<string, { fixed: number; vales: number; extra: number; total: number }>;
}

/**
 * Merges two incomes maps without losing any member or month entries
 */
export function deepMergeIncomesMaps(
  base: Record<string, any> = {},
  incoming: Record<string, any> = {}
): Record<string, any> {
  const result: Record<string, any> = { ...base };

  const mergeStreamArrays = (listA: IncomeStream[] = [], listB: IncomeStream[] = []): IncomeStream[] => {
    const map = new Map<string, IncomeStream>();
    (Array.isArray(listA) ? listA : []).forEach((item) => {
      if (item && (item.id || item.name)) {
        const key = item.id || `${item.name}-${item.dueDate || ''}`;
        map.set(key, item);
      }
    });
    (Array.isArray(listB) ? listB : []).forEach((item) => {
      if (item && (item.id || item.name)) {
        const key = item.id || `${item.name}-${item.dueDate || ''}`;
        const existing = map.get(key);
        if (existing) {
          map.set(key, { ...existing, ...item });
        } else {
          map.set(key, item);
        }
      }
    });
    return Array.from(map.values());
  };

  const allKeys = new Set([...Object.keys(base || {}), ...Object.keys(incoming || {})]);

  allKeys.forEach((key) => {
    const valBase = base?.[key];
    const valInc = incoming?.[key];

    if (key.match(/^\d{4}-\d{2}$/)) {
      // Month container: { [memberId]: IncomeStream[] }
      const monthObjA = typeof valBase === 'object' && valBase !== null ? valBase : {};
      const monthObjB = typeof valInc === 'object' && valInc !== null ? valInc : {};
      const memberKeys = new Set([...Object.keys(monthObjA), ...Object.keys(monthObjB)]);
      const mergedMonth: Record<string, IncomeStream[]> = {};
      memberKeys.forEach((mKey) => {
        mergedMonth[mKey] = mergeStreamArrays(monthObjA[mKey], monthObjB[mKey]);
      });
      result[key] = mergedMonth;
    } else if (Array.isArray(valBase) || Array.isArray(valInc)) {
      // Flat member stream list
      result[key] = mergeStreamArrays(valBase, valInc);
    } else if (typeof valBase === 'object' || typeof valInc === 'object') {
      result[key] = { ...(valBase || {}), ...(valInc || {}) };
    } else {
      result[key] = valInc !== undefined ? valInc : valBase;
    }
  });

  return result;
}

export function recoverIncomesFromTransactions(
  incomesMap: Record<string, any> = {},
  transactions: Transaction[] = [],
  members: FamilyMember[] = []
): Record<string, any> {
  const result: Record<string, any> = { ...(incomesMap || {}) };

  const maleMember = members[0] || { id: 'm1', name: 'Thiago' };
  const femaleMember = members[1] || { id: 'm2', name: 'Josy' };

  transactions.forEach((tx) => {
    if (tx.status === 'deleted' || tx.status === 'reverted') return;

    // Check if this transaction represents an income
    const isIncomeTx =
      tx.type === 'income' ||
      tx.incomeStreamId ||
      tx.category === 'Serviços' ||
      tx.category === 'Salário' ||
      tx.category === 'Renda Extra' ||
      (tx.description && tx.description.toLowerCase().includes('[renda]'));

    if (isIncomeTx && tx.amount > 0) {
      const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const monthKey = tx.incomeMonthKey || (tx.date ? tx.date.substring(0, 7) : nowKey);

      // Determine which member this income belongs to
      let targetMember = femaleMember;
      const txPaidBy = (tx.paidByMemberId || '').toLowerCase();
      const txDesc = (tx.description || '').toLowerCase();
      const txNotes = (tx.notes || '').toLowerCase();

      if (
        txPaidBy === maleMember.id.toLowerCase() ||
        txPaidBy.includes('thiago') ||
        txPaidBy.includes('thyago') ||
        txDesc.includes('thiago') ||
        txDesc.includes('thyago') ||
        txNotes.includes('thiago') ||
        txNotes.includes('thyago')
      ) {
        targetMember = maleMember;
      } else if (
        txPaidBy === femaleMember.id.toLowerCase() ||
        txPaidBy.includes('josy') ||
        txPaidBy.includes('josefa') ||
        txDesc.includes('josy') ||
        txDesc.includes('josefa') ||
        txNotes.includes('josy') ||
        txNotes.includes('josefa')
      ) {
        targetMember = femaleMember;
      } else if (tx.paidByMemberId) {
        const found = members.find((m) => m.id === tx.paidByMemberId);
        if (found) targetMember = found;
      }

      const memberId = targetMember.id;

      // Clean title
      let cleanName = tx.description
        .replace(/^\[renda\]\s*/i, '')
        .replace(/\s*-\s*Recebimento.*$/i, '')
        .replace(/\s*\([^)]*\)$/, '')
        .trim();
      if (!cleanName) cleanName = 'Renda';

      let nature: 'fixed' | 'vales' | 'extra' = 'fixed';
      if (
        cleanName.toLowerCase().includes('vale') ||
        cleanName.toLowerCase().includes('refeição') ||
        cleanName.toLowerCase().includes('alimentação')
      ) {
        nature = 'vales';
      } else if (
        cleanName.toLowerCase().includes('extra') ||
        cleanName.toLowerCase().includes('freela') ||
        cleanName.toLowerCase().includes('consult') ||
        cleanName.toLowerCase().includes('bico') ||
        cleanName.toLowerCase().includes('serviço')
      ) {
        nature = 'extra';
      }

      const streamId = tx.incomeStreamId || `rec_inc_${tx.id}`;

      // Ensure month container exists
      if (!result[monthKey]) result[monthKey] = {};
      const currentMonthList: IncomeStream[] = Array.isArray(result[monthKey][memberId]) ? [...result[monthKey][memberId]] : [];
      const currentRootList: IncomeStream[] = Array.isArray(result[memberId]) ? [...result[memberId]] : [];

      const existingIndex = currentMonthList.findIndex(
        (s) => s.id === streamId || (s.name.trim().toLowerCase() === cleanName.trim().toLowerCase() && Math.abs((s.amount || 0) - tx.amount) < 0.01)
      );

      const recoveredStream: IncomeStream = {
        id: streamId,
        name: cleanName,
        amount: tx.amount,
        targetGoal: tx.amount,
        nature,
        dueDate: '10',
        isRecurrent: true,
        received: true,
        receivedDate: tx.date,
        notes: tx.notes || 'Renda sincronizada do histórico',
      };

      if (existingIndex >= 0) {
        currentMonthList[existingIndex] = {
          ...currentMonthList[existingIndex],
          amount: Math.max(currentMonthList[existingIndex].amount || 0, tx.amount),
          received: true,
          receivedDate: tx.date || currentMonthList[existingIndex].receivedDate,
        };
      } else {
        currentMonthList.push(recoveredStream);
      }

      result[monthKey][memberId] = currentMonthList;

      // Also ensure in root list if not present
      if (!currentRootList.some((s) => s.id === streamId || s.name.trim().toLowerCase() === cleanName.trim().toLowerCase())) {
        result[memberId] = [...currentRootList, recoveredStream];
      }
    }
  });

  return result;
}

/**
 * Reconstructs any missing fixed expenses from the transaction history
 * (e.g. if another device temporarily overwrote the fixed expenses list)
 */
export function recoverFixedExpenses(
  existingExpenses: FixedExpenseItem[] = [],
  transactions: Transaction[] = [],
  members: FamilyMember[] = []
): FixedExpenseItem[] {
  const map = new Map<string, FixedExpenseItem>();

  // 1. Add all existing expenses
  existingExpenses.forEach((fe) => {
    if (fe && fe.id) {
      map.set(fe.id, fe);
    }
  });

  // 2. Scan transaction history to auto-recover any lost fixed expense
  transactions.forEach((tx) => {
    if (tx.status === 'deleted' || tx.status === 'reverted') return;

    const isFixedTx =
      tx.fixedExpenseId ||
      tx.isRecurrent ||
      (tx.notes && tx.notes.includes('Gasto Fixo')) ||
      (tx.description && tx.description.toLowerCase().startsWith('[gasto fixo]'));

    if (isFixedTx && tx.amount > 0) {
      const targetId = tx.fixedExpenseId || `fe_recovered_${tx.id}`;
      if (!map.has(targetId)) {
        // Extract clean title
        let cleanTitle = tx.description
          .replace(/^\[gasto fixo\]\s*/i, '')
          .replace(/\s*\([^)]*\)$/, '')
          .trim();
        if (!cleanTitle) cleanTitle = tx.description;

        let dueDate = '10';
        if (tx.notes) {
          const matchDue = tx.notes.match(/Vencimento:\s*(?:Dia\s*)?(\d{1,2}|s\/[^\s|]+)/i);
          if (matchDue && matchDue[1]) {
            dueDate = matchDue[1];
          }
        }

        const recovered: FixedExpenseItem = {
          id: targetId,
          title: cleanTitle,
          amount: tx.amount,
          category: tx.category || 'Moradia',
          paidByMemberId: tx.paidByMemberId || (members[0]?.id || 'both'),
          dueDate,
          isPaid: true,
          recurrenceType: 'fixed_amount',
          monthKey: tx.date ? tx.date.substring(0, 7) : undefined,
          notes: tx.notes || 'Gasto fixo sincronizado',
        };
        map.set(targetId, recovered);
      }
    }
  });

  return Array.from(map.values());
}

/**
 * Deep merge fixed expenses from remote and local sources with auto-recovery
 */
export function deepMergeFixedExpenses(
  listA: FixedExpenseItem[] = [],
  listB: FixedExpenseItem[] = [],
  transactions: Transaction[] = [],
  members: FamilyMember[] = []
): FixedExpenseItem[] {
  const map = new Map<string, FixedExpenseItem>();

  (Array.isArray(listA) ? listA : []).forEach((item) => {
    if (item && item.id) map.set(item.id, item);
  });

  (Array.isArray(listB) ? listB : []).forEach((item) => {
    if (item && item.id) {
      const existing = map.get(item.id);
      if (existing) {
        map.set(item.id, { ...existing, ...item });
      } else {
        map.set(item.id, item);
      }
    }
  });

  const combined = Array.from(map.values());
  return recoverFixedExpenses(combined, transactions, members);
}

/**
 * Synchronizes the entire incomes map to Firestore under the doc /incomes/{groupId}
 */
export async function syncIncomesMapToFirestore(groupId?: string, customMap?: Record<string, any>) {
  let targetGroupId = groupId;
  if (!targetGroupId && typeof window !== 'undefined') {
    try {
      const savedGroup = localStorage.getItem('wepay_group');
      if (savedGroup) {
        const parsed = JSON.parse(savedGroup);
        if (parsed?.id) targetGroupId = parsed.id;
      }
    } catch (e) {}
  }

  if (!targetGroupId) return;

  try {
    let localMap = customMap;
    if (!localMap && typeof window !== 'undefined') {
      const saved = localStorage.getItem('wepay_couple_incomes_v3') || localStorage.getItem('wepay_monthly_incomes');
      if (saved) {
        localMap = JSON.parse(saved);
      }
    }

    // Read current remote data first to merge both partners' incomes without overwriting
    let remoteMap: Record<string, any> = {};
    try {
      const docSnap = await getDoc(doc(db, 'incomes', targetGroupId));
      if (docSnap.exists() && docSnap.data().incomesMap) {
        remoteMap = docSnap.data().incomesMap;
      }
    } catch (fetchErr) {
      console.warn('Incomes remote read check notice:', fetchErr);
    }

    const merged = deepMergeIncomesMaps(remoteMap, localMap || {});

    if (typeof window !== 'undefined') {
      localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(merged));
      localStorage.setItem('wepay_monthly_incomes', JSON.stringify(merged));
      window.dispatchEvent(new Event('wepay_incomes_updated'));
    }

    await setDoc(
      doc(db, 'incomes', targetGroupId),
      sanitizeForFirestore({
        incomesMap: merged,
        groupId: targetGroupId,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore incomes sync notice:', err);
  }
}

export function getBrazilianHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Standard national holidays (YYYY-MM-DD)
  holidays.add(`${year}-01-01`); // Confraternização Universal
  holidays.add(`${year}-04-21`); // Tiradentes
  holidays.add(`${year}-05-01`); // Dia do Trabalho
  holidays.add(`${year}-09-07`); // Independência do Brasil
  holidays.add(`${year}-10-12`); // Nossa Senhora Aparecida
  holidays.add(`${year}-11-02`); // Finados
  holidays.add(`${year}-11-15`); // Proclamação da República
  holidays.add(`${year}-11-20`); // Dia da Consciência Negra
  holidays.add(`${year}-12-25`); // Natal

  // Easter and related moveable holidays (Anonymous Gregorian algorithm)
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  const easter = new Date(year, month - 1, day);

  // Good Friday (Sexta-Feira Santa): Easter - 2 days
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  holidays.add(`${year}-${pad(goodFriday.getMonth() + 1)}-${pad(goodFriday.getDate())}`);

  // Carnival Tuesday: Easter - 47 days
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);
  holidays.add(`${year}-${pad(carnival.getMonth() + 1)}-${pad(carnival.getDate())}`);

  // Corpus Christi: Easter + 60 days
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);
  holidays.add(`${year}-${pad(corpusChristi.getMonth() + 1)}-${pad(corpusChristi.getDate())}`);

  return holidays;
}

export function calculateValesWorkDays(
  monthKey: string,
  workDays: string[],
  workOnHolidays: boolean
): number {
  if (!monthKey || !workDays || workDays.length === 0) return 0;

  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month)) return 0;

  const daysInMonth = new Date(year, month, 0).getDate();
  const holidays = workOnHolidays ? new Set<string>() : getBrazilianHolidays(year);

  const dayCodeMap: Record<number, string> = {
    0: 'sun',
    1: 'mon',
    2: 'tue',
    3: 'wed',
    4: 'thu',
    5: 'fri',
    6: 'sat',
  };

  const pad = (n: number) => String(n).padStart(2, '0');
  let workedDaysCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const dayCode = dayCodeMap[date.getDay()];

    if (workDays.includes(dayCode)) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      if (!workOnHolidays && holidays.has(dateStr)) {
        continue;
      }
      workedDaysCount++;
    }
  }

  return workedDaysCount;
}

export function getStreamAmount(stream: IncomeStream, monthKey?: string): number {
  if (stream.nature === 'extra') {
    return stream.amount || 0;
  }
  if (stream.nature === 'vales' && stream.calculationType === 'auto') {
    const key = monthKey || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const daily = stream.dailyRate || 0;
    const days = calculateValesWorkDays(
      key,
      stream.workDays || ['mon', 'tue', 'wed', 'thu', 'fri'],
      stream.workOnHolidays ?? false
    );
    return daily * days;
  }
  return stream.amount || stream.targetGoal || 0;
}

export function saveIncomeStreamToStorage(
  memberId: string,
  streamData: Omit<IncomeStream, 'id'> & { id?: string; icon?: string; isAccumulate?: boolean },
  monthKey: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  groupId?: string,
  applyToAllMonths: boolean = true
): IncomeStream {
  let incomesMap: Record<string, any> = {};
  try {
    const saved = localStorage.getItem('wepay_couple_incomes_v3') || localStorage.getItem('wepay_monthly_incomes');
    if (saved) {
      incomesMap = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading incomes:', e);
  }

  // 1. Check flat member array
  const flatStreams: IncomeStream[] = Array.isArray(incomesMap[memberId]) ? incomesMap[memberId] : [];

  // 2. Check monthly member array
  const monthData = incomesMap[monthKey] || {};
  const monthStreams: IncomeStream[] = Array.isArray(monthData[memberId]) ? monthData[memberId] : [];

  // Use whichever list exists and has items, or flat array
  const baseList = monthStreams.length > 0 ? monthStreams : (flatStreams.length > 0 ? flatStreams : []);

  const existingIndex = baseList.findIndex(
    (s) => (streamData.id && s.id === streamData.id) || s.name.trim().toLowerCase() === streamData.name.trim().toLowerCase()
  );

  let updatedStream: IncomeStream;
  let updatedList: IncomeStream[];

  if (existingIndex >= 0) {
    const target = baseList[existingIndex];
    let newAmount: number;
    if (streamData.isAccumulate) {
      newAmount = (target.amount || 0) + (streamData.amount || 0);
    } else {
      newAmount = streamData.amount !== undefined ? streamData.amount : (target.amount || 0);
    }

    let newHistory = target.history || [];
    if (streamData.history !== undefined) {
      newHistory = streamData.history;
    } else if (streamData.isAccumulate && (streamData.amount || 0) > 0) {
      const now = new Date();
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
      newHistory = [
        {
          id: 'entry_' + Date.now(),
          amount: streamData.amount || 0,
          date: dateStr,
          notes: streamData.notes,
        },
        ...newHistory,
      ];
    }

    const lastEntry = streamData.lastEntryAmount !== undefined
      ? streamData.lastEntryAmount
      : (streamData.isAccumulate ? (streamData.amount || 0) : target.lastEntryAmount);

    updatedStream = {
      ...target,
      ...streamData,
      id: target.id,
      name: streamData.name || target.name,
      amount: newAmount,
      targetGoal: streamData.targetGoal !== undefined ? streamData.targetGoal : target.targetGoal,
      nature: streamData.nature || target.nature,
      dueDate: streamData.dueDate || target.dueDate || 's/ previsão',
      isRecurrent: streamData.isRecurrent !== undefined ? streamData.isRecurrent : (target.isRecurrent ?? true),
      icon: streamData.icon || target.icon,
      received: newAmount > 0 ? true : (streamData.received !== undefined ? streamData.received : target.received),
      receivedDate: streamData.receivedDate || target.receivedDate || new Date().toISOString().split('T')[0],
      notes: streamData.notes !== undefined ? streamData.notes : target.notes,
      history: newHistory,
      lastEntryAmount: lastEntry,
      calculationType: streamData.calculationType || target.calculationType,
      dailyRate: streamData.dailyRate !== undefined ? streamData.dailyRate : target.dailyRate,
      workDays: streamData.workDays || target.workDays,
      workOnHolidays: streamData.workOnHolidays !== undefined ? streamData.workOnHolidays : target.workOnHolidays,
    };
    updatedList = baseList.map((s, idx) => (idx === existingIndex ? updatedStream : s));
  } else {
    updatedStream = {
      id: streamData.id || `stream-${Date.now()}`,
      name: streamData.name,
      amount: streamData.amount !== undefined ? streamData.amount : 0,
      targetGoal: streamData.targetGoal,
      nature: streamData.nature || 'fixed',
      icon: streamData.icon,
      dueDate: streamData.dueDate || 's/ previsão',
      isRecurrent: streamData.isRecurrent ?? true,
      received: streamData.received ?? false,
      receivedDate: streamData.receivedDate || (streamData.received ? new Date().toISOString().split('T')[0] : undefined),
      notes: streamData.notes,
      isMain: streamData.isMain || false,
      calculationType: streamData.calculationType,
      dailyRate: streamData.dailyRate,
      workDays: streamData.workDays,
      workOnHolidays: streamData.workOnHolidays,
    };
    updatedList = [...baseList, updatedStream];
  }

  let updatedMap: Record<string, any>;
  if (applyToAllMonths) {
    // Helper to deduplicate stream list by ID
    const dedupe = (list: IncomeStream[]) => {
      const seen = new Set<string>();
      return list.filter((item) => {
        const key = item.id || `${item.name}-${item.dueDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    const cleanUpdatedList = dedupe(updatedList);

    updatedMap = {
      ...incomesMap,
      [memberId]: cleanUpdatedList,
      [monthKey]: {
        ...monthData,
        [memberId]: cleanUpdatedList,
      },
    };

    // Also update any future stored month keys (strictly future months, k > monthKey)
    Object.keys(updatedMap).forEach((k) => {
      if (k.match(/^\d{4}-\d{2}$/) && k > monthKey && updatedMap[k]?.[memberId]) {
        const futureList = updatedMap[k][memberId] as IncomeStream[];
        if (streamData.id) {
          updatedMap[k][memberId] = dedupe(futureList.map((s) => (s.id === streamData.id ? updatedStream : s)));
        } else {
          // If future month didn't have it, add it uniquely
          const alreadyHas = futureList.some((s) => s.id === updatedStream.id || s.name.trim().toLowerCase() === updatedStream.name.trim().toLowerCase());
          if (!alreadyHas) {
            updatedMap[k][memberId] = dedupe([...futureList, updatedStream]);
          }
        }
      }
    });
  } else {
    // Helper to deduplicate stream list by ID
    const dedupe = (list: IncomeStream[]) => {
      const seen = new Set<string>();
      return list.filter((item) => {
        const key = item.id || `${item.name}-${item.dueDate}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    // Ensure baseline default for other unvisited months retains the original unedited streams
    const baseRootList = incomesMap[memberId] && Array.isArray(incomesMap[memberId]) && incomesMap[memberId].length > 0
      ? incomesMap[memberId]
      : baseList;

    // Only update this specific month
    updatedMap = {
      ...incomesMap,
      [memberId]: dedupe(baseRootList),
      [monthKey]: {
        ...monthData,
        [memberId]: dedupe(updatedList),
      },
    };
  }

  try {
    localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(updatedMap));
    localStorage.setItem('wepay_monthly_incomes', JSON.stringify(updatedMap));
    window.dispatchEvent(new Event('wepay_incomes_updated'));
    syncIncomesMapToFirestore(groupId, updatedMap);
  } catch (e) {
    console.error('Error saving incomes map:', e);
  }

  return updatedStream;
}

export function deleteIncomeStreamFromStorage(
  memberId: string,
  streamId: string,
  monthKey: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  applyToAllMonths: boolean = false,
  groupId?: string
): void {
  let incomesMap: Record<string, any> = {};
  try {
    const saved = localStorage.getItem('wepay_couple_incomes_v3') || localStorage.getItem('wepay_monthly_incomes');
    if (saved) {
      incomesMap = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error reading incomes for deletion:', e);
  }

  const monthData = incomesMap[monthKey] || {};
  let currentStreams: IncomeStream[] = [];
  if (monthData[memberId] && Array.isArray(monthData[memberId])) {
    currentStreams = monthData[memberId];
  } else if (incomesMap[memberId] && Array.isArray(incomesMap[memberId])) {
    currentStreams = incomesMap[memberId];
  }

  const updatedList = currentStreams.filter((s) => s.id !== streamId);
  let updatedMap: Record<string, any> = {};

  if (applyToAllMonths) {
    const baseList = (incomesMap[memberId] && Array.isArray(incomesMap[memberId])) ? incomesMap[memberId] : currentStreams;
    const cleanBaseList = baseList.filter((s: IncomeStream) => s.id !== streamId);

    updatedMap = {
      ...incomesMap,
      [memberId]: cleanBaseList,
      [monthKey]: {
        ...monthData,
        [memberId]: updatedList,
      },
    };

    // Also remove from any future month keys
    Object.keys(updatedMap).forEach((k) => {
      if (k.match(/^\d{4}-\d{2}$/) && k > monthKey && updatedMap[k]?.[memberId] && Array.isArray(updatedMap[k][memberId])) {
        updatedMap[k][memberId] = updatedMap[k][memberId].filter((s: IncomeStream) => s.id !== streamId);
      }
    });
  } else {
    const baseRootList = incomesMap[memberId] && Array.isArray(incomesMap[memberId])
      ? incomesMap[memberId]
      : currentStreams;

    updatedMap = {
      ...incomesMap,
      [memberId]: baseRootList,
      [monthKey]: {
        ...monthData,
        [memberId]: updatedList,
      },
    };
  }

  try {
    localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(updatedMap));
    localStorage.setItem('wepay_monthly_incomes', JSON.stringify(updatedMap));
    window.dispatchEvent(new Event('wepay_incomes_updated'));
    syncIncomesMapToFirestore(groupId, updatedMap);
  } catch (e) {
    console.error('Error saving incomes map after deletion:', e);
  }
}

export function getMonthlyIncomeData(
  monthKey: string,
  members: FamilyMember[],
  transactions?: Transaction[]
): MonthlyIncomeResult {
  let incomesMap: any = {};
  let monthlyIncomesMap: any = {};

  try {
    const savedV3 = localStorage.getItem('wepay_couple_incomes_v3');
    if (savedV3) incomesMap = JSON.parse(savedV3);

    const savedMonthly = localStorage.getItem('wepay_monthly_incomes');
    if (savedMonthly) monthlyIncomesMap = JSON.parse(savedMonthly);
  } catch (e) {
    console.error('Error reading incomes from localStorage:', e);
  }

  // If transactions exist or are stored, auto-merge any income transactions into the map
  const activeTxs = transactions || (() => {
    try {
      const savedTxs = localStorage.getItem('wepay_transactions');
      if (savedTxs) return JSON.parse(savedTxs);
    } catch (e) {}
    return [];
  })();

  if (Array.isArray(activeTxs) && activeTxs.length > 0) {
    incomesMap = recoverIncomesFromTransactions(incomesMap, activeTxs, members);
  }

  const monthData = incomesMap[monthKey] || monthlyIncomesMap[monthKey] || {};

  let totalFixedIncome = 0;
  let totalValesIncome = 0;
  let totalExtraIncome = 0;
  const memberTotals: Record<string, { fixed: number; vales: number; extra: number; total: number }> = {};

  members.forEach((member, idx) => {
    let streams: IncomeStream[] | undefined = undefined;

    if (monthData[member.id] && Array.isArray(monthData[member.id]) && monthData[member.id].length > 0) {
      streams = monthData[member.id];
    } else if (incomesMap[member.id] && Array.isArray(incomesMap[member.id]) && incomesMap[member.id].length > 0) {
      streams = incomesMap[member.id];
    } else if (monthlyIncomesMap[member.id] && Array.isArray(monthlyIncomesMap[member.id]) && monthlyIncomesMap[member.id].length > 0) {
      streams = monthlyIncomesMap[member.id];
    }

    if (!streams || streams.length === 0) {
      // Flexible search in monthData and incomesMap by candidate keys
      const candidateKeys = Array.from(
        new Set([...Object.keys(monthData || {}), ...Object.keys(incomesMap || {}), ...Object.keys(monthlyIncomesMap || {})])
      ).filter((k) => !k.match(/^\d{4}-\d{2}$/));

      const memName = (member.name || '').toLowerCase().trim();
      for (const k of candidateKeys) {
        const kLow = k.toLowerCase().trim();
        if (
          (memName && kLow.includes(memName)) ||
          (memName.includes('josy') && kLow.includes('josy')) ||
          (memName.includes('josefa') && (kLow.includes('josefa') || kLow.includes('josy'))) ||
          (memName.includes('thiago') && (kLow.includes('thiago') || kLow.includes('thyago'))) ||
          (memName.includes('thyago') && (kLow.includes('thiago') || kLow.includes('thyago'))) ||
          (idx === 1 && (kLow.includes('m2') || kLow.includes('mariana') || kLow.includes('mulher') || kLow.includes('josy'))) ||
          (idx === 0 && (kLow.includes('m1') || kLow.includes('thiago') || kLow.includes('homem')))
        ) {
          const found = monthData[k] || incomesMap[k] || monthlyIncomesMap[k];
          if (Array.isArray(found) && found.length > 0) {
            streams = found;
            break;
          }
        }
      }
    }

    if (streams === undefined || streams.length === 0) {
      const isDemo = typeof window !== 'undefined' && localStorage.getItem('wepay_is_demo') === 'true';
      if (member.income && member.income > 0) {
        streams = [
          {
            id: `main-${member.id}`,
            name: 'Salário / Renda Principal',
            amount: member.income,
            nature: 'fixed',
            isMain: true,
          },
        ];
      } else if (isDemo) {
        streams = [
          {
            id: `main-${member.id}`,
            name: 'Salário / Renda Principal',
            amount: 3000,
            nature: 'fixed',
            isMain: true,
          },
        ];
      } else {
        streams = [];
      }
    }

    // Deduplicate streams
    const seen = new Set<string>();
    streams = (streams || []).filter((s) => {
      const key = s.id || `${s.name}-${s.dueDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const fixed = streams
      .filter((s) => s.nature === 'fixed' || (s.nature as string) === 'variable')
      .reduce((acc, s) => acc + (s.amount || 0), 0);

    const vales = streams
      .filter((s) => s.nature === 'vales')
      .reduce((acc, s) => acc + getStreamAmount(s, monthKey), 0);

    const extra = streams
      .filter((s) => s.nature === 'extra')
      .reduce((acc, s) => acc + Math.max(s.targetGoal || 0, s.amount || 0), 0);

    const memberTotal = fixed + vales + extra;

    memberTotals[member.id] = {
      fixed,
      vales,
      extra,
      total: memberTotal,
    };

    totalFixedIncome += fixed;
    totalValesIncome += vales;
    totalExtraIncome += extra;
  });

  const totalFamilyIncome = totalFixedIncome + totalValesIncome + totalExtraIncome;

  return {
    totalFixedIncome,
    totalValesIncome,
    totalExtraIncome,
    totalFamilyIncome,
    memberTotals,
  };
}

export function getMemberIncomeOptions(
  whoOption: 'casal' | 'homem' | 'mulher',
  members: FamilyMember[],
  monthKey: string = '2026-08'
): { id: string; name: string; icon: string; nature?: string }[] {
  let incomesMap: Record<string, any> = {};
  let monthlyIncomesMap: Record<string, any> = {};

  try {
    const savedV3 = localStorage.getItem('wepay_couple_incomes_v3');
    if (savedV3) incomesMap = JSON.parse(savedV3);

    const savedMonthly = localStorage.getItem('wepay_monthly_incomes');
    if (savedMonthly) monthlyIncomesMap = JSON.parse(savedMonthly);
  } catch (e) {
    console.error('Error reading incomes from localStorage:', e);
  }

  const maleMember: FamilyMember = members[0] || { id: 'm1', name: 'Membro 1', color: '#3b82f6', avatar: '', role: 'admin' };
  const femaleMember: FamilyMember = members[1] || members[0] || { id: 'm2', name: 'Membro 2', color: '#ec4899', avatar: '', role: 'member' };

  const getExtraStreamsForMember = (member: FamilyMember) => {
    if (!member) return [];

    let streams: IncomeStream[] = [];

    if (incomesMap[member.id] && Array.isArray(incomesMap[member.id])) {
      streams = incomesMap[member.id];
    } else if (monthlyIncomesMap[monthKey] && monthlyIncomesMap[monthKey][member.id] && Array.isArray(monthlyIncomesMap[monthKey][member.id])) {
      streams = monthlyIncomesMap[monthKey][member.id];
    }

    if (streams && streams.length > 0) {
      const extraOnly = streams.filter(
        (s) => s.nature !== 'fixed' && !s.isMain && !s.name.toLowerCase().includes('salário') && !s.name.toLowerCase().includes('salario')
      );
      if (extraOnly.length > 0) {
        return extraOnly.map((s) => ({
          id: s.id,
          name: s.name,
          icon: s.icon || (s.nature === 'vales' ? '🍱' : '💻'),
          nature: s.nature,
        }));
      }
    }
    return [];
  };

  let result: { id: string; name: string; icon: string; nature?: string }[] = [];

  if (whoOption === 'homem') {
    result = getExtraStreamsForMember(maleMember);
  } else if (whoOption === 'mulher') {
    result = getExtraStreamsForMember(femaleMember);
  } else {
    const m1Streams = getExtraStreamsForMember(maleMember);
    const m2Streams = getExtraStreamsForMember(femaleMember);
    result = [...m1Streams, ...m2Streams];
  }

  const uniqueResult: { id: string; name: string; icon: string; nature?: string }[] = [];
  const seenNames = new Set<string>();
  for (const item of result) {
    if (!seenNames.has(item.name)) {
      seenNames.add(item.name);
      uniqueResult.push(item);
    }
  }

  if (!seenNames.has('Outros')) {
    uniqueResult.push({
      id: 'outros',
      name: 'Outros',
      icon: '💵',
      nature: 'extra',
    });
  }

  return uniqueResult;
}

/**
 * Format member names with initial capital letters for each word.
 * E.g. "thiago silva" -> "Thiago Silva", "MARIA" -> "Maria"
 */
export function formatMemberName(name?: string): string {
  if (!name) return '';
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function getFullMemberIncomeStreams(
  memberId: string,
  monthKey: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
): IncomeStream[] {
  let incomesMap: Record<string, any> = {};
  let monthlyIncomesMap: Record<string, any> = {};
  try {
    const savedV3 = localStorage.getItem('wepay_couple_incomes_v3');
    if (savedV3) incomesMap = JSON.parse(savedV3);
    const savedMonthly = localStorage.getItem('wepay_monthly_incomes');
    if (savedMonthly) monthlyIncomesMap = JSON.parse(savedMonthly);
  } catch (e) {
    console.error('Error reading incomes:', e);
  }

  let streams: IncomeStream[] = [];
  if (monthlyIncomesMap[monthKey] && monthlyIncomesMap[monthKey][memberId] && Array.isArray(monthlyIncomesMap[monthKey][memberId])) {
    streams = monthlyIncomesMap[monthKey][memberId];
  } else if (incomesMap[memberId] && Array.isArray(incomesMap[memberId])) {
    streams = incomesMap[memberId];
  }

  return (streams || []).filter(
    (s) => s.nature === 'extra' || (s.nature !== 'fixed' && !s.isMain && !s.name.toLowerCase().includes('salário') && !s.name.toLowerCase().includes('salario'))
  );
}
