import { useMemo } from 'react';
import { FamilyGroup, FamilyMember, Transaction, IncomeStream, FixedExpenseItem, PiggyBankItem } from '../types';
import { INITIAL_GROUP, INITIAL_TRANSACTIONS, INITIAL_FIXED_EXPENSES, INITIAL_PIGGY_BANKS } from '../data/mockInitialData';
import { useAppStore } from '../store/useAppStore';
import { db, doc, setDoc, getDoc, auth, sanitizeForFirestore } from '../lib/firebase';
import {
  saveIncomeStreamToStorage,
  deleteIncomeStreamFromStorage,
  getStreamAmount,
  syncIncomesMapToFirestore,
  deepMergeFixedExpenses,
} from '../utils/incomeUtils';

const DEFAULT_MEMBER: FamilyMember = {
  id: 'default',
  name: 'Membro',
  avatar: '',
  color: '#3b82f6',
  role: 'admin',
};

export function useFamilyActions() {
  const {
    group,
    setGroup,
    currentMemberId,
    setCurrentMemberId,
    transactions,
    setTransactions,
    setFixedExpenses,
    setPiggyBanks,
    setIsDemo,
  } = useAppStore();

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMember = useMemo(() => {
    return (
      group?.members.find((m) => m.id === currentMemberId) ||
      group?.members[0] ||
      DEFAULT_MEMBER
    );
  }, [group?.members, currentMemberId]);

  // Helpers to sync to Firestore
  const syncGroupToFirestore = async (updatedGroup: FamilyGroup) => {
    if (!updatedGroup.id) return;
    try {
      await setDoc(doc(db, 'groups', updatedGroup.id), sanitizeForFirestore(updatedGroup), { merge: true });
    } catch (e) {
      console.warn('Firestore group sync note:', e);
    }
  };

  const syncTransactionToFirestore = async (tx: Transaction) => {
    if (!group?.id) return;
    try {
      await setDoc(doc(db, 'transactions', tx.id), sanitizeForFirestore({
        ...tx,
        groupId: group.id,
      }));
    } catch (e) {
      console.warn('Firestore tx sync note:', e);
    }
  };

  const syncIncomesToFirestore = async (customMap?: Record<string, any>) => {
    if (!group?.id) return;
    await syncIncomesMapToFirestore(group.id, customMap);
  };

  const syncFixedExpensesToFirestore = async (items: FixedExpenseItem[]) => {
    if (!group?.id) return;
    try {
      let remoteItems: FixedExpenseItem[] = [];
      try {
        const snap = await getDoc(doc(db, 'fixedExpenses', group.id));
        if (snap.exists() && snap.data().items) {
          remoteItems = snap.data().items;
        }
      } catch (e) {}

      const merged = deepMergeFixedExpenses(remoteItems, items, transactions, group.members);
      await setDoc(doc(db, 'fixedExpenses', group.id), sanitizeForFirestore({ items: merged, groupId: group.id }), { merge: true });
    } catch (e) {
      console.warn('Firestore fixed expenses sync note:', e);
    }
  };

  const syncPiggyBanksToFirestore = async (items: PiggyBankItem[]) => {
    if (!group?.id) return;
    try {
      await setDoc(doc(db, 'piggyBanks', group.id), sanitizeForFirestore({ items, groupId: group.id }));
    } catch (e) {
      console.warn('Firestore piggy banks sync note:', e);
    }
  };

  // Login handler from AuthScreen
  const handleLogin = (newGroup: FamilyGroup, memberId: string, isDemoMode = false) => {
    setIsDemo(isDemoMode);
    localStorage.setItem('wepay_is_demo', isDemoMode ? 'true' : 'false');
    
    // Reset store data before setting new group to prevent data leak from previous sessions
    setTransactions([]);
    setFixedExpenses([]);
    setPiggyBanks([]);
    
    setGroup(newGroup);
    setCurrentMemberId(memberId);

    if (isDemoMode) {
      setTransactions(INITIAL_TRANSACTIONS);
      setFixedExpenses(INITIAL_FIXED_EXPENSES);
      setPiggyBanks(INITIAL_PIGGY_BANKS);
    } else {
      syncGroupToFirestore(newGroup);
    }
  };

  const handleLogout = () => {
    // Reset Store State
    setGroup(null);
    setCurrentMemberId('');
    setIsDemo(false);
    setTransactions([]);
    setFixedExpenses([]);
    setPiggyBanks([]);

    // Clear Local Storage
    localStorage.removeItem('wepay_group');
    localStorage.removeItem('wepay_current_member');
    localStorage.removeItem('wepay_transactions');
    localStorage.removeItem('wepay_fixed_expenses');
    localStorage.removeItem('wepay_cofrinhos');
    localStorage.removeItem('wepay_couple_incomes_v3');
    localStorage.removeItem('wepay_monthly_incomes');
    localStorage.removeItem('wepay_is_demo');
    
    try {
      auth.signOut();
    } catch (e) {}
  };

  // Add Transaction
  const handleAddTransaction = (newTxData: Omit<Transaction, 'id' | 'date'> & { date?: string }) => {
    let validDate = new Date().toISOString();
    if (newTxData.date) {
      const parsed = new Date(newTxData.date);
      if (!isNaN(parsed.getTime())) {
        validDate = parsed.toISOString();
      }
    }
    const newTx: Transaction = {
      ...newTxData,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      date: validDate,
      status: 'active',
    };
    setTransactions((prev) => [newTx, ...prev]);
    syncTransactionToFirestore(newTx);
  };

  // Revert or cancel fixed expense transaction when toggled to unpaid
  const handleRevertFixedExpenseTransaction = (fixedExpenseId: string, monthKey?: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        const txMonth = t.date ? t.date.substring(0, 7) : '';
        const isMatch = t.fixedExpenseId === fixedExpenseId && (!monthKey || txMonth === monthKey);
        
        if (isMatch && t.status !== 'reverted') {
          const revertedTx = {
            ...t,
            status: 'reverted' as const,
            revertedAt: new Date().toISOString(),
          };
          syncTransactionToFirestore(revertedTx);
          return revertedTx;
        }
        return t;
      })
    );
  };

  // Toggle income received status and sync to Transaction History
  const handleToggleIncomeReceived = (
    memberId: string,
    streamId: string,
    nextReceived: boolean,
    targetMonthKey: string = currentMonthKey,
    customDate?: string
  ) => {
    let currentMap: Record<string, any> = {};
    try {
      const saved = localStorage.getItem('wepay_couple_incomes_v3') || localStorage.getItem('wepay_monthly_incomes');
      if (saved) currentMap = JSON.parse(saved);
    } catch (e) {}

    const monthData = currentMap[targetMonthKey] || {};
    const flatStreams: IncomeStream[] = Array.isArray(currentMap[memberId]) ? currentMap[memberId] : [];
    const monthStreams: IncomeStream[] = Array.isArray(monthData[memberId]) ? monthData[memberId] : [];
    const baseList = monthStreams.length > 0 ? monthStreams : flatStreams;

    let targetStream: IncomeStream | undefined;
    const updatedStreams = baseList.map((s: IncomeStream) => {
      if (s.id === streamId) {
        targetStream = {
          ...s,
          received: nextReceived,
          receivedDate: customDate || (nextReceived ? new Date().toISOString().split('T')[0] : s.receivedDate),
        };
        return targetStream;
      }
      return s;
    });

    const updatedMap = {
      ...currentMap,
      [targetMonthKey]: {
        ...monthData,
        [memberId]: updatedStreams,
      },
    };

    try {
      localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(updatedMap));
      localStorage.setItem('wepay_monthly_incomes', JSON.stringify(updatedMap));
      window.dispatchEvent(new Event('wepay_incomes_updated'));
      syncIncomesToFirestore(updatedMap);
    } catch (e) {
      console.error('Error saving toggled income:', e);
    }

    if (targetStream) {
      const streamAmt = getStreamAmount(targetStream, targetMonthKey);
      const memberObj = group?.members.find((m) => m.id === memberId);

      if (nextReceived && streamAmt > 0) {
        let txDate = new Date().toISOString();
        if (customDate) {
          if (customDate.includes('/')) {
            const [d, m] = customDate.split('/');
            const [y] = targetMonthKey.split('-');
            const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 12, 0, 0);
            if (!isNaN(dateObj.getTime())) txDate = dateObj.toISOString();
          } else if (customDate.includes('-')) {
            const parsed = new Date(customDate);
            if (!isNaN(parsed.getTime())) txDate = parsed.toISOString();
          }
        } else {
          const [y, m] = targetMonthKey.split('-');
          const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, Math.min(28, new Date().getDate()), 12, 0, 0);
          if (!isNaN(dateObj.getTime())) txDate = dateObj.toISOString();
        }

        const incomeTx: Transaction = {
          id: `tx-income-${targetStream.id}-${targetMonthKey}`,
          incomeStreamId: targetStream.id,
          incomeMonthKey: targetMonthKey,
          description: `Renda (${targetStream.name}): ${memberObj?.name || 'Membro'}`,
          amount: streamAmt,
          category: 'Serviços',
          categoryIcon: targetStream.icon || 'TrendingUp',
          type: 'income',
          paidByMemberId: memberId,
          splitType: 'individual',
          date: txDate,
          notes: targetStream.notes || 'Renda recebida',
          status: 'active',
          aiCategorized: false,
        };

        setTransactions((prev) => {
          const filtered = prev.filter((t) => !(t.incomeStreamId === streamId && t.incomeMonthKey === targetMonthKey));
          return [incomeTx, ...filtered];
        });
        syncTransactionToFirestore(incomeTx);
      } else {
        setTransactions((prev) =>
          prev.map((t) => {
            if (t.incomeStreamId === streamId && (!t.incomeMonthKey || t.incomeMonthKey === targetMonthKey)) {
              const reverted = { ...t, status: 'deleted' as const, revertedAt: new Date().toISOString() };
              syncTransactionToFirestore(reverted);
              return reverted;
            }
            return t;
          })
        );
      }
    }
  };

  // Delete an income history entry transaction
  const handleDeleteIncomeEntryTransaction = (streamId: string, monthKey: string, amount: number) => {
    setTransactions((prev) => {
      const txToDelete = prev.find(
        (t) => t.type === 'income' && t.incomeStreamId === streamId && t.incomeMonthKey === monthKey && t.amount === amount && t.status !== 'deleted'
      );
      if (txToDelete) {
        const deletedTx = { ...txToDelete, status: 'deleted' as const, revertedAt: new Date().toISOString() };
        syncTransactionToFirestore(deletedTx);
        return prev.map((t) => (t.id === txToDelete.id ? deletedTx : t));
      }
      return prev;
    });
  };

  // Delete Income Stream & Clean up history
  const handleDeleteIncomeStream = (
    memberId: string,
    streamId: string,
    monthKey: string = currentMonthKey,
    deleteMode: 'thisMonth' | 'future' | 'all' = 'thisMonth'
  ) => {
    deleteIncomeStreamFromStorage(memberId, streamId, monthKey, deleteMode, group?.id);

    setTransactions((prev) =>
      prev.map((t) => {
        if (t.incomeStreamId === streamId) {
          const txMonth = t.incomeMonthKey || (t.date ? t.date.substring(0, 7) : '');
          const shouldDelete = 
            deleteMode === 'all' || 
            (deleteMode === 'future' && txMonth >= monthKey) ||
            (deleteMode === 'thisMonth' && txMonth === monthKey);

          if (shouldDelete && t.status !== 'deleted') {
            const deletedTx = { ...t, status: 'deleted' as const, revertedAt: new Date().toISOString() };
            syncTransactionToFirestore(deletedTx);
            return deletedTx;
          }
        }
        return t;
      })
    );
  };

  // Add Income Stream
  const handleAddIncomeStream = (
    memberId: string,
    streamData: Omit<IncomeStream, 'id'> & { id?: string },
    monthKey: string = currentMonthKey,
    applyToAllMonths: boolean = true
  ) => {
    const { stream: savedStream } = saveIncomeStreamToStorage(memberId, streamData, monthKey, group?.id, applyToAllMonths);
    syncIncomesToFirestore();

    if (streamData.received && (streamData.amount || 0) > 0 && streamData.nature !== 'extra') {
      const memberObj = group?.members.find((m) => m.id === memberId);
      const incomeTx: Transaction = {
        id: `tx-income-${savedStream.id}-${monthKey}`,
        incomeStreamId: savedStream.id,
        incomeMonthKey: monthKey,
        description: `Renda (${streamData.name}): ${memberObj?.name || 'Membro'}`,
        amount: streamData.amount || 0,
        category: 'Serviços',
        categoryIcon: streamData.icon || 'TrendingUp',
        type: 'income',
        paidByMemberId: memberId,
        splitType: 'individual',
        date: new Date().toISOString(),
        notes: streamData.notes || 'Renda recebida',
        status: 'active',
        aiCategorized: false,
      };

      setTransactions((prev) => {
        const filtered = prev.filter((t) => !(t.incomeStreamId === savedStream.id && t.incomeMonthKey === monthKey));
        return [incomeTx, ...filtered];
      });
      syncTransactionToFirestore(incomeTx);
    }
  };

  // Delete Transaction & Sync with Fixed Expenses
  const handleDeleteTransaction = (id: string) => {
    const txToDelete = transactions.find((t) => t.id === id);

    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, status: 'deleted' as const, revertedAt: new Date().toISOString() };
          syncTransactionToFirestore(updated);
          return updated;
        }
        return t;
      })
    );

    if (txToDelete) {
      const fixedId = txToDelete.fixedExpenseId;
      setFixedExpenses((prev) => {
        let matched = false;
        const updated = prev.map((fe) => {
          if (
            (fixedId && fe.id === fixedId) ||
            (!fixedId && txToDelete.isRecurrent && txToDelete.description.toLowerCase().includes(fe.title.toLowerCase()))
          ) {
            matched = true;
            const txMonth = txToDelete.date ? txToDelete.date.substring(0, 7) : '';
            const currentPaidMonths = fe.paidMonths || [];
            return { 
              ...fe, 
              paidMonths: currentPaidMonths.filter(m => m !== txMonth)
            };
          }
          return fe;
        });

        if (matched) {
          syncFixedExpensesToFirestore(updated);
          localStorage.setItem('wepay_fixed_expenses', JSON.stringify(updated));
          window.dispatchEvent(new Event('wepay_fixed_expenses_updated'));
        }
        return updated;
      });
    }
  };

  // Update Transaction
  const handleUpdateTransaction = (updatedTx: Transaction) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.id === updatedTx.id) {
          syncTransactionToFirestore(updatedTx);
          return updatedTx;
        }
        return t;
      })
    );
  };

  // Settle Up Accounts
  const handleSettleUp = (amount: number, paidByMemberId: string, receivedByMemberId: string) => {
    const paidMember = group?.members.find((m) => m.id === paidByMemberId);
    const recMember = group?.members.find((m) => m.id === receivedByMemberId);

    const settlementTx: Transaction = {
      id: `tx-settle-${Date.now()}`,
      description: `Quitação de Contas: ${paidMember?.name || 'Membro'} ➔ ${recMember?.name || 'Parceiro'}`,
      amount,
      category: 'Serviços',
      categoryIcon: 'CheckCircle2',
      type: 'expense',
      paidByMemberId,
      splitType: 'equal',
      date: new Date().toISOString(),
      aiCategorized: false,
    };

    setTransactions((prev) => [settlementTx, ...prev]);
    syncTransactionToFirestore(settlementTx);
  };

  // Update Group Settings
  const handleUpdateGroup = (updatedGroup: FamilyGroup) => {
    setGroup(updatedGroup);
    syncGroupToFirestore(updatedGroup);
  };

  return {
    currentMember,
    syncIncomesToFirestore,
    syncFixedExpensesToFirestore,
    syncPiggyBanksToFirestore,
    handleLogin,
    handleLogout,
    handleAddTransaction,
    handleRevertFixedExpenseTransaction,
    handleToggleIncomeReceived,
    handleDeleteIncomeEntryTransaction,
    handleDeleteIncomeStream,
    handleAddIncomeStream,
    handleDeleteTransaction,
    handleUpdateTransaction,
    handleSettleUp,
    handleUpdateGroup,
  };
}
