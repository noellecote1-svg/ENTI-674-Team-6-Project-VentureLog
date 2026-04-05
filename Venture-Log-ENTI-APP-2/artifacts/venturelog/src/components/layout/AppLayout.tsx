import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-[100dvh] bg-background flex flex-col md:flex-row w-full overflow-hidden">
      <Sidebar />
      <main className="flex-1 w-full overflow-y-auto relative">
        {children}
      </main>
    </div>
  );
}
