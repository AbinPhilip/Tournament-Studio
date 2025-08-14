
"use client";

import { useContext } from 'react';
import { AuthContext } from '@/components/auth-provider';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // This error is thrown if useAuth is used outside of an AuthProvider.
    // It's a critical error for developers to see, so no need to make it user-friendly.
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
