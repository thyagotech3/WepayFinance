/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { FamilyMember, Transaction, FixedExpenseItem, PiggyBankItem } from './types';
import { INITIAL_GROUP } from './data/mockInitialData';
import { useAppStore } from './store/useAppStore';
import { useFamilyActions } from './hooks/useFamilyActions';
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
import { db, collection, onSnapshot, query, where, getDoc, doc, auth, onAuthStateChanged, getDocs, FirebaseUser } from './lib/firebase';
import {
  cleanGhostIncomeStreams,
  deepMergeFixedExpenses,
  recoverIncomesFromTransactions,
} from './utils/incomeUtils';

export function App() {
  const {
    group,
    setGroup,
    setAuthUser,
    isDemo,
    setIsDemo,
    transactions,
    setTransactions,
    setFixedExpenses,
    setPiggyBanks,
    setCurrentMemberId,
  } = useAppStore();

  const {
    currentMember,
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
  } = useFamilyActions();

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  // Safeguard: Reset store state if group changes to prevent data leakage
  const lastGroupIdRef = useRef<string | null>(group?.id || null);
  useEffect(() => {
    if (group?.id && lastGroupIdRef.current && group.id !== lastGroupIdRef.current) {
      console.log('Group changed, resetting local state to prevent data leakage');
      setTransactions([]);
      setFixedExpenses([]);
      setPiggyBanks([]);
    }
    lastGroupIdRef.current = group?.id || null;
  }, [group?.id, setTransactions, setFixedExpenses, setPiggyBanks]);

  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<'home' | 'transactions' | 'split' | 'analytics' | 'advisor'>('home');
  const [subView, setSubView] = useState<'none' | 'fixedExpenses' | 'fullBalance' | 'cofrinhos' | 'newTransaction' | 'settings'>('none');
  const [previousSubView, setPreviousSubView] = useState<'none' | 'fixedExpenses' | 'fullBalance' | 'cofrinhos' | 'newTransaction' | 'settings'>('none');
  const [newTransactionType, setNewTransactionType] = useState<'expense' | 'income' | 'fixed'>('expense');
  const [initialIncomeStreamForSplit, setInitialIncomeStreamForSplit] = useState<{ memberId: string; streamId: string; monthKey: string; timestamp?: number } | null>(null);

  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showIncomeModal, setShowIncomeModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  // Auth State Listener to ensure seamless sync with Firebase Auth
  useEffect(() => {
    const authUnsub = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setAuthUser(firebaseUser);
      if (firebaseUser && !group) {
        try {
          const userUid = firebaseUser.uid;
          const userEmail = (firebaseUser.email || '').toLowerCase();
          const qMembers = query(collection(db, 'groups'), where('memberUids', 'array-contains', userUid));
          let snap = await getDocs(qMembers);

          if (snap.empty) {
            const qOwner = query(collection(db, 'groups'), where('ownerUid', '==', userUid));
            snap = await getDocs(qOwner);
          }

          if (!snap.empty) {
            const foundGroup = snap.docs[0].data() as any;
            const targetMemId =
              foundGroup.members.find((m: any) => m.email?.toLowerCase() === userEmail)?.id ||
              foundGroup.members[0]?.id ||
              `member-${userUid}`;
            setTransactions([]);
            setFixedExpenses([]);
            setPiggyBanks([]);
            setGroup(foundGroup);
            setCurrentMemberId(targetMemId);
            setIsDemo(false);
          }
        } catch (authSyncErr) {
          console.warn('Auth auto-sync group lookup notice:', authSyncErr);
        }
      }
    });

    return () => authUnsub();
  }, [group]);

  // Firestore Real-Time Synchronization Listeners (only for non-demo sessions)
  useEffect(() => {
    if (isDemo || !group?.id) return;

    getDoc(doc(db, 'incomes', group.id)).then((docSnap) => {
      if (docSnap.exists() && docSnap.data().incomesMap) {
        let cleanRemote = cleanGhostIncomeStreams(docSnap.data().incomesMap);
        try {
          const savedTxs = localStorage.getItem('wepay_transactions');
          if (savedTxs) {
            const parsedTxs = JSON.parse(savedTxs);
            if (Array.isArray(parsedTxs) && parsedTxs.length > 0) {
              cleanRemote = recoverIncomesFromTransactions(cleanRemote, parsedTxs, group.members);
            }
          }
        } catch (e) {}
        localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(cleanRemote));
        localStorage.setItem('wepay_monthly_incomes', JSON.stringify(cleanRemote));
        setTimeout(() => window.dispatchEvent(new Event('wepay_incomes_updated')), 0);
      }
    }).catch((e) => console.warn('Initial income fetch note:', e));

    getDoc(doc(db, 'groups', group.id)).then((docSnap) => {
      if (docSnap.exists()) {
        const remoteGroup = docSnap.data() as any;
        setGroup((prev: any) => (prev ? { ...prev, ...remoteGroup } : remoteGroup));
      }
    }).catch((e) => console.warn('Initial group fetch note:', e));

    getDoc(doc(db, 'fixedExpenses', group.id)).then((docSnap) => {
      if (docSnap.exists() && docSnap.data().items) {
        const remoteItems = docSnap.data().items as FixedExpenseItem[];
        setFixedExpenses((prev: FixedExpenseItem[]) => {
          const merged = deepMergeFixedExpenses(prev, remoteItems, transactionsRef.current, group.members);
          localStorage.setItem('wepay_fixed_expenses', JSON.stringify(merged));
          return merged;
        });
        setTimeout(() => window.dispatchEvent(new Event('wepay_fixed_expenses_updated')), 0);
      }
    }).catch((e) => console.warn('Initial fixed expenses fetch note:', e));

    const groupUnsub = onSnapshot(
      doc(db, 'groups', group.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const remoteGroup = docSnap.data() as any;
          setGroup((prev: any) => (prev ? { ...prev, ...remoteGroup } : remoteGroup));
        }
      },
      (err) => {
        console.warn('Firestore live group listener info:', err);
      }
    );

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

        setFixedExpenses((prev: FixedExpenseItem[]) => {
          let mutated = false;
          const updated = prev.map((fe) => {
            const txDates = remoteTxs
              .filter(
                (t) =>
                  t.status === 'active' &&
                  ((t.fixedExpenseId && t.fixedExpenseId === fe.id) ||
                    (!t.fixedExpenseId && t.isRecurrent && t.description.toLowerCase().includes(fe.title.toLowerCase())))
              )
              .map((t) => (t.date ? t.date.substring(0, 7) : ''))
              .filter(Boolean);

            if (txDates.length > 0) {
              const currentPaidMonths = fe.paidMonths || [];
              const combinedMonths = Array.from(new Set([...currentPaidMonths, ...txDates]));
              if (combinedMonths.length !== currentPaidMonths.length) {
                mutated = true;
                return { ...fe, paidMonths: combinedMonths };
              }
            }
            return fe;
          });
          if (mutated) {
            localStorage.setItem('wepay_fixed_expenses', JSON.stringify(updated));
            window.dispatchEvent(new Event('wepay_fixed_expenses_updated'));
          }
          return updated;
        });
      },
      (err) => {
        console.warn('Firestore live tx listener info:', err);
      }
    );

    const fixedUnsub = onSnapshot(
      doc(db, 'fixedExpenses', group.id),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().items) {
          const remoteItems = docSnap.data().items as FixedExpenseItem[];
          setFixedExpenses((prev: FixedExpenseItem[]) => {
            const merged = deepMergeFixedExpenses(prev, remoteItems, transactionsRef.current, group.members);
            localStorage.setItem('wepay_fixed_expenses', JSON.stringify(merged));
            return merged;
          });
          setTimeout(() => window.dispatchEvent(new Event('wepay_fixed_expenses_updated')), 0);
        }
      },
      (err) => {
        console.warn('Firestore fixed expenses listener info:', err);
      }
    );

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

    const incomesUnsub = onSnapshot(
      doc(db, 'incomes', group.id),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().incomesMap) {
          let cleanRemote = cleanGhostIncomeStreams(docSnap.data().incomesMap);
          try {
            const savedTxs = localStorage.getItem('wepay_transactions');
            if (savedTxs) {
              const parsedTxs = JSON.parse(savedTxs);
              if (Array.isArray(parsedTxs) && parsedTxs.length > 0) {
                cleanRemote = recoverIncomesFromTransactions(cleanRemote, parsedTxs, group.members);
              }
            }
          } catch (e) {}
          localStorage.setItem('wepay_couple_incomes_v3', JSON.stringify(cleanRemote));
          localStorage.setItem('wepay_monthly_incomes', JSON.stringify(cleanRemote));
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
  }, [group?.id, isDemo]);

  if (!group) {
    return <AuthScreen onLogin={handleLogin} demoGroup={INITIAL_GROUP} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-pink-500 selection:text-white">
      <Navbar
        group={group}
        currentMember={currentMember}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        subView={subView}
        setSubView={setSubView}
        onSwitchMember={setCurrentMemberId}
        onLogout={handleLogout}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenFullBalance={() => setSubView('fullBalance')}
        onOpenExpense={() => {
          setNewTransactionType('expense');
          setSubView('newTransaction');
        }}
        onOpenIncome={() => {
          setNewTransactionType('income');
          setSubView('newTransaction');
        }}
        onOpenFixedExpenses={() => {
          setPreviousSubView(subView);
          setSubView('fixedExpenses');
        }}
        onOpenCofrinhos={() => {
          setPreviousSubView(subView);
          setSubView('cofrinhos');
        }}
      />

      <main className={`max-w-7xl mx-auto px-3 sm:px-6 transition-all duration-300 ${
        subView !== 'none'
          ? 'py-3 sm:py-4 md:py-6 pb-24 md:pb-8'
          : 'py-3 sm:py-6 pb-28 md:pb-12'
      }`}>
        {subView === 'fixedExpenses' ? (
          <FixedExpensesView
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
            onBack={() => setSubView('none')}
            onOpenExpenseModal={() => setShowExpenseModal(true)}
            onOpenIncomeModal={() => setShowIncomeModal(true)}
            onOpenFixedExpenses={() => {
              setPreviousSubView('fullBalance');
              setSubView('fixedExpenses');
            }}
            onOpenCofrinhos={() => {
              setPreviousSubView('fullBalance');
              setSubView('cofrinhos');
            }}
          />
        ) : subView === 'cofrinhos' ? (
          <PiggyBanksView
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
            initialType={newTransactionType}
            onBack={() => setSubView('none')}
            onAddTransaction={handleAddTransaction}
            onAddIncomeStream={handleAddIncomeStream}
            onOpenFixedExpenses={() => {
              setPreviousSubView('newTransaction');
              setSubView('fixedExpenses');
            }}
          />
        ) : subView === 'settings' ? (
          <SettingsView
            onBack={() => setSubView('none')}
            onUpdateGroup={handleUpdateGroup}
            onLogout={handleLogout}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeDashboard
                onAddTransaction={handleAddTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onOpenExpenseModal={() => setShowExpenseModal(true)}
                onOpenIncomeModal={() => setShowIncomeModal(true)}
                onOpenFixedExpenses={() => {
                  setPreviousSubView('none');
                  setSubView('fixedExpenses');
                }}
                onOpenFullBalance={() => setSubView('fullBalance')}
                onOpenCofrinhos={() => {
                  setPreviousSubView('none');
                  setSubView('cofrinhos');
                }}
                onOpenIncomeStream={(memberId, streamId, monthKey) => {
                  setInitialIncomeStreamForSplit({ memberId, streamId, monthKey, timestamp: Date.now() });
                  // We can stay on home or go to split, user specifically asked for history page stay
                  // but for consistency we'll use the same modal-only approach if possible.
                  // For now, let's keep home as navigating to split since it wasn't explicitly mentioned,
                  // but the user said "pagina do historico".
                  setActiveTab('split');
                }}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionsView
                onDeleteTransaction={handleDeleteTransaction}
                onUpdateTransaction={handleUpdateTransaction}
                onOpenExpenseModal={() => setShowExpenseModal(true)}
                onOpenIncomeStream={(memberId, streamId, monthKey) => {
                  setInitialIncomeStreamForSplit({ memberId, streamId, monthKey, timestamp: Date.now() });
                  // DO NOT call setActiveTab('split'); - Stay on history page
                }}
              />
            )}
            
            <div className={activeTab === 'split' ? 'block' : 'hidden'}>
              <CoupleSplitView
                onSettleUp={handleSettleUp}
                onAddTransaction={handleAddTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onToggleIncomeReceived={handleToggleIncomeReceived}
                onDeleteIncomeStream={handleDeleteIncomeStream}
                onAddIncomeStream={handleAddIncomeStream}
                onSelectMemberForDetail={() => {}}
                initialIncomeStreamForSplit={initialIncomeStreamForSplit}
                onClearInitialIncomeStream={() => setInitialIncomeStreamForSplit(null)}
                onDeleteIncomeEntryTransaction={handleDeleteIncomeEntryTransaction}
              />
            </div>

            {activeTab === 'analytics' && <AnalyticsView />}
            {activeTab === 'advisor' && (
              <AIAdvisorView
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
        onAddClick={() => {
          setNewTransactionType('expense');
          setSubView('newTransaction');
        }}
        onOpenSettings={() => {
          setPreviousSubView(subView);
          setSubView('settings');
        }}
      />
    </div>
  );
}

export default App;
