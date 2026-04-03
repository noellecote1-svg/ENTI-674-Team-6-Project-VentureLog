import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col md:flex-row w-full">
      <Sidebar />
      <main className="flex-1 w-full max-w-[1200px] mx-auto relative overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
