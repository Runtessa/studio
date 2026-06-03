import React from 'react';

type MainContentProps = {
  children: React.ReactNode;
};

export const MainContent = ({ children }: MainContentProps) => {
  return (
    <main className="flex-1 bg-bgApp py-8">
      <div className="px-8 space-y-6">{children}</div>
    </main>
  );
};

export default MainContent;
