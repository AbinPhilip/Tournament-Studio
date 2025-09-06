
"use client";

import React, { createContext, useState, useEffect, useCallback } from 'react';
import type { User } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut, signInAnonymously } from 'firebase/auth';


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
      // First, try to get the user from session storage for faster page loads
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

  // Add this effect to validate the Firebase connection on startup.
  useEffect(() => {
    try {
        const auth = getAuth();
        onAuthStateChanged(auth, (firebaseUser) => {
            console.log("Firebase connection validated successfully.");
            // We don't need to do anything with the user here, this just confirms the connection.
        });
    } catch (error: any) {
        console.error("CRITICAL: Firebase configuration is invalid or a required API is not enabled.");
        if (error.message && error.message.includes("auth/configuration-not-found")) {
            console.error("ACTION REQUIRED: Please enable the 'Identity Toolkit API' for your project in the Google Cloud Console.");
            console.error("You can enable it here: https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com");
        }
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
        
        console.log('[AuthProvider] User logged in:', JSON.stringify(foundUser, null, 2));
        
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
      
      console.log('[AuthProvider] Court Umpire logged in:', JSON.stringify(courtUser, null, 2));

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
    signOut(auth);
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
