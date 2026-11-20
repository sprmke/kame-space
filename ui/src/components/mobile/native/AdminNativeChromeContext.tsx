import { createContext, useContext, type ReactNode } from 'react';

type AdminNativeChromeValue = {
  /** Opens the Ask Kame sheet / assistant with the current page as context. */
  onAskKame?: () => void;
  /** Hide the Kame button when AI is off for the scope. */
  hideKame?: boolean;
  /** Label the Kame button on Today only. */
  askKameLabelled?: boolean;
};

const AdminNativeChromeContext = createContext<AdminNativeChromeValue>({});

export function AdminNativeChromeProvider({
  value,
  children,
}: {
  value: AdminNativeChromeValue;
  children: ReactNode;
}) {
  return (
    <AdminNativeChromeContext.Provider value={value}>{children}</AdminNativeChromeContext.Provider>
  );
}

export function useAdminNativeChrome(): AdminNativeChromeValue {
  return useContext(AdminNativeChromeContext);
}
