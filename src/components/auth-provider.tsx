"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';


interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, phoneNumber: string) => Promise<User | null>;
  courtLogin: (courtName: string) => Promise<User | null>;
  logout: () => void;
  updateUserContext: (updatedUser: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const auth = getAuth();
      // First, try to get the user from session storage for faster page loads
      const storedUser = sessionStorage.getItem('battledore_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }

      // Then, set up a listener to the actual Firebase Auth state
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // If a Firebase user exists, we can trust this auth state.
          // If the session user doesn't match, we clear it.
          const sessionUser = storedUser ? JSON.parse(storedUser) : null;
          if (!sessionUser || sessionUser.id !== firebaseUser.uid) {
             console.log("Session storage and auth state mismatch. Clearing session.");
             sessionStorage.removeItem('battledore_user');
             // You might want to fetch the user profile from Firestore here if needed
          }
        } else {
           // No Firebase user, so any session user is invalid.
           if (storedUser) {
             console.log("No auth session found. Clearing session storage.");
             sessionStorage.removeItem('battledore_user');
             setUser(null);
           }
        }
        setLoading(false);
      });
      return () => unsubscribe();

    } catch (error) {
      console.error('Failed to parse user from sessionStorage', error);
      sessionStorage.removeItem('battledore_user');
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, phoneNumber: string): Promise<User | null> => {
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('username', '==', username),
        where('phoneNumber', '==', phoneNumber)
      );
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const foundUser = { id: userDoc.id, ...userDoc.data() } as User;
        
        // **This is a placeholder for a real sign-in method**
        // In a real app, you would use signInWithEmailAndPassword, signInWithCustomToken, etc.
        // For this context, we will sign in anonymously to get a valid `request.auth` object.
        // IMPORTANT: The UID from anonymous sign-in will NOT match the Firestore document ID.
        // This is why storage rules must check for the existence of the user doc, not UID match.
        const auth = getAuth();
        await signInAnonymously(auth);

        sessionStorage.setItem('battledore_user', JSON.stringify(foundUser));
        setUser(foundUser);
        return foundUser;
      }
      return null;
    } catch (error) {
      console.error("Firebase login error:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const courtLogin = useCallback(async (courtName: string): Promise<User | null> => {
    setLoading(true);
    try {
      // Create a temporary user object for the court umpire
      const courtUser: User = {
        id: `court_${courtName}`,
        name: `Umpire - ${courtName}`,
        role: 'court',
        courtName: courtName,
        username: courtName,
        email: '',
        phoneNumber: '',
      };
      // Also sign in anonymously for court umpires to get a valid auth context
      const auth = getAuth();
      await signInAnonymously(auth);

      sessionStorage.setItem('battledore_user', JSON.stringify(courtUser));
      setUser(courtUser);
      return courtUser;
    } catch (error) {
      console.error("Court login error:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    const auth = getAuth();
    auth.signOut();
    sessionStorage.removeItem('battledore_user');
    setUser(null);
  }, []);
  
  const updateUserContext = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    sessionStorage.setItem('battledore_user', JSON.stringify(updatedUser));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, courtLogin, logout, updateUserContext }}>
      {children}
    </AuthContext.Provider>
  );
}
