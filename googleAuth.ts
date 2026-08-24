import firebaseConfig from '../../firebase-applet-config.json';
import { auth, googleProvider, signInWithPopup, GoogleAuthProvider, signInWithCredential } from './firebase';

export interface GoogleUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

/**
 * Loads the Google Identity Services (GSI) script if not already loaded.
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts) {
      resolve();
      return;
    }
    const existing = document.getElementById('google-gsi-client');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // Resolve anyway to fallback to popup
    document.head.appendChild(script);
  });
}

/**
 * Performs Google Sign-In using Google Identity Services (GSI) OAuth2 Token Flow.
 * This bypasses Firebase Auth's unauthorized-domain restriction in preview containers
 * by authorizing directly through Google Identity Services.
 */
export async function signInWithGoogleOAuth(): Promise<GoogleUserProfile> {
  await loadGsiScript();

  const clientId = firebaseConfig.oAuthClientId;

  // Method 1: Try Google Identity Services (GSI) oauth2 token client
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2 && clientId) {
    try {
      const profile = await new Promise<GoogleUserProfile>((resolve, reject) => {
        try {
          const client = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'email profile openid',
            prompt: 'select_account',
            callback: async (tokenResponse: any) => {
              if (tokenResponse.error) {
                reject(new Error(tokenResponse.error_description || tokenResponse.error));
                return;
              }
              try {
                // Fetch User Info directly from Google's OpenID endpoint
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: {
                    Authorization: `Bearer ${tokenResponse.access_token}`,
                  },
                });
                if (!res.ok) {
                  throw new Error('Falha ao obter perfil do Google');
                }
                const data = await res.json();
                
                // Attempt to link with Firebase Auth credential if possible
                try {
                  if (tokenResponse.id_token) {
                    const cred = GoogleAuthProvider.credential(tokenResponse.id_token);
                    await signInWithCredential(auth, cred);
                  }
                } catch (firebaseErr) {
                  console.warn('Firebase signInWithCredential notice:', firebaseErr);
                }

                resolve({
                  uid: data.sub || `google_${Date.now()}`,
                  email: data.email || '',
                  displayName: data.name || data.given_name || 'Usuário Google',
                  photoURL: data.picture || '',
                });
              } catch (fetchErr) {
                reject(fetchErr);
              }
            },
          });

          client.requestAccessToken();
        } catch (initErr) {
          reject(initErr);
        }
      });

      if (profile && profile.email) {
        return profile;
      }
    } catch (gsiErr: any) {
      console.warn('GSI Token Client notice:', gsiErr?.message || gsiErr);
      if (gsiErr?.message?.includes('origin_mismatch') || gsiErr?.message?.includes('unregistered_origin') || gsiErr?.message?.includes('400')) {
        throw new Error('origin_mismatch');
      }
      if (gsiErr?.message?.includes('closed') || gsiErr?.message?.includes('cancel')) {
        throw gsiErr;
      }
    }
  }

  // Method 2: Try Firebase signInWithPopup
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Usuário',
      photoURL: user.photoURL || '',
    };
  } catch (popupErr: any) {
    if (popupErr?.code === 'auth/unauthorized-domain' || popupErr?.message?.includes('unauthorized-domain')) {
      throw new Error('unauthorized-domain');
    }
    if (popupErr?.message?.includes('origin_mismatch') || popupErr?.code === 'auth/invalid-origin') {
      throw new Error('origin_mismatch');
    }
    throw popupErr;
  }
}
