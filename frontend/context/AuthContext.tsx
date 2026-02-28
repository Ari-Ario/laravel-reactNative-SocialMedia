// import { createContext } from "react";
// export default createContext();

import { createContext } from "react";

interface AuthContextType {
  user: null | {
    profile_photo: any; id: string; name: string; email: string; email_verified_at?: string | null; is_admin?: boolean; ai_admin?: boolean
  };
  setUser: (user: null | { id: string; name: string; email: string; email_verified_at?: string | null; is_admin?: boolean; ai_admin?: boolean }) => void;
  logout: () => Promise<void>; // Add logout function to context
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => { },
  logout: async () => { } // Default empty async function
});

export default AuthContext;