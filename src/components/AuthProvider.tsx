import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial check for local admin passcode
    const adminPass = localStorage.getItem('admin_passcode');
    if (adminPass === "Davendra@07") {
      setUser({ 
        uid: 'admin_davendra', 
        displayName: 'Admin (Davendra)',
        email: 'dav08kum@gmail.com' 
      } as User);
      setLoading(false);
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser(user);
      } else {
        // Re-check for local admin passcode if no firebase user
        const currentAdminPass = localStorage.getItem('admin_passcode');
        if (currentAdminPass === "Davendra@07") {
          setUser({ 
            uid: 'admin_davendra', 
            displayName: 'Admin (Davendra)',
            email: 'dav08kum@gmail.com' 
          } as User);
        } else {
          setUser(null);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
