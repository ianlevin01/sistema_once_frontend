import { createContext, useContext, useState, useCallback } from "react";
import { login as apiLogin, loginWithGoogle as apiLoginWithGoogle, logout as apiLogout } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("auth_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const storeSession = (data) => {
    localStorage.setItem("auth_token", data.token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const login = useCallback(async (email, password) => {
    const { data } = await apiLogin(email, password);
    return storeSession(data);
  }, []);

  const loginWithGoogle = useCallback(async (id_token) => {
    const { data } = await apiLoginWithGoogle(id_token);
    return storeSession(data);
  }, []);

  const logout = useCallback(() => {
    apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, loginWithGoogle, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
