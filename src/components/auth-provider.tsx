
"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut, signInAnonymously, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';


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
      const storedUser = sessionStorage.getItem('battledore_user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Failed to parse user from sessionStorage', error);
      sessionStorage.removeItem('battledore_user');
    } finally {
        setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) {
            try {
                // If no user, sign in anonymously to establish a session
                await signInAnonymously(auth);
            } catch (error) {
                console.error("Anonymous sign-in failed:", error);
            }
        }
    });

    // Check for critical Firebase configuration errors on startup
    const checkConfig = async () => {
        try {
            await getDocs(collection(db, 'users')); 
        } catch (error: any) {
            console.error("CRITICAL: Firebase configuration is invalid or a required API is not enabled.", error.message);
            if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
                 console.error("ACTION REQUIRED: Please check your Firestore Security Rules to allow read/write access.");
            }
             if (error.message.includes("auth/configuration-not-found")) {
                console.error("ACTION REQUIRED: Please enable the 'Identity Toolkit API' for your project in the Google Cloud Console.");
                console.error("You can enable it here: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com");
            }
        }
    };
    checkConfig();

    return () => unsubscribe();
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
      const courtUser: User = {
        id: `court_${courtName}`,
        name: `Umpire - ${courtName}`,
        role: 'court',
        courtName: courtName,
        username: courtName,
        email: '',
        phoneNumber: '',
      };
      
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
    signOut(auth).catch(error => console.error("Error signing out:", error));
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
