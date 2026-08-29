import { FamilyMember, IncomeStream, IncomeNature, FixedExpenseItem, Transaction } from '../types';
import { db, doc, getDoc, setDoc, sanitizeForFirestore } from '../lib/firebase';

export interface MonthlyIncomeResult {
  totalFixedIncome: number;
  totalValesIncome: number;
  totalExtraIncome: number;
  totalFamilyIncome: number; // Planejamento / Previsão total
  totalReceivedIncome: number; // Efetivamente recebido em caixa
  totalPendingIncome: number; // A receber
  memberTotals: Record<string, { fixed: number; vales: number; extra: number; total: number; received: number }>;
}

/**
 * Helper to get default icon for income stream by name
 */
export function getStreamIcon(name: string, customIcon?: string): string {
  if (customIcon) return customIcon;
  const lower = (name || '').toLowerCase();
  if (lower.includes('salário') || lower.includes('salario')) return '💼';
  if (lower.includes('vale') || lower.includes('refeição') || lower.includes('alimentação')) return '🍱';
  if (lower.includes('uber') || lower.includes('99') || lower.includes('corrida') || lower.includes('motorista')) return '🚗';
  if (lower.includes('comissão') || lower.includes('comissao') || lower.includes('bônus') || lower.includes('bonus')) return '🎁';
  if (lower.includes('freelance') || lower.includes('freela') || lower.includes('tech') || lower.includes('dev')) return '💻';
  if (lower.includes('invest') || lower.includes('dividendo')) return '💰';
  if (lower.includes('consult') || lower.includes('consultoria')) return '📊';
  return '💵';
}

/**
 * Helper to check if a stream is valid for a specific month
 */
export function isStreamValidForMonth(stream: IncomeStream, monthKey: string): boolean {
  if (!monthKey || !monthKey.match(/^\d{4}-\d{2}$/)) return true;
  
  // 1. Check startDate (if defined, must be >= startDate)
  const startDate = stream.startDate || '';
  if (startDate && startDate.match(/^\d{4}-\d{2}$/)) {
    if (monthKey < startDate) return false;
  }
  
  // 2. Check endDate (if defined, must be <= endDate)
  const endDate = stream.endDate || '';
  if (endDate && endDate.match(/^\d{4}-\d{2}$/)) {
    if (monthKey > endDate) return false;
  }
  
  // 3. Check excludedMonths (specific month exceptions)
  if (stream.excludedMonths && stream.excludedMonths.includes(monthKey)) return false;
  
  // 4. If non-recurrent, it MUST match the startDate exactly
  // If no startDate is present for a non-recurrent stream, we consider it invalid for ALL months
  // to avoid it leaking into months where it doesn't belong.
  if (stream.isRecurrent === false) {
    if (startDate && startDate.match(/^\d{4}-\d{2}$/)) {
      return monthKey === startDate;
    }
    return false;
  }

  return true;
}

/**
 * Pure function to calculate the new income map state after a deletion
 */
export function getUpdatedIncomeMapAfterDeletion(
  incomesMap: Record<string, any>,
  memberId: string,
  streamId: string,
  monthKey: string,
  deleteMode: 'thisMonth' | 'future' | 'all'
): Record<string, any> {
  const updatedMap = { ...incomesMap };
  const monthData = incomesMap[monthKey] || {};
  const currentStreams = Array.isArray(monthData[memberId])
    ? monthData[memberId]
    : Array.isArray(incomesMap[memberId])
    ? (incomesMap[memberId] as IncomeStream[])
    : [];
  const baseList = Array.isArray(incomesMap[memberId]) ? (incomesMap[memberId] as IncomeStream[]) : [];

  if (deleteMode === 'all') {
    // 1. Remove from base root list
    updatedMap[memberId] = baseList.filter((s) => s.id !== streamId);

    // 2. Remove from ALL month keys
    Object.keys(updatedMap).forEach((k) => {
      if (k.match(/^\d{4}-\d{2}$/) && updatedMap[k]?.[memberId]) {
        updatedMap[k][memberId] = (updatedMap[k][memberId] as IncomeStream[]).filter((s) => s.id !== streamId);
      }
    });
  } else if (deleteMode === 'future') {
    // 1. Set endDate in root list (end at previous month)
    const [year, month] = monthKey.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    updatedMap[memberId] = baseList.map((s) => {
      if (s.id === streamId) {
        return { ...s, endDate: prevMonthKey };
      }
      return s;
    });

    // 2. Remove from current month and ALL future months
    Object.keys(updatedMap).forEach((k) => {
      if (k.match(/^\d{4}-\d{2}$/) && k >= monthKey && updatedMap[k]?.[memberId]) {
        updatedMap[k][memberId] = (updatedMap[k][memberId] as IncomeStream[]).filter((s) => s.id !== streamId);
      }
    });
  } else {
    // deleteMode === 'thisMonth' (Exception)
    // 1. Add exception to root list
    updatedMap[memberId] = baseList.map((s) => {
      if (s.id === streamId) {
        const excluded = s.excludedMonths || [];
        if (!excluded.includes(monthKey)) {
          return { ...s, excludedMonths: [...excluded, monthKey] };
        }
      }
      return s;
    });

    // 2. Remove ONLY from current month
    updatedMap[monthKey] = {
      ...monthData,
      [memberId]: currentStreams.filter((s) => s.id !== streamId),
    };
  }

  return updatedMap;
}

/**
 * Cleans phantom income streams and normalizes entries without merging distinct IDs
 */
export function cleanGhostIncomeStreams(incomesMap: Record<string, any> = {}): Record<string, any> {
  if (!incomesMap || typeof incomesMap !== 'object') return {};
  const result: Record<string, any> = {};

  const cleanList = (list: IncomeStream[] = []): IncomeStream[] => {
    if (!Array.isArray(list)) return [];
    const seen = new Map<string, IncomeStream>();

    list.forEach((item, index) => {
      if (!item || !item.name) return;
      let rawName = item.name.trim();

      // Normalize name by removing auto-generated prefixes or timestamp suffixes
      let cleanName = rawName
        .replace(/^\[renda\]\s*/i, '')
        .replace(/\s*-\s*Recebimento.*$/i, '')
        .replace(/\s*\([^)]*\)$/, '')
        .trim();

      if (!cleanName || cleanName.toLowerCase().startsWith('recebi dia')) {
        cleanName = item.nature === 'extra' ? 'Renda Extra' : (item.nature === 'vales' ? 'Vale Alimentação' : 'Salário');
      }

      const nature: IncomeNature = item.nature || 'fixed';
      const cleanIcon = getStreamIcon(cleanName, item.icon);
      const stableId = item.id || `stream_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${index}`;

      const sanitizedItem: IncomeStream = {
        ...item,
        id: stableId,
        name: cleanName,
        nature,
        icon: cleanIcon,
        dueDate: item.dueDate || 's/ previsão',
        isRecurrent: item.isRecurrent ?? (nature !== 'extra'),
        received: item.received ?? false,
      };

      // Deduplicate strictly by stable ID
      if (!seen.has(stableId)) {
        seen.set(stableId, sanitizedItem);
      } else {
        const existing = seen.get(stableId)!;
        const currentAmount = sanitizedItem.amount || 0;
        const existingAmount = existing.amount || 0;
        const mergedAmount = Math.max(existingAmount, currentAmount);
        const isReceived = existing.received || sanitizedItem.received;
        const mergedHistory = [...(existing.history || []), ...(sanitizedItem.history || [])];

        seen.set(stableId, {
          ...existing,
          ...sanitizedItem,
          amount: mergedAmount,
          received: isReceived,
          receivedDate: sanitizedItem.receivedDate || existing.receivedDate,
          history: mergedHistory.length > 0 ? mergedHistory : undefined,
          targetGoal: sanitizedItem.targetGoal || existing.targetGoal || mergedAmount,
        });
      }
    });

    return Array.from(seen.values());
  };

  Object.keys(incomesMap).forEach((k) => {
    const val = incomesMap[k];
    if (k.match(/^\d{4}-\d{2}$/) && typeof val === 'object' && val !== null) {
      const monthObj: Record<string, IncomeStream[]> = {};
      Object.keys(val).forEach((mKey) => {
        if (Array.isArray(val[mKey])) {
          monthObj[mKey] = cleanList(val[mKey]);
        }
      });
      result[k] = monthObj;
    } else if (Array.isArray(val)) {
      result[k] = cleanList(val);
    } else {
      result[k] = val;
    }
  });

  return result;
}

/**
 * Merges two incomes maps with respect for authoritative changes
 */
export function deepMergeIncomesMaps(
  base: Record<string, any> = {},
  incoming: Record<string, any> = {}
): Record<string, any> {
  const cleanBase = cleanGhostIncomeStreams(base || {});
  const cleanInc = cleanGhostIncomeStreams(incoming || {});
  const result: Record<string, any> = { ...cleanBase };

  const mergeStreamArrays = (listA: IncomeStream[] = [], listB: IncomeStream[] = []): IncomeStream[] => {
    const map = new Map<string, IncomeStream>();
    (Array.isArray(listA) ? listA : []).forEach((item) => {
      if (item && item.id) {
        map.set(item.id, item);
      }
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
    return Array.from(map.values());
  };

  const allKeys = new Set([...Object.keys(cleanBase || {}), ...Object.keys(cleanInc || {})]);

  allKeys.forEach((key) => {
    const valBase = cleanBase?.[key];
    const valInc = cleanInc?.[key];

    if (key.match(/^\d{4}-\d{2}$/)) {
      const monthObjA = typeof valBase === 'object' && valBase !== null ? valBase : {};
      const monthObjB = typeof valInc === 'object' && valInc !== null ? valInc : {};
      const memberKeys = new Set([...Object.keys(monthObjA), ...Object.keys(monthObjB)]);
      const mergedMonth: Record<string, IncomeStream[]> = {};
      memberKeys.forEach((mKey) => {
        // If incoming has explicit definition (even empty array), prefer it
        if (Array.isArray(monthObjB[mKey])) {
          mergedMonth[mKey] = monthObjB[mKey];
        } else if (Array.isArray(monthObjA[mKey])) {
          mergedMonth[mKey] = monthObjA[mKey];
        }
      });
      result[key] = mergedMonth;
    } else if (Array.isArray(valInc)) {
      result[key] = valInc;
    } else if (Array.isArray(valBase)) {
      result[key] = valBase;
    } else if (typeof valBase === 'object' || typeof valInc === 'object') {
      result[key] = { ...(valBase || {}), ...(valInc || {}) };
    } else {
      result[key] = valInc !== undefined ? valInc : valBase;
    }
  });

  return cleanGhostIncomeStreams(result);
}

export function recoverIncomesFromTransactions(
  incomesMap: Record<string, any> = {},
  transactions: Transaction[] = [],
  members: FamilyMember[] = []
): Record<string, any> {
  const result: Record<string, any> = cleanGhostIncomeStreams(incomesMap || {});

  transactions.forEach((tx) => {
    if (tx.status === 'deleted' || tx.status === 'reverted') return;

    // Strict check: only actual income transactions, never regular "Serviços" expenses!
    const isIncomeTx =
      tx.type === 'income' ||
      Boolean(tx.incomeStreamId) ||
      (tx.description && tx.description.toLowerCase().startsWith('[renda]'));

    if (isIncomeTx && tx.amount > 0) {
      const nowKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const monthKey = tx.incomeMonthKey || (tx.date ? tx.date.substring(0, 7) : nowKey);

      // Determine target member
      let targetMember = members.find((m) => m.id === tx.paidByMemberId);

      if (!targetMember) {
        // Fallback: try to match by name dynamically
        const txDesc = (tx.description || '').toLowerCase();
        const txNotes = (tx.notes || '').toLowerCase();
        targetMember = members.find((m) => {
          const mName = m.name.toLowerCase().trim();
          return mName && (txDesc.includes(mName) || txNotes.includes(mName));
        });
      }

      if (!targetMember) {
        targetMember = members[0]; // fallback
      }

      if (!targetMember) return; // No members available

      const memberId = targetMember.id;

      // Clean stream name
      let cleanName = tx.description
        .replace(/^\[renda\]\s*/i, '')
        .replace(/\s*-\s*Recebimento.*$/i, '')
        .replace(/\s*\([^)]*\)$/, '')
        .trim();

      if (!cleanName || cleanName.toLowerCase().startsWith('recebi dia')) {
        if (tx.category === 'Salário' || cleanName.toLowerCase().includes('salár')) {
          cleanName = 'Salário';
        } else {
          cleanName = 'Renda Extra';
        }
      }

      let nature: IncomeNature = 'fixed';
      const cleanLower = cleanName.toLowerCase();
      if (cleanLower.includes('vale') || cleanLower.includes('refeição') || cleanLower.includes('alimentação')) {
        nature = 'vales';
      } else if (
        cleanLower.includes('extra') ||
        cleanLower.includes('freela') ||
        cleanLower.includes('consult') ||
        cleanLower.includes('bico') ||
        cleanLower.includes('uber') ||
        cleanLower.includes('99') ||
        cleanLower.includes('comissão') ||
        cleanLower.includes('bonus')
      ) {
        nature = 'extra';
      }

      const deterministicId = tx.incomeStreamId || `stream_${memberId}_${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      if (!result[monthKey]) result[monthKey] = {};
      const currentMonthList: IncomeStream[] = Array.isArray(result[monthKey][memberId]) ? [...result[monthKey][memberId]] : [];

      const existingIndex = currentMonthList.findIndex((s) => s.id === deterministicId || s.name.trim().toLowerCase() === cleanName.trim().toLowerCase());

      const recoveredStream: IncomeStream = {
        id: deterministicId,
        name: cleanName,
        amount: tx.amount,
        targetGoal: tx.amount,
        nature,
        icon: getStreamIcon(cleanName),
        dueDate: 's/ previsão',
        isRecurrent: nature !== 'extra',
        startDate: monthKey, // Fix: Set startDate to transaction month
        received: true,
        receivedDate: tx.date ? tx.date.split('T')[0] : undefined,
        notes: tx.notes || `Renda sincronizada`,
      };

      if (existingIndex >= 0) {
        const existing = currentMonthList[existingIndex];
        currentMonthList[existingIndex] = {
          ...existing,
          amount: Math.max(existing.amount || 0, tx.amount),
          received: true,
          receivedDate: tx.date ? tx.date.split('T')[0] : (existing.receivedDate ? existing.receivedDate.split('T')[0] : undefined),
        };
      } else {
        currentMonthList.push(recoveredStream);
      }

      result[monthKey][memberId] = currentMonthList;
    }
  });

  return cleanGhostIncomeStreams(result);
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
 * Checks if a fixed expense is marked as paid in a specific monthKey (e.g. "2026-08").
 * Uses paidMonths array if present, otherwise falls back to isPaid.
 */
export function isFixedExpensePaidInMonth(
  item?: FixedExpenseItem | null,
  monthKey?: string
): boolean {
  if (!item) return false;
  const validKey =
    typeof monthKey === 'string' && monthKey.match(/^\d{4}-\d{2}$/)
      ? monthKey
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  if (Array.isArray(item.paidMonths)) {
    return item.paidMonths.includes(validKey);
  }

  if (item.monthKey && item.monthKey === validKey && typeof item.isPaid === 'boolean') {
    return item.isPaid;
  }

  if (typeof item.isPaid === 'boolean') {
    return item.isPaid;
  }

  return false;
}

/**
 * Checks if a fixed expense is active in a specific monthKey.
 * Validates recurrenceType, installments range, single_month match, and excludedMonths.
 */
export function isFixedExpenseActiveInMonth(
  item?: FixedExpenseItem | null,
  monthKey?: string
): boolean {
  if (!item) return false;
  const validKey =
    typeof monthKey === 'string' && monthKey.match(/^\d{4}-\d{2}$/)
      ? monthKey
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // Check excluded months
  if (Array.isArray(item.excludedMonths) && item.excludedMonths.includes(validKey)) {
    return false;
  }

  // Single month recurrence
  if (item.recurrenceType === 'single_month') {
    const targetMonth = item.monthKey || item.startMonthKey;
    if (targetMonth && targetMonth.match(/^\d{4}-\d{2}$/)) {
      return targetMonth === validKey;
    }
    return true;
  }

  // Installment recurrence
  if (item.recurrenceType === 'installment') {
    const start = item.startMonthKey || item.monthKey;
    if (!start || !start.match(/^\d{4}-\d{2}$/)) return true;

    const [sy, sm] = start.split('-').map(Number);
    const [cy, cm] = validKey.split('-').map(Number);
    const currentNum = (cy - sy) * 12 + (cm - sm) + 1;

    let total = item.totalInstallments;
    if (!total && item.endMonthKey && item.endMonthKey.match(/^\d{4}-\d{2}$/)) {
      const [ey, em] = item.endMonthKey.split('-').map(Number);
      total = (ey - sy) * 12 + (em - sm) + 1;
    }
    total = Math.max(total || 1, 1);

    return currentNum >= 1 && currentNum <= total;
  }

  // Start month check
  if (item.startMonthKey && item.startMonthKey.match(/^\d{4}-\d{2}$/)) {
    if (validKey < item.startMonthKey) return false;
  }

  // End month check
  if (item.endMonthKey && item.endMonthKey.match(/^\d{4}-\d{2}$/)) {
    if (validKey > item.endMonthKey) return false;
  }

  return true;
}

/**
 * Synchronizes the entire incomes map to Firestore under the doc /incomes/{groupId}
 */
export async function syncIncomesMapToFirestore(
  groupId?: string,
  customMap?: Record<string, any>,
  isAuthoritative: boolean = false
) {
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

    let mapToSave = cleanGhostIncomeStreams(localMap || {});

    if (!isAuthoritative && !customMap) {
      let remoteMap: Record<string, any> = {};
      try {
        const docSnap = await getDoc(doc(db, 'incomes', targetGroupId));
        if (docSnap.exists() && docSnap.data().incomesMap) {
          remoteMap = cleanGhostIncomeStreams(docSnap.data().incomesMap);
        }
      } catch (fetchErr) {
        console.warn('Incomes remote read check notice:', fetchErr);
      }
      mapToSave = deepMergeIncomesMaps(remoteMap, mapToSave);
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(mapToSave));
      localStorage.setItem('wepay_monthly_incomes', JSON.stringify(mapToSave));
      window.dispatchEvent(new Event('wepay_incomes_updated'));
    }

    await setDoc(
      doc(db, 'incomes', targetGroupId),
      sanitizeForFirestore({
        incomesMap: mapToSave,
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
  streamData: Partial<IncomeStream> & { id?: string; name: string; isAccumulate?: boolean },
  monthKey: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  groupId?: string,
  applyToAllMonths: boolean = true
): { stream: IncomeStream; updatedMap: Record<string, any> } {
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

  const finalIsRecurrent = streamData.isRecurrent !== undefined 
    ? streamData.isRecurrent 
    : (existingIndex >= 0 ? (baseList[existingIndex].isRecurrent ?? true) : true);

  // If not recurrent, we force applyToAllMonths to false to ensure it's a one-time entry
  const shouldApplyToAll = finalIsRecurrent && applyToAllMonths;

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
      isRecurrent: finalIsRecurrent,
      startDate: target.startDate || monthKey,
      endDate: finalIsRecurrent ? (streamData.endDate || target.endDate) : monthKey, // Force end date if not recurrent
      excludedMonths: streamData.excludedMonths || target.excludedMonths,
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
      isRecurrent: finalIsRecurrent,
      startDate: monthKey,
      endDate: finalIsRecurrent ? undefined : monthKey, // Force end date if not recurrent
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
  
  // Helper to deduplicate stream list by ID
  const dedupe = (list: IncomeStream[]) => {
    const seen = new Set<string>();
    return list.filter((item) => {
      if (!item || !item.id) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  if (shouldApplyToAll) {
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
          const alreadyHas = futureList.some((s) => s.id === updatedStream.id);
          if (!alreadyHas) {
            updatedMap[k][memberId] = dedupe([...futureList, updatedStream]);
          }
        }
      }
    });
  } else {
    // If NOT recurrent, we MUST ensure it's removed from the global template
    const baseRootList = Array.isArray(incomesMap[memberId]) ? (incomesMap[memberId] as IncomeStream[]) : [];
    const cleanBaseRootList = baseRootList.filter(s => s.id !== updatedStream.id);

    // Only update this specific month
    updatedMap = {
      ...incomesMap,
      [memberId]: dedupe(cleanBaseRootList),
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
    if (groupId) {
      syncIncomesMapToFirestore(groupId, updatedMap, true);
    }
  } catch (e) {
    console.error('Error saving updated incomes map:', e);
  }

  return { stream: updatedStream, updatedMap };
}

export function deleteIncomeStreamFromStorage(
  memberId: string,
  streamId: string,
  monthKey: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  deleteMode: 'thisMonth' | 'future' | 'all' = 'thisMonth',
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

  incomesMap = cleanGhostIncomeStreams(incomesMap);
  const updatedMap = getUpdatedIncomeMapAfterDeletion(incomesMap, memberId, streamId, monthKey, deleteMode);

  try {
    localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(updatedMap));
    localStorage.setItem('wepay_monthly_incomes', JSON.stringify(updatedMap));
    window.dispatchEvent(new Event('wepay_incomes_updated'));
    if (groupId) {
      syncIncomesMapToFirestore(groupId, updatedMap, true);
    }
  } catch (e) {
    console.error('Error saving incomes map after deletion:', e);
  }
}

export function getMonthlyIncomeData(
  monthKey: string,
  members: FamilyMember[],
  _transactions?: Transaction[]
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

  incomesMap = cleanGhostIncomeStreams(incomesMap);
  monthlyIncomesMap = cleanGhostIncomeStreams(monthlyIncomesMap);

  const monthData = incomesMap[monthKey] || monthlyIncomesMap[monthKey] || {};

  let totalFixedIncome = 0;
  let totalValesIncome = 0;
  let totalExtraIncome = 0;
  let totalReceivedIncome = 0;
  const memberTotals: Record<string, { fixed: number; vales: number; extra: number; total: number; received: number }> = {};

  members.forEach((member, idx) => {
    let streams: IncomeStream[] | undefined = undefined;

    // 1. Explicit month-level data has highest priority (even if empty)
    if (monthData && Array.isArray(monthData[member.id])) {
      streams = (monthData[member.id] as IncomeStream[]).filter(s => isStreamValidForMonth(s, monthKey));
    } else if (incomesMap && Array.isArray(incomesMap[member.id])) {
      // If using template, ONLY include recurrent incomes and respect dates
      streams = (incomesMap[member.id] as IncomeStream[])
        .filter(s => isStreamValidForMonth(s, monthKey));
    } else if (monthlyIncomesMap && Array.isArray(monthlyIncomesMap[member.id])) {
      streams = (monthlyIncomesMap[member.id] as IncomeStream[])
        .filter(s => isStreamValidForMonth(s, monthKey));
    }

    if (!streams) {
      const candidateKeys = Array.from(
        new Set([...Object.keys(monthData || {}), ...Object.keys(incomesMap || {}), ...Object.keys(monthlyIncomesMap || {})])
      ).filter((k) => !k.match(/^\d{4}-\d{2}$/));

      const memName = (member.name || '').toLowerCase().trim();
      for (const k of candidateKeys) {
        const kLow = k.toLowerCase().trim();
        if (
          kLow === member.id.toLowerCase() ||
          (memName && kLow.includes(memName))
        ) {
          const found = monthData[k] || incomesMap[k] || monthlyIncomesMap[k];
          if (Array.isArray(found)) {
            streams = (found as IncomeStream[]).filter(s => isStreamValidForMonth(s, monthKey));
            if (streams.length > 0) break;
          }
        }
      }
    }

    if (streams === undefined) {
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

    // Deduplicate streams strictly by ID
    const seen = new Set<string>();
    streams = (streams || []).filter((s) => {
      const key = s.id;
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

    // Calculate real received in cash
    const receivedFixed = streams
      .filter((s) => (s.nature === 'fixed' || (s.nature as string) === 'variable') && s.received)
      .reduce((acc, s) => acc + (s.amount || 0), 0);

    const receivedVales = streams
      .filter((s) => s.nature === 'vales' && s.received)
      .reduce((acc, s) => acc + getStreamAmount(s, monthKey), 0);

    const receivedExtra = streams
      .filter((s) => s.nature === 'extra')
      .reduce((acc, s) => acc + (s.amount || 0), 0); // actual extra received

    const memberReceived = receivedFixed + receivedVales + receivedExtra;

    memberTotals[member.id] = {
      fixed,
      vales,
      extra,
      total: memberTotal,
      received: memberReceived,
    };

    totalFixedIncome += fixed;
    totalValesIncome += vales;
    totalExtraIncome += extra;
    totalReceivedIncome += memberReceived;
  });

  const totalFamilyIncome = totalFixedIncome + totalValesIncome + totalExtraIncome;
  const totalPendingIncome = Math.max(0, totalFamilyIncome - totalReceivedIncome);

  return {
    totalFixedIncome,
    totalValesIncome,
    totalExtraIncome,
    totalFamilyIncome,
    totalReceivedIncome,
    totalPendingIncome,
    memberTotals,
  };
}

export function getMemberIncomeOptions(
  whoOption: 'casal' | 'homem' | 'mulher',
  members: FamilyMember[],
  monthKey: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
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

    if (monthlyIncomesMap[monthKey] && monthlyIncomesMap[monthKey][member.id] && Array.isArray(monthlyIncomesMap[monthKey][member.id])) {
      streams = (monthlyIncomesMap[monthKey][member.id] as IncomeStream[]).filter(s => isStreamValidForMonth(s, monthKey));
    } else if (incomesMap[member.id] && Array.isArray(incomesMap[member.id])) {
      streams = (incomesMap[member.id] as IncomeStream[]).filter(s => s.isRecurrent !== false && isStreamValidForMonth(s, monthKey));
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
    streams = (monthlyIncomesMap[monthKey][memberId] as IncomeStream[]).filter(s => isStreamValidForMonth(s, monthKey));
  } else if (incomesMap[memberId] && Array.isArray(incomesMap[memberId])) {
    streams = (incomesMap[memberId] as IncomeStream[]).filter(s => s.isRecurrent !== false && isStreamValidForMonth(s, monthKey));
  }

  return (streams || []).filter(
    (s) => s.nature === 'extra' || (s.nature !== 'fixed' && !s.isMain && !s.name.toLowerCase().includes('salário') && !s.name.toLowerCase().includes('salario'))
  );
}
