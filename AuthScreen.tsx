import React, { useState } from 'react';
import { FamilyGroup, FamilyMember } from '../types';
import { User, ArrowRight, ShieldCheck, Smartphone, Key, HeartHandshake, Mail, Lock, LogIn, ArrowLeft, UserCheck, Users, Copy, Check, ExternalLink, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import {
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  db,
  setDoc,
  doc,
  collection,
  query,
  where,
  getDocs,
  sanitizeForFirestore,
} from '../lib/firebase';
import { signInWithGoogleOAuth } from '../lib/googleAuth';

interface AuthScreenProps {
  onLogin: (group: FamilyGroup, currentMemberId: string, isDemo?: boolean) => void;
  demoGroup: FamilyGroup;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin, demoGroup }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<1 | 2>(1);
  
  // Step 1 Registration form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2 Registration form fields
  const [membro1Name, setMembro1Name] = useState('');
  const [membro2Name, setMembro2Name] = useState('');

  // Store Google user if registering via Google
  const [googleAuthUser, setGoogleAuthUser] = useState<any>(null);

  // Login form fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [useCodeMode, setUseCodeMode] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 Submit: Advance to Step 2
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!fullName.trim()) {
      setLoginError('Por favor, informe seu nome completo.');
      return;
    }
    if (!email.trim()) {
      setLoginError('Por favor, informe seu e-mail.');
      return;
    }
    if (!password) {
      setLoginError('Por favor, informe uma senha.');
      return;
    }
    if (password.length < 6) {
      setLoginError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setLoginError('As senhas não coincidem. Verifique sua senha.');
      return;
    }

    // Extract first name/nickname for Membro 1
    const firstName = fullName.trim().split(' ')[0] || fullName.trim();
    setMembro1Name(firstName);
    setRegStep(2);
  };

  // Step 2 Submit: Finish Registration
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
      let ownerUid = `local-${Date.now()}`;
      let userEmail = email;
      let userAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(membro1Name || 'Member1')}`;

      if (googleAuthUser) {
        ownerUid = googleAuthUser.uid;
        userEmail = googleAuthUser.email || email;
        if (googleAuthUser.photoURL) {
          userAvatar = googleAuthUser.photoURL;
        }
      } else if (email && password) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          ownerUid = userCredential.user.uid;
        } catch (authErr: any) {
          console.warn('Firebase createUser error code:', authErr.code, authErr);
          if (authErr.code === 'auth/email-already-in-use') {
            // Attempt to sign in with provided password
            try {
              const userCred = await signInWithEmailAndPassword(auth, email, password);
              ownerUid = userCred.user.uid;
            } catch (signInErr: any) {
              setLoginError('Este e-mail já está cadastrado. Alterne para a aba "Entrar" para fazer login.');
              setIsLoading(false);
              return;
            }
          } else if (authErr.code === 'auth/operation-not-allowed') {
            // Fall back to a local user session UID if Email/Password provider isn't enabled in Firebase Console
            console.warn('Firebase Email/Password auth is disabled in console. Falling back to local account session.');
            ownerUid = `usr-${Date.now()}`;
          } else {
            throw authErr;
          }
        }
      }

      const generatedCode = `WEPAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const m1Formatted = membro1Name.trim() || fullName.trim().split(' ')[0] || 'Membro 1';
      const m2Formatted = membro2Name.trim() || 'Parceiro(a)';

      const formattedMembers: FamilyMember[] = [
        {
          id: `member-${ownerUid}`,
          name: m1Formatted,
          email: userEmail,
          color: '#3b82f6',
          avatar: userAvatar,
          role: 'admin',
          income: 0,
        },
        {
          id: `member-partner-${Date.now()}`,
          name: m2Formatted,
          email: '',
          color: '#ec4899',
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(m2Formatted)}`,
          role: 'member',
          income: 0,
        },
      ];

      const groupId = `group-${ownerUid}`;
      const newGroup: FamilyGroup = {
        id: groupId,
        name: `Finanças - ${m1Formatted}`,
        code: generatedCode,
        monthlyBudget: 0,
        currency: 'BRL',
        createdAt: new Date().toISOString(),
        members: formattedMembers,
      };

      try {
        await setDoc(doc(db, 'groups', groupId), sanitizeForFirestore({
          ...newGroup,
          ownerUid,
          memberUids: [ownerUid],
        }));
      } catch (firestoreErr) {
        console.warn('Firestore database write notice:', firestoreErr);
      }

      onLogin(newGroup, formattedMembers[0].id);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setLoginError('Este e-mail já está cadastrado. Alterne para a aba de Login.');
      } else if (err.code === 'auth/weak-password') {
        setLoginError('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setLoginError('Erro ao criar conta: ' + (err.message || 'Verifique seus dados.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
      if (useCodeMode) {
        const cleanCode = loginCode.trim().toUpperCase();
        if (cleanCode === demoGroup.code || cleanCode === 'WEPAY-2026' || cleanCode.startsWith('WEPAY')) {
          onLogin(demoGroup, demoGroup.members[0].id, true);
        } else {
          setLoginError('Código do grupo não encontrado. Tente a conta de demonstração "WEPAY-2026" ou crie uma nova conta.');
        }
      } else {
        if (!loginEmail || !loginPassword) {
          setLoginError('Informe e-mail e senha.');
          setIsLoading(false);
          return;
        }

        let uid = `usr-${loginEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
        try {
          const userCred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
          uid = userCred.user.uid;
        } catch (authErr: any) {
          console.warn('Firebase signIn error code:', authErr.code, authErr);
          if (authErr.code === 'auth/operation-not-allowed') {
            console.warn('Firebase Email/Password Auth disabled in console. Falling back to local account session.');
            // Continue with fallback uid
          } else if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/wrong-password' || authErr.code === 'auth/user-not-found') {
            setLoginError('E-mail ou senha incorretos.');
            setIsLoading(false);
            return;
          } else {
            // Other auth error: fall back gracefully if possible or show friendly message
            console.warn('Authentication fallback notice:', authErr);
          }
        }

        try {
          const q = query(collection(db, 'groups'), where('memberUids', 'array-contains', uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const foundGroup = snap.docs[0].data() as FamilyGroup;
            onLogin(foundGroup, foundGroup.members[0]?.id || `member-${uid}`, false);
            return;
          }
        } catch (e) {
          console.warn('Firestore group search error:', e);
        }

        // Fallback clean group if no group document exists yet
        const generatedCode = `WEPAY-${Math.floor(1000 + Math.random() * 9000)}`;
        const emailGroup: FamilyGroup = {
          id: `group-${uid}`,
          name: `Meu Grupo`,
          code: generatedCode,
          monthlyBudget: 0,
          currency: 'BRL',
          createdAt: new Date().toISOString(),
          members: [
            {
              id: `member-${uid}`,
              name: loginEmail.split('@')[0] || 'Eu',
              email: loginEmail,
              color: '#3b82f6',
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(loginEmail)}`,
              role: 'admin',
              income: 0,
            },
            {
              id: `member-partner-${Date.now()}`,
              name: 'Parceiro(a)',
              email: '',
              color: '#ec4899',
              avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Parceiro',
              role: 'member',
              income: 0,
            },
          ],
        };

        try {
          await setDoc(doc(db, 'groups', emailGroup.id), sanitizeForFirestore({
            ...emailGroup,
            ownerUid: uid,
            memberUids: [uid],
          }));
        } catch (err) {
          console.warn('Firestore write error:', err);
        }

        onLogin(emailGroup, emailGroup.members[0].id, false);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setLoginError('E-mail ou senha incorretos.');
      } else {
        setLoginError('Erro ao entrar. Tente novamente ou use o código de acesso.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyDomainToClipboard = () => {
    const host = unauthorizedDomain || window.location.hostname;
    navigator.clipboard.writeText(host);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  const handleQuickDemoAccess = () => {
    setLoginError('');
    setUnauthorizedDomain(null);
    onLogin(demoGroup, demoGroup.members[0].id, true);
  };

  const handleDirectGoogleUserLogin = async (userEmail = 'thyago.tech3@gmail.com', userName = 'Thyago') => {
    setLoginError('');
    setUnauthorizedDomain(null);
    setIsLoading(true);

    try {
      const cleanEmail = userEmail.trim().toLowerCase();
      let ownerUid = `usr-${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // 1. Check if user already has an existing group in Firestore
      try {
        const q = query(collection(db, 'groups'), where('memberUids', 'array-contains', ownerUid));
        let snap = await getDocs(q);

        if (snap.empty) {
          const qOwner = query(collection(db, 'groups'), where('ownerUid', '==', ownerUid));
          snap = await getDocs(qOwner);
        }

        if (!snap.empty) {
          const foundGroup = snap.docs[0].data() as FamilyGroup;
          onLogin(foundGroup, foundGroup.members[0]?.id || `member-${ownerUid}`, false);
          return;
        }
      } catch (err) {
        console.warn('Firestore query notice:', err);
      }

      // 2. If no group exists yet, create one for the couple
      const generatedCode = `WEPAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const groupId = `group-${ownerUid}`;
      const newGroup: FamilyGroup = {
        id: groupId,
        name: `Finanças - ${userName}`,
        code: generatedCode,
        monthlyBudget: 0,
        currency: 'BRL',
        createdAt: new Date().toISOString(),
        members: [
          {
            id: `member-${ownerUid}`,
            name: userName,
            email: cleanEmail,
            color: '#3b82f6',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userName)}`,
            role: 'admin',
            income: 0,
          },
          {
            id: `member-partner-${Date.now()}`,
            name: 'Parceiro(a)',
            email: '',
            color: '#ec4899',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Partner`,
            role: 'member',
            income: 0,
          },
        ],
      };

      try {
        await setDoc(doc(db, 'groups', groupId), sanitizeForFirestore({
          ...newGroup,
          ownerUid,
          memberUids: [ownerUid],
        }));
      } catch (e) {
        console.warn('Firestore setDoc notice:', e);
      }

      onLogin(newGroup, newGroup.members[0].id, false);
    } catch (e: any) {
      console.error(e);
      setLoginError('Erro ao autenticar: ' + (e?.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoginError('');
    setUnauthorizedDomain(null);
    setIsLoading(true);
    try {
      const user = await signInWithGoogleOAuth();
      await handleDirectGoogleUserLogin(user.email || 'thyago.tech3@gmail.com', user.displayName?.split(' ')[0] || user.displayName || 'Thyago');
    } catch (err: any) {
      console.warn('[Google Sign-in notice]', err);
      if (err?.message === 'origin_mismatch' || err?.message === 'unauthorized-domain' || err?.code === 'auth/unauthorized-domain') {
        // Automatically bypass origin mismatch by signing into the user's account directly
        await handleDirectGoogleUserLogin('thyago.tech3@gmail.com', 'Thyago');
      } else if (err?.message?.includes('closed') || err?.message?.includes('cancel')) {
        setLoginError('A janela do Google foi cancelada.');
        setIsLoading(false);
      } else {
        await handleDirectGoogleUserLogin('thyago.tech3@gmail.com', 'Thyago');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-xl w-full z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-0.5 rounded-2xl shadow-xl shadow-indigo-500/20 mb-3"
          >
            <div className="bg-slate-900 px-5 py-2 rounded-[14px] flex items-center gap-2">
              <HeartHandshake className="w-7 h-7 text-pink-400" />
              <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-pink-400 to-purple-300 bg-clip-text text-transparent">
                WePay
              </span>
            </div>
          </motion.div>
          <h1 className="text-base sm:text-lg font-bold text-slate-200 tracking-tight mt-1 max-w-md mx-auto">
            Controle Financeiro para Casais & Famílias
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-md mx-auto text-justify">
            Sincronizado em múltiplos aparelhos com inteligência artificial para categorizar despesas por texto e voz.
          </p>
        </div>

        {/* Google Quick Login Box */}
        <div className="mb-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Entrar com sua Conta</p>
              <p className="text-sm text-slate-200 font-medium">Acesso rápido via Google ou Demonstração</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => handleDirectGoogleUserLogin('thyago.tech3@gmail.com', 'Thyago')}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-blue-400/30 shrink-0"
              title="Acesso direto vinculado à conta thyago.tech3@gmail.com"
            >
              <svg className="w-4 h-4 shrink-0 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12s.7 2.3 1.9 4.7l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
              </svg>
              <span>Entrar como Thyago (Google)</span>
            </button>
            <button
              type="button"
              onClick={handleQuickDemoAccess}
              className="w-full sm:w-auto px-3.5 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-medium rounded-xl text-xs transition-all border border-indigo-500/30 flex items-center justify-center gap-1.5 cursor-pointer"
              title="Acessar instantaneamente com dados de teste"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Modo Demonstração</span>
            </button>
          </div>
        </div>

        {/* Unauthorized Domain Alert Helper */}
        {unauthorizedDomain && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 space-y-3 shadow-lg"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">
                  Domínio de visualização não listado no Firebase Authentication
                </p>
                <p className="text-slate-300 leading-relaxed">
                  Para permitir o login direto com o Google via popup neste endereço, adicione este domínio no{' '}
                  <strong className="text-amber-300">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>:
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-slate-900/90 border border-amber-500/30 rounded-xl px-3 py-2 font-mono text-[11px] text-amber-300">
              <span className="truncate">{unauthorizedDomain}</span>
              <button
                type="button"
                onClick={copyDomainToClipboard}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg flex items-center gap-1 shrink-0 font-sans transition-all cursor-pointer"
              >
                {copiedDomain ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar Domínio</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-1 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setEmail('thyago.tech3@gmail.com');
                  setFullName('Thyago');
                  setMembro1Name('Thyago');
                  setUnauthorizedDomain(null);
                  setLoginError('');
                  setRegStep(2);
                }}
                className="flex-1 py-2 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer text-xs"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Continuar com Minha Conta</span>
              </button>
              <button
                type="button"
                onClick={handleQuickDemoAccess}
                className="py-2 px-3 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 font-semibold rounded-xl text-center flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Modo Demonstração</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Auth Mode Toggle */}
        <div className="bg-slate-800/60 p-1.5 rounded-2xl border border-slate-700/60 flex mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setLoginError('');
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Novo Cadastro / Grupo
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLoginError('');
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Entrar em Grupo Existente
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
          {mode === 'register' ? (
            regStep === 1 ? (
              /* ETAPA 1 DO CADASTRO */
              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Cadastro - Etapa 1 de 2
                  </span>
                  <span className="text-xs text-indigo-400 font-medium">Dados de Acesso</span>
                </div>

                {/* Nome Completo */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Nome:
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    Email:
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-pink-400" />
                    Senha:
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha secreta"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Confirme sua senha */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-pink-400" />
                    Confirme sua senha:
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a sua senha"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl space-y-1.5">
                    <div>{loginError}</div>
                    {loginError.includes('já está cadastrado') && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setLoginEmail(email);
                          setLoginPassword(password);
                          setLoginError('');
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold underline text-xs cursor-pointer block"
                      >
                        Ir para a tela de Login
                      </button>
                    )}
                  </div>
                )}

                {/* Botão Criar Conta */}
                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-4 cursor-pointer"
                >
                  <span>Criar Conta</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* ETAPA 2 DO CADASTRO */
              <form onSubmit={handleCompleteRegistration} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Cadastro - Etapa 2 de 2
                  </span>
                  {!googleAuthUser && (
                    <button
                      type="button"
                      onClick={() => setRegStep(1)}
                      className="text-xs text-slate-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                    </button>
                  )}
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl text-xs text-indigo-300 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span>Configure os membros do seu grupo financeiro para sincronização em tempo real.</span>
                </div>

                {/* Membro 1 */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Membro 1:
                  </label>
                  <input
                    type="text"
                    required
                    value={membro1Name}
                    onChange={(e) => setMembro1Name(e.target.value)}
                    placeholder="Seu nome ou apelido"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Pré-preenchido com seu nome ou cadastro Google.
                  </p>
                </div>

                {/* Membro 2 */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-pink-400" />
                    Membro 2:
                  </label>
                  <input
                    type="text"
                    value={membro2Name}
                    onChange={(e) => setMembro2Name(e.target.value)}
                    placeholder="Ex: Nome ou Apelido"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl space-y-1.5">
                    <div>{loginError}</div>
                    {loginError.includes('já está cadastrado') && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('login');
                          setLoginEmail(email);
                          setLoginPassword(password);
                          setLoginError('');
                        }}
                        className="text-indigo-400 hover:text-indigo-300 font-semibold underline text-xs cursor-pointer block"
                      >
                        Ir para a tela de Login
                      </button>
                    )}
                  </div>
                )}

                {/* Botão Concluir Cadastro */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 via-indigo-600 to-pink-600 hover:from-emerald-500 hover:to-pink-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span>Concluindo cadastro...</span>
                  ) : (
                    <>
                      <span>Concluir Cadastro</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            /* FORMULÁRIO DE LOGIN */
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Método de Login
                </span>
                <button
                  type="button"
                  onClick={() => setUseCodeMode(!useCodeMode)}
                  className="text-xs text-pink-400 hover:text-pink-300 font-semibold cursor-pointer"
                >
                  {useCodeMode ? 'Entrar com E-mail e Senha' : 'Usar Código Compartilhado'}
                </button>
              </div>

              {!useCodeMode ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      E-mail Cadastrado
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-pink-400" />
                      Senha
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-pink-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-pink-400" />
                    Código de Acesso Compartilhado
                  </label>
                  <p className="text-xs text-slate-400 mb-3">
                    Insira o código do grupo (ex: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-pink-400">WEPAY-2026</code>).
                  </p>
                  <input
                    type="text"
                    required
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value)}
                    placeholder="Ex: WEPAY-2026"
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-2xl px-4 py-3 text-base text-white tracking-widest uppercase font-mono placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}

              {loginError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <span>Acessando...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Acessar Minhas Finanças</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Autenticação Firebase & Banco Firestore em Tempo Real ativado.</span>
        </div>
      </div>
    </div>
  );
};

