import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet, apiPost, setToken, getToken } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    apiGet('/auth/me')
      .then((data) => setAdmin(data.admin))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await apiPost('/auth/login', { email, password });
    setToken(data.token);
    setAdmin(data.admin);
    return data.admin;
  };

  const logout = async () => {
    try { await apiPost('/auth/logout'); } catch {}
    setToken(null);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
