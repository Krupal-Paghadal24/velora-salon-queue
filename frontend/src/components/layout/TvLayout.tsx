import React from 'react';

export const TvLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-velora-green-dark text-velora-ivory p-6 md:p-10 flex flex-col justify-between overflow-hidden select-none">
      {children}
    </div>
  );
};
