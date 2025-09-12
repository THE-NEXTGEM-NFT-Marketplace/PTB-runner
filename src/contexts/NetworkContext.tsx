import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type NetworkType = 'mainnet' | 'testnet' | 'devnet';

interface NetworkContextType {
  currentNetwork: NetworkType;
  setNetwork: (network: NetworkType) => void;
  isChangingNetwork: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>('mainnet');
  const [isChangingNetwork, setIsChangingNetwork] = useState(false);

  useEffect(() => {
    // Load saved network preference or default to mainnet
    const savedNetwork = localStorage.getItem('sui-network');
    if (savedNetwork && ['mainnet', 'testnet', 'devnet'].includes(savedNetwork)) {
      setCurrentNetwork(savedNetwork as NetworkType);
    }
  }, []);

  const setNetwork = async (network: NetworkType) => {
    setIsChangingNetwork(true);
    try {
      setCurrentNetwork(network);
      localStorage.setItem('sui-network', network);
    } finally {
      setIsChangingNetwork(false);
    }
  };

  return (
    <NetworkContext.Provider value={{ 
      currentNetwork, 
      setNetwork, 
      isChangingNetwork 
    }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}