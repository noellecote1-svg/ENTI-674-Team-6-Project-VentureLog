export const TAG_COLORS: Record<string, string> = {
  Product:     "bg-indigo-950/60 text-indigo-300 border-indigo-700/50",
  Growth:      "bg-emerald-950/60 text-emerald-300 border-emerald-700/50",
  Team:        "bg-orange-950/60 text-orange-300 border-orange-700/50",
  Fundraising: "bg-cyan-950/60 text-cyan-300 border-cyan-700/50",
  Operations:  "bg-slate-800/60 text-slate-300 border-slate-600/50",
  Finance:     "bg-teal-950/60 text-teal-300 border-teal-700/50",
  Reflection:  "bg-rose-950/60 text-rose-300 border-rose-700/50",
};

export const ALL_TAGS = [
  "Product",
  "Growth",
  "Team",
  "Fundraising",
  "Operations",
  "Finance",
  "Reflection",
] as const;
