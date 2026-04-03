export const TAG_COLORS: Record<string, string> = {
  Product: "bg-indigo-100 text-indigo-800 border-indigo-200",
  Growth: "bg-green-100 text-green-800 border-green-200",
  Team: "bg-orange-100 text-orange-800 border-orange-200",
  Fundraising: "bg-blue-100 text-blue-800 border-blue-200", // action blue mapped
  Operations: "bg-slate-100 text-slate-800 border-slate-200",
  Finance: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Reflection: "bg-rose-100 text-rose-800 border-rose-200",
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
