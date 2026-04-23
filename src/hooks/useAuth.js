// src/hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { auth, googleProvider, db } from '../services/firebase';
import {
  signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Create/update user doc
        const userRef = doc(db, 'users', u.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(userRef, {
            email: u.email,
            displayName: u.displayName || '',
            photoURL: u.photoURL || '',
            createdAt: serverTimestamp(),
            role: 'user'
          });
        }
        // Check admin
        const userData = snap.exists() ? snap.data() : {};
        setIsAdmin(userData.role === 'admin');
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const loginGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  }, []);

  const loginEmail = useCallback(async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  }, []);

  const signupEmail = useCallback(async (email, password, displayName) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    return result.user;
  }, []);

  // Member ID login (email = memberId@voxreader.app, password = memberId)
  const loginMemberId = useCallback(async (memberId) => {
    const email = `${memberId.toLowerCase()}@voxreader.app`;
    try {
      return await signInWithEmailAndPassword(auth, email, memberId);
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        // Auto-create account with member ID
        const result = await createUserWithEmailAndPassword(auth, email, memberId);
        await updateProfile(result.user, { displayName: memberId });
        return result;
      }
      throw e;
    }
  }, []);

  const logout = useCallback(() => signOut(auth), []);

  return { user, loading, isAdmin, loginGoogle, loginEmail, signupEmail, loginMemberId, logout };
}
