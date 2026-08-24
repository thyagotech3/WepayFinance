/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FamilyGroup, FamilyMember, Transaction, IncomeStream, FixedExpenseItem, PiggyBankItem } from './types';

const DEFAULT_MEMBER: FamilyMember = {
  id: 'default',
  name: 'Membro',
  avatar: '',
  color: '#3b82f6',
  role: 'admin',
};
import { INITIAL_GROUP, INITIAL_TRANSACTIONS, INITIAL_FIXED_EXPENSES, INITIAL_PIGGY_BANKS } from './data/mockInitialData';
import { AuthScreen } from './components/AuthScreen';
import { Navbar } from './components/Navbar';
import { HomeDashboard } from './components/HomeDashboard';
import { CoupleSplitView } from './components/CoupleSplitView';
import { AnalyticsView } from './components/AnalyticsView';
import { AIAdvisorView } from './components/AIAdvisorView';
import { TransactionsView } from './components/TransactionsView';
import { FullBalanceView } from './components/FullBalanceView';
import { AddExpenseModal } from './components/AddExpenseModal';
import { AddIncomeModal } from './components/AddIncomeModal';
import { FixedExpensesView } from './components/FixedExpensesView';
import { NewTransactionView } from './components/NewTransactionView';
import { PiggyBanksView } from './components/PiggyBanksView';
import { SettingsModal } from './components/SettingsModal';
import { SettingsView } from './components/SettingsView';
import { BottomDock } from './components/BottomDock';
import { db, doc, setDoc, collection, onSnapshot, query, where, auth, sanitizeForFirestore } from './lib/firebase';
import { saveIncomeStreamToStorage } from './utils/incomeUtils';

export default function App() {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [isDemo, setIsDemo] = useState<boolean>(() => {
    return localStorage.getItem('wepay_is_demo') === 'true';
  });

  const [group, setGroup] = useState<FamilyGroup | null>(() => {
    const saved = localStorage.getItem('wepay_group');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  });

  const [currentMemberId, setCurrentMemberId] = useState<string>(() => {
    const savedMember = localStorage.getItem('wepay_current_member');
    if (savedMember) return savedMember;
    return group?.members[0]?.id || '';
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const savedTx = localStorage.getItem('wepay_transactions');
    if (savedTx) {
      try { return JSON.parse(savedTx); } catch (e) {}
    }
    return isDemo ? INITIAL_TRANSACTIONS : [];
  });

  const [fixedExpenses, setFixedExpenses] = useState<FixedExpenseItem[]>(() => {
    const saved = localStorage.getItem('wepay_fixed_expenses');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return isDemo ? INITIAL_FIXED_EXPENSES : [];
  });

  const [piggyBanks, setPiggyBanks] = useState<PiggyBankItem[]>(() => {
    const saved = localStorage.getItem('wepay_cofrinhos');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return isDemo ? INITIAL_PIGGY_BANKS : [];
  });

  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'split' | 'analytics' | 'advisor'>('home');
  const [subView, setSubView] = useState<'none' | 'fixedExpenses' | 'fullBalance' | 'newTransaction' | 'cofrinhos' | 'settings'>('none');
  const [previousSubView, setPreviousSubView] = useState<'none' | 'fullBalance' | 'newTransaction' | 'cofrinhos' | 'settings'>('none');
  const [newTransactionType, setNewTransactionType] = useState<'expense' | 'income' | 'fixed'>('expense');

  const handleOpenExpense = () => {
    setNewTransactionType('expense');
    setSubView('newTransaction');
  };

  const handleOpenIncome = () => {
    setNewTransactionType('income');
    setSubView('newTransaction');
  };

  const handleOpenFixedExpenses = () => {
    setPreviousSubView(subView === 'fixedExpenses' ? 'none' : subView);
    setSubView('fixedExpenses');
  };

  const handleOpenCofrinhos = () => {
    setPreviousSubView(subView === 'cofrinhos' ? 'none' : subView);
    setSubView('cofrinhos');
  };

  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showIncomeModal, setShowIncomeModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Persist state updates to localStorage
  useEffect(() => {
    if (group) {
      localStorage.setItem('wepay_group', JSON.stringify(group));
    } else {
      localStorage.removeItem('wepay_group');
    }
  }, [group]);

  useEffect(() => {
    if (currentMemberId) {
      localStorage.setItem('wepay_current_member', currentMemberId);
    }
  }, [currentMemberId]);

  useEffect(() => {
    localStorage.setItem('wepay_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('wepay_fixed_expenses', JSON.stringify(fixedExpenses));
  }, [fixedExpenses]);

  useEffect(() => {
    localStorage.setItem('wepay_cofrinhos', JSON.stringify(piggyBanks));
  }, [piggyBanks]);

  // Firestore Real-Time Synchronization Listeners
  useEffect(() => {
    if (!group?.id) return;

    // 1. Group listener
    const groupUnsub = onSnapshot(
      doc(db, 'groups', group.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteGroup = docSnap.data() as FamilyGroup;
          setGroup((prev) => (prev ? { ...prev, ...remoteGroup } : remoteGroup));
        }
      },
      (err) => {
        console.warn('Firestore live group listener info:', err);
      }
    );

    // 2. Transactions listener
    const txQuery = query(collection(db, 'transactions'), where('groupId', '==', group.id));
    const txUnsub = onSnapshot(
      txQuery,
      (querySnap) => {
        const remoteTxs: Transaction[] = [];
        querySnap.forEach((d) => {
          remoteTxs.push({ id: d.id, ...d.data() } as Transaction);
        });
        remoteTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setTransactions(remoteTxs);
      },
      (err) => {
        console.warn('Firestore live transaction listener info:', err);
      }
    );

    // 3. Fixed expenses listener
    const fixedUnsub = onSnapshot(
      doc(db, 'fixedExpenses', group.id),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().items) {
          setFixedExpenses(docSnap.data().items as FixedExpenseItem[]);
        }
      },
      (err) => {
        console.warn('Firestore fixed expenses listener info:', err);
      }
    );

    // 4. Piggy banks listener
    const piggyUnsub = onSnapshot(
      doc(db, 'piggyBanks', group.id),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().items) {
          setPiggyBanks(docSnap.data().items as PiggyBankItem[]);
        }
      },
      (err) => {
        console.warn('Firestore piggy banks listener info:', err);
      }
    );

    // 5. Incomes listener
    const incomesUnsub = onSnapshot(
      doc(db, 'incomes', group.id),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().incomesMap) {
          const map = docSnap.data().incomesMap;
          localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(map));
          localStorage.setItem('wepay_monthly_incomes', JSON.stringify(map));
          window.dispatchEvent(new Event('wepay_incomes_updated'));
        }
      },
      (err) => {
        console.warn('Firestore incomes listener info:', err);
      }
    );

    return () => {
      groupUnsub();
      txUnsub();
      fixedUnsub();
      piggyUnsub();
      incomesUnsub();
    };
  }, [group?.id]);

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

  const syncFixedExpensesToFirestore = async (items: FixedExpenseItem[]) => {
    if (!group?.id) return;
    try {
      await setDoc(doc(db, 'fixedExpenses', group.id), sanitizeForFirestore({ items, groupId: group.id }));
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
    setGroup(newGroup);
    setCurrentMemberId(memberId);

    if (isDemoMode) {
      setTransactions(INITIAL_TRANSACTIONS);
      setFixedExpenses(INITIAL_FIXED_EXPENSES);
      setPiggyBanks(INITIAL_PIGGY_BANKS);
    } else {
      setTransactions([]);
      setFixedExpenses([]);
      setPiggyBanks([]);
      localStorage.removeItem('wepay_transactions');
      localStorage.removeItem('wepay_fixed_expenses');
      localStorage.removeItem('wepay_cofrinhos');
      localStorage.removeItem('wepay_couple_incomes_v3');
      localStorage.removeItem('wepay_monthly_incomes');
      syncGroupToFirestore(newGroup);
    }
  };

  const handleLogout = () => {
    setGroup(null);
    setCurrentMemberId('');
    setIsDemo(false);
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

  const currentMember = useMemo(() => {
    return (
      group?.members.find((m) => m.id === currentMemberId) ||
      group?.members[0] ||
      DEFAULT_MEMBER
    );
  }, [group?.members, currentMemberId]);

  // Add Transaction
  const handleAddTransaction = (newTxData: Omit<Transaction, 'id' | 'date'> & { date?: string }) => {
    const newTx: Transaction = {
      ...newTxData,
      id: `tx-${Date.now()}`,
      date: newTxData.date || new Date().toISOString(),
      status: 'active',
    };
    setTransactions((prev) => [newTx, ...prev]);
    syncTransactionToFirestore(newTx);
  };

  // Revert or cancel fixed expense transaction when toggled to unpaid
  const handleRevertFixedExpenseTransaction = (fixedExpenseId: string) => {
    setTransactions((prev) =>
      prev.map((t) => {
        if (t.fixedExpenseId === fixedExpenseId && t.status !== 'reverted') {
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

  // Add Income Stream
  const handleAddIncomeStream = (
    memberId: string,
    streamData: Omit<IncomeStream, 'id'> & { id?: string },
    monthKey: string = currentMonthKey,
    applyToAllMonths: boolean = true
  ) => {
    saveIncomeStreamToStorage(memberId, streamData, monthKey, group?.id, applyToAllMonths);

    // Sync full map to Firestore if group exists
    if (group?.id) {
      try {
        const saved = localStorage.getItem('wepay_couple_incomes_v3');
        if (saved) {
          const map = JSON.parse(saved);
          setDoc(doc(db, 'incomes', group.id), sanitizeForFirestore({ incomesMap: map, groupId: group.id }), { merge: true }).catch((err) => {
            console.warn('Firestore incomes setDoc notice:', err);
          });
        }
      } catch (e) {
        console.error(e);
      }
    }

    // Only create an income transaction if received is true, amount > 0, and not an extra income stream (extras are recorded via separate entry transactions)
    if (streamData.received && (streamData.amount || 0) > 0 && streamData.nature !== 'extra') {
      const memberObj = group?.members.find((m) => m.id === memberId);
      const incomeTx: Transaction = {
        id: `tx-income-${Date.now()}`,
        description: `Arrecadação (${streamData.name}): ${memberObj?.name || 'Membro'}`,
        amount: streamData.amount,
        category: 'Serviços',
        categoryIcon: 'TrendingUp',
        type: 'income',
        paidByMemberId: memberId,
        splitType: 'individual',
        date: new Date().toISOString(),
        notes: streamData.notes,
        aiCategorized: false,
      };

      setTransactions((prev) => [incomeTx, ...prev]);
      syncTransactionToFirestore(incomeTx);
    }
  };

  // Delete Transaction & Sync with Fixed Expenses
  const handleDeleteTransaction = (id: string) => {
    const txToDelete = transactions.find((t) => t.id === id);

    // 1. Mark transaction as deleted in state & sync to Firestore
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

    // 2. If it is linked to a fixed expense, revert the fixed expense to unpaid (isPaid: false)
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
            return { ...fe, isPaid: false };
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

  if (!group) {
    return <AuthScreen onLogin={handleLogin} demoGroup={INITIAL_GROUP} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-pink-500 selection:text-white">
      {/* Top Floating Minimalist Bar */}
      <Navbar
        group={group}
        currentMember={currentMember}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setSubView('none');
          setActiveTab(tab);
        }}
        subView={subView}
        setSubView={(view) => {
          if (view === 'fixedExpenses') handleOpenFixedExpenses();
          else if (view === 'cofrinhos') handleOpenCofrinhos();
          else setSubView(view);
        }}
        onOpenExpense={handleOpenExpense}
        onOpenIncome={handleOpenIncome}
        onOpenFixedExpenses={handleOpenFixedExpenses}
        onOpenCofrinhos={handleOpenCofrinhos}
        onSwitchMember={(id) => setCurrentMemberId(id)}
        onOpenSettings={() => setSubView('settings')}
        onLogout={handleLogout}
      />

      {/* Main View Container */}
      <main className={`max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 ${
        subView === 'newTransaction'
          ? 'py-1 sm:py-3 md:py-6 pb-16 md:pb-12'
          : activeTab === 'home' && subView === 'none'
            ? 'py-3 sm:py-4 md:py-6 pb-24 md:pb-8'
            : 'py-3 sm:py-6 pb-28 md:pb-12'
      }`}>
        {subView === 'fixedExpenses' ? (
          <FixedExpensesView
            members={group.members}
            currentMember={currentMember}
            expenses={fixedExpenses}
            onUpdateExpenses={(updatedExpenses) => {
              setFixedExpenses(updatedExpenses);
              syncFixedExpensesToFirestore(updatedExpenses);
            }}
            onBack={() => setSubView(previousSubView)}
            onClose={() => setSubView('none')}
            onAddTransaction={handleAddTransaction}
            onRevertFixedExpenseTransaction={handleRevertFixedExpenseTransaction}
          />
        ) : subView === 'fullBalance' ? (
          <FullBalanceView
            group={group}
            currentMember={currentMember}
            members={group.members}
            transactions={transactions}
            fixedExpenses={fixedExpenses}
            cofrinhos={piggyBanks}
            onBack={() => setSubView('none')}
            onOpenExpenseModal={handleOpenExpense}
            onOpenIncomeModal={handleOpenIncome}
            onOpenFixedExpenses={handleOpenFixedExpenses}
            onOpenCofrinhos={handleOpenCofrinhos}
          />
        ) : subView === 'cofrinhos' ? (
          <PiggyBanksView
            members={group.members}
            currentMember={currentMember}
            cofrinhos={piggyBanks}
            onUpdateCofrinhos={(updatedCofrinhos) => {
              setPiggyBanks(updatedCofrinhos);
              syncPiggyBanksToFirestore(updatedCofrinhos);
            }}
            onBack={() => setSubView(previousSubView)}
            onClose={() => setSubView('none')}
            onAddTransaction={handleAddTransaction}
          />
        ) : subView === 'newTransaction' ? (
          <NewTransactionView
            members={group.members}
            currentMember={currentMember}
            initialType={newTransactionType}
            onBack={() => setSubView('none')}
            onAddTransaction={handleAddTransaction}
            onAddIncomeStream={handleAddIncomeStream}
            onOpenFixedExpenses={handleOpenFixedExpenses}
          />
        ) : subView === 'settings' ? (
          <SettingsView
            group={group}
            members={group.members}
            onBack={() => setSubView('none')}
            onUpdateGroup={handleUpdateGroup}
            onLogout={handleLogout}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeDashboard
                group={group}
                currentMember={currentMember}
                members={group.members}
                transactions={transactions}
                fixedExpenses={fixedExpenses}
                cofrinhos={piggyBanks}
                onAddTransaction={handleAddTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onOpenExpenseModal={handleOpenExpense}
                onOpenIncomeModal={handleOpenIncome}
                onOpenFixedExpenses={handleOpenFixedExpenses}
                onOpenFullBalance={() => setSubView('fullBalance')}
                onOpenCofrinhos={handleOpenCofrinhos}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsView
                members={group.members}
                currentMember={currentMember}
                transactions={transactions}
                onDeleteTransaction={handleDeleteTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onOpenExpenseModal={handleOpenExpense}
              />
            )}

            {activeTab === 'split' && (
              <CoupleSplitView
                group={group}
                members={group.members}
                transactions={transactions}
                onSettleUp={handleSettleUp}
                onAddTransaction={handleAddTransaction}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsView
                group={group}
                members={group.members}
                transactions={transactions}
              />
            )}

            {activeTab === 'advisor' && (
              <AIAdvisorView
                group={group}
                members={group.members}
                currentMember={currentMember}
                transactions={transactions}
                fixedExpenses={fixedExpenses}
                onDeleteTransaction={handleDeleteTransaction}
                onAddTransaction={handleAddTransaction}
                onAddIncomeStream={handleAddIncomeStream}
                onOpenFullBalance={() => setSubView('fullBalance')}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {showExpenseModal && (
        <AddExpenseModal
          members={group.members}
          currentMember={currentMember}
          onClose={() => setShowExpenseModal(false)}
          onAddTransaction={handleAddTransaction}
          onAddIncomeStream={handleAddIncomeStream}
        />
      )}

      {showIncomeModal && (
        <AddIncomeModal
          members={group.members}
          currentMember={currentMember}
          onClose={() => setShowIncomeModal(false)}
          onAddIncomeStream={handleAddIncomeStream}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          group={group}
          members={group.members}
          onClose={() => setShowSettingsModal(false)}
          onUpdateGroup={handleUpdateGroup}
        />
      )}

      {/* Floating Bottom Navigation Dock */}
      <BottomDock
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setSubView('none');
          setActiveTab(tab);
        }}
        onOpenExpenseModal={handleOpenExpense}
        onOpenSettings={() => setShowSettingsModal(true)}
      />
    </div>
  );
}
