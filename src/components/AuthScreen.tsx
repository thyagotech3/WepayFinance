import React, { useState } from 'react';
import { FamilyGroup, FamilyMember } from '../types';
import {
  User,
  ArrowRight,
  ShieldCheck,
  Key,
  HeartHandshake,
  Mail,
  Lock,
  LogIn,
  ArrowLeft,
  UserCheck,
  Users,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
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
  demoGroup?: FamilyGroup;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
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
  const [loginSuccessMessage, setLoginSuccessMessage] = useState('');
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Password reset modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState('');

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

    const firstName = fullName.trim().split(' ')[0] || fullName.trim();
    setMembro1Name(firstName);
    setRegStep(2);
  };

  // Step 2 Submit: Finish Registration & Create Group in Firestore
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);

    try {
      let ownerUid = '';
      let userEmail = email.trim().toLowerCase();
      let userAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(membro1Name || 'Member1')}`;

      if (googleAuthUser) {
        ownerUid = googleAuthUser.uid;
        userEmail = (googleAuthUser.email || email).trim().toLowerCase();
        if (googleAuthUser.photoURL) {
          userAvatar = googleAuthUser.photoURL;
        }
      } else {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, userEmail, password);
          ownerUid = userCredential.user.uid;
        } catch (authErr: any) {
          console.warn('Firebase createUser error code:', authErr.code, authErr);
          if (authErr.code === 'auth/email-already-in-use') {
            setLoginError('Este e-mail já possui cadastro. Alterne para a aba "Entrar" e informe sua senha.');
            setIsLoading(false);
            return;
          } else if (authErr.code === 'auth/weak-password') {
            setLoginError('A senha deve conter pelo menos 6 caracteres.');
            setIsLoading(false);
            return;
          } else if (authErr.code === 'auth/invalid-email') {
            setLoginError('Formato de e-mail inválido.');
            setIsLoading(false);
            return;
          } else {
            setLoginError(`Erro no cadastro: ${authErr.message || 'Verifique seus dados.'}`);
            setIsLoading(false);
            return;
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

      onLogin(newGroup, formattedMembers[0].id, false);
    } catch (err: any) {
      console.error(err);
      setLoginError('Erro ao finalizar cadastro: ' + (err.message || 'Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Login Submit: Strict Password & Credential Verification
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccessMessage('');
    setIsLoading(true);

    try {
      // 1. Group Code Mode
      if (useCodeMode) {
        const cleanCode = loginCode.trim().toUpperCase();
        if (!cleanCode) {
          setLoginError('Por favor, informe o código do grupo.');
          setIsLoading(false);
          return;
        }

        try {
          const q = query(collection(db, 'groups'), where('code', '==', cleanCode));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const foundGroup = snap.docs[0].data() as FamilyGroup;
            const targetMemberId = foundGroup.members[1]?.id || foundGroup.members[0]?.id || 'member-1';
            onLogin(foundGroup, targetMemberId, false);
            return;
          } else {
            setLoginError('Código de grupo não encontrado. Verifique com seu parceiro(a) ou crie um novo cadastro.');
            setIsLoading(false);
            return;
          }
        } catch (codeErr: any) {
          console.warn('Firestore query by code error:', codeErr);
          setLoginError('Não foi possível verificar o código no banco de dados. Tente novamente.');
          setIsLoading(false);
          return;
        }
      }

      // 2. Email + Password Mode (Strict Firebase Authentication)
      const cleanEmail = loginEmail.trim().toLowerCase();
      if (!cleanEmail || !loginPassword) {
        setLoginError('Informe seu e-mail e senha cadastrados.');
        setIsLoading(false);
        return;
      }

      let authUid = '';
      try {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, loginPassword);
        authUid = userCredential.user.uid;
      } catch (authErr: any) {
        console.warn('Firebase signIn failure code:', authErr.code, authErr.message);

        if (
          authErr.code === 'auth/invalid-credential' ||
          authErr.code === 'auth/wrong-password' ||
          authErr.code === 'auth/user-not-found'
        ) {
          setLoginError('E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.');
        } else if (authErr.code === 'auth/invalid-email') {
          setLoginError('O formato do e-mail é inválido.');
        } else if (authErr.code === 'auth/too-many-requests') {
          setLoginError('Muitas tentativas falharam. Por segurança, aguarde alguns minutos ou redefina sua senha.');
        } else if (authErr.code === 'auth/user-disabled') {
          setLoginError('Esta conta foi desativada pelo administrador.');
        } else {
          setLoginError(authErr.message || 'Erro ao realizar login. Verifique os dados inseridos.');
        }

        setIsLoading(false);
        return; // CRITICAL: Stop here! Do not log in on authentication error!
      }

      // 3. User authenticated successfully! Fetch their group from Firestore
      try {
        // Query by memberUids array
        const qMembers = query(collection(db, 'groups'), where('memberUids', 'array-contains', authUid));
        let snap = await getDocs(qMembers);

        if (snap.empty) {
          // Query by ownerUid
          const qOwner = query(collection(db, 'groups'), where('ownerUid', '==', authUid));
          snap = await getDocs(qOwner);
        }

        if (!snap.empty) {
          const foundGroup = snap.docs[0].data() as FamilyGroup;
          const currentMemId =
            foundGroup.members.find((m) => m.email?.toLowerCase() === cleanEmail)?.id ||
            foundGroup.members[0]?.id ||
            `member-${authUid}`;
          onLogin(foundGroup, currentMemId, false);
          return;
        }
      } catch (firestoreErr) {
        console.warn('Firestore group lookup note:', firestoreErr);
      }

      // 4. If user authenticated in Firebase Auth but has no group doc in Firestore yet, bootstrap one
      const generatedCode = `WEPAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const fallbackGroup: FamilyGroup = {
        id: `group-${authUid}`,
        name: `Finanças - ${cleanEmail.split('@')[0]}`,
        code: generatedCode,
        monthlyBudget: 0,
        currency: 'BRL',
        createdAt: new Date().toISOString(),
        members: [
          {
            id: `member-${authUid}`,
            name: cleanEmail.split('@')[0] || 'Eu',
            email: cleanEmail,
            color: '#3b82f6',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanEmail)}`,
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
        await setDoc(doc(db, 'groups', fallbackGroup.id), sanitizeForFirestore({
          ...fallbackGroup,
          ownerUid: authUid,
          memberUids: [authUid],
        }));
      } catch (err) {
        console.warn('Firestore auto-creation write note:', err);
      }

      onLogin(fallbackGroup, fallbackGroup.members[0].id, false);
    } catch (err: any) {
      console.error(err);
      setLoginError('Erro inesperado ao acessar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google Sign-In with standard compliance & Firestore linking
  const handleGoogleLogin = async () => {
    setLoginError('');
    setUnauthorizedDomain(null);
    setIsLoading(true);

    try {
      const user = await signInWithGoogleOAuth();
      const cleanEmail = (user.email || '').trim().toLowerCase();
      const userUid = user.uid;

      // 1. Search for existing group in Firestore
      try {
        const q1 = query(collection(db, 'groups'), where('memberUids', 'array-contains', userUid));
        let snap = await getDocs(q1);

        if (snap.empty) {
          const q2 = query(collection(db, 'groups'), where('ownerUid', '==', userUid));
          snap = await getDocs(q2);
        }

        if (!snap.empty) {
          const foundGroup = snap.docs[0].data() as FamilyGroup;
          const currentMemId =
            foundGroup.members.find((m) => m.email?.toLowerCase() === cleanEmail)?.id ||
            foundGroup.members[0]?.id ||
            `member-${userUid}`;
          onLogin(foundGroup, currentMemId, false);
          return;
        }
      } catch (firestoreErr) {
        console.warn('Firestore lookup notice for Google user:', firestoreErr);
      }

      // 2. If new user, create group in Firestore
      const firstName = user.displayName?.split(' ')[0] || user.displayName || 'Eu';
      const generatedCode = `WEPAY-${Math.floor(1000 + Math.random() * 9000)}`;
      const groupId = `group-${userUid}`;

      const newGroup: FamilyGroup = {
        id: groupId,
        name: `Finanças - ${firstName}`,
        code: generatedCode,
        monthlyBudget: 0,
        currency: 'BRL',
        createdAt: new Date().toISOString(),
        members: [
          {
            id: `member-${userUid}`,
            name: firstName,
            email: cleanEmail,
            color: '#3b82f6',
            avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(firstName)}`,
            role: 'admin',
            income: 0,
          },
          {
            id: `member-partner-${Date.now()}`,
            name: 'Parceiro(a)',
            email: '',
            color: '#ec4899',
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Parceiro`,
            role: 'member',
            income: 0,
          },
        ],
      };

      try {
        await setDoc(doc(db, 'groups', groupId), sanitizeForFirestore({
          ...newGroup,
          ownerUid: userUid,
          memberUids: [userUid],
        }));
      } catch (e) {
        console.warn('Firestore setDoc notice on Google registration:', e);
      }

      onLogin(newGroup, newGroup.members[0].id, false);
    } catch (err: any) {
      console.warn('[Google Login notice]', err);

      if (err.message === 'unauthorized-domain' || err.code === 'auth/unauthorized-domain') {
        const host = window.location.hostname;
        setUnauthorizedDomain(host);
        setLoginError(`O domínio "${host}" precisa ser autorizado no Firebase Authentication para o popup do Google.`);
      } else if (err.message === 'origin_mismatch') {
        const host = window.location.hostname;
        setUnauthorizedDomain(host);
        setLoginError(`Origem não autorizada no Google Cloud Console (${host}). Adicione a URL nas origens autorizadas.`);
      } else if (err.message === 'popup-blocked') {
        setLoginError('O navegador bloqueou a janela pop-up do Google. Por favor, permita pop-ups para este site.');
      } else if (err.message === 'popup-closed') {
        setLoginError('A janela de login do Google foi fechada antes de concluir a autenticação.');
      } else {
        setLoginError('Não foi possível autenticar com o Google. Verifique sua conexão ou utilize e-mail e senha.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Password Reset Handler
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetStatus('loading');
    setResetMessage('');

    const targetEmail = resetEmail.trim().toLowerCase();
    if (!targetEmail) {
      setResetStatus('error');
      setResetMessage('Informe o seu e-mail cadastrado.');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setResetStatus('success');
      setResetMessage('E-mail de recuperação enviado com sucesso! Verifique sua caixa de entrada e spam.');
    } catch (err: any) {
      setResetStatus('error');
      if (err.code === 'auth/user-not-found') {
        setResetMessage('Nenhuma conta encontrada com este e-mail.');
      } else if (err.code === 'auth/invalid-email') {
        setResetMessage('Formato de e-mail inválido.');
      } else {
        setResetMessage('Erro ao enviar e-mail de recuperação. Tente novamente.');
      }
    }
  };

  const copyDomainToClipboard = () => {
    const host = unauthorizedDomain || window.location.hostname;
    navigator.clipboard.writeText(host);
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden selection:bg-pink-500 selection:text-white">
      {/* Background Ambience Glow */}
      <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] bg-pink-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-0.5 rounded-2xl shadow-xl shadow-indigo-500/20 mb-3.5"
          >
            <div className="bg-slate-900 px-5 py-2.5 rounded-[14px] flex items-center gap-2.5">
              <HeartHandshake className="w-6 h-6 text-pink-400" />
              <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-pink-400 to-purple-300 bg-clip-text text-transparent">
                WePay
              </span>
            </div>
          </motion.div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
            Controle Financeiro de Casal
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5 max-w-sm mx-auto">
            Sincronização em tempo real, divisão justa de despesas e inteligência financeira.
          </p>
        </div>

        {/* Google Sign-In Button (Official Standard Compliant) */}
        <div className="mb-5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full h-12 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-2xl text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-3 cursor-pointer border border-slate-200 active:scale-[0.99] disabled:opacity-50"
            title="Fazer login com a Conta do Google"
            aria-label="Fazer login com a Conta do Google"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoading ? 'Autenticando...' : 'Continuar com o Google'}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-6">
          <div className="border-t border-slate-800 w-full" />
          <span className="bg-slate-950 px-3 text-[11px] font-semibold tracking-wider text-slate-500 uppercase shrink-0">
            ou acesse com e-mail
          </span>
          <div className="border-t border-slate-800 w-full" />
        </div>

        {/* Unauthorized Domain Alert Helper */}
        {unauthorizedDomain && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 space-y-3 shadow-lg"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-300">
                  Domínio precisa ser autorizado no Firebase
                </p>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Para ativar o login via Google neste endereço, adicione este domínio em{' '}
                  <strong className="text-amber-300">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>:
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 bg-slate-900 border border-amber-500/30 rounded-xl px-3 py-2 font-mono text-[11px] text-amber-300">
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
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* Auth Mode Toggle */}
        <div className="bg-slate-900/90 p-1 rounded-2xl border border-slate-800 flex mb-5">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLoginError('');
              setLoginSuccessMessage('');
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setLoginError('');
              setLoginSuccessMessage('');
            }}
            className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-gradient-to-r from-indigo-600 to-pink-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Criar Nova Conta
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-7 backdrop-blur-xl shadow-2xl">
          {mode === 'register' ? (
            regStep === 1 ? (
              /* ETAPA 1 DO CADASTRO */
              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Cadastro - Etapa 1 de 2
                  </span>
                  <span className="text-xs text-indigo-400 font-semibold">Seus Dados</span>
                </div>

                {/* Nome Completo */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Seu Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                    E-mail
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Senha */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-pink-400" />
                    Criar Senha
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {/* Confirme sua senha */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-pink-400" />
                    Confirmar Senha
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 mt-4 cursor-pointer"
                >
                  <span>Próximo Passo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              /* ETAPA 2 DO CADASTRO */
              <form onSubmit={handleCompleteRegistration} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
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
                  <span>Defina os membros do casal para sincronizar despesas conjuntas.</span>
                </div>

                {/* Membro 1 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                    Seu Nome ou Apelido
                  </label>
                  <input
                    type="text"
                    required
                    value={membro1Name}
                    onChange={(e) => setMembro1Name(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Membro 2 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-pink-400" />
                    Nome do(a) Parceiro(a)
                  </label>
                  <input
                    type="text"
                    value={membro2Name}
                    onChange={(e) => setMembro2Name(e.target.value)}
                    placeholder="Ex: Carlos / Juliana"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500"
                  />
                </div>

                {loginError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl">
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-emerald-600 via-indigo-600 to-pink-600 hover:from-emerald-500 hover:to-pink-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Criando conta...
                    </span>
                  ) : (
                    <>
                      <span>Concluir e Acessar WePay</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )
          ) : (
            /* FORMULÁRIO DE LOGIN COM VALIDAÇÃO REAL */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {useCodeMode ? 'Código de Compartilhamento' : 'Acesso com Senha'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setUseCodeMode(!useCodeMode);
                    setLoginError('');
                  }}
                  className="text-xs text-pink-400 hover:text-pink-300 font-semibold cursor-pointer"
                >
                  {useCodeMode ? 'Usar E-mail e Senha' : 'Entrar com Código'}
                </button>
              </div>

              {!useCodeMode ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      E-mail Cadastrado
                    </label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-pink-400" />
                        Senha
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(loginEmail);
                          setShowForgotModal(true);
                          setResetStatus('idle');
                          setResetMessage('');
                        }}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 transition-colors"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-pink-400" />
                    Código de Acesso do Grupo
                  </label>
                  <p className="text-xs text-slate-400 mb-2.5">
                    Insira o código gerado na conta do casal (ex: <code className="bg-slate-950 px-1.5 py-0.5 rounded text-pink-400 font-mono">WEPAY-8492</code>).
                  </p>
                  <input
                    type="text"
                    required
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value)}
                    placeholder="Ex: WEPAY-1234"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-base text-white tracking-widest uppercase font-mono placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:border-pink-500"
                  />
                </div>
              )}

              {loginError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl leading-relaxed">
                  {loginError}
                </div>
              )}

              {loginSuccessMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs p-3 rounded-xl">
                  {loginSuccessMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white font-bold rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Verificando credenciais...
                  </span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Entrar no WePay</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Security Badge Footer */}
        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Autenticação protegida via Firebase & Firestore em Tempo Real</span>
        </div>
      </div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-400" />
                  Redefinir Senha
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Fechar
                </button>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Informe o seu e-mail cadastrado. Enviaremos um link seguro para você cadastrar uma nova senha.
              </p>

              <form onSubmit={handlePasswordReset} className="space-y-3">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />

                {resetMessage && (
                  <div
                    className={`text-xs p-3 rounded-xl ${
                      resetStatus === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                        : 'bg-red-500/10 border border-red-500/30 text-red-300'
                    }`}
                  >
                    {resetMessage}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={resetStatus === 'loading'}
                    className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl transition-all shadow cursor-pointer disabled:opacity-50"
                  >
                    {resetStatus === 'loading' ? 'Enviando...' : 'Enviar Link'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
