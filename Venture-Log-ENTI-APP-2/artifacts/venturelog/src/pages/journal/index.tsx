import { useState } from "react";
import { useListJournalEntries, getListJournalEntriesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { Plus, Search, Tag, Calendar, ChevronRight, Menu } from "lucide-react";
import { TAG_COLORS, ALL_TAGS } from "@/lib/constants";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function JournalList() {
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  
  const { data: entries, isLoading, error } = useListJournalEntries(
    { tag: selectedTag, search: search || undefined },
    { query: { queryKey: getListJournalEntriesQueryKey({ tag: selectedTag, search: search || undefined }) } }
  );

  const FilterSidebar = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search entries..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Tag className="w-4 h-4" /> Filter by Tag
        </h3>
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant={!selectedTag ? "default" : "outline"} 
            className="cursor-pointer"
            onClick={() => setSelectedTag(undefined)}
            data-testid="badge-filter-all"
          >
            All Entries
          </Badge>
          {ALL_TAGS.map(tag => (
            <Badge 
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              className={`cursor-pointer ${selectedTag === tag ? TAG_COLORS[tag] : ""}`}
              onClick={() => setSelectedTag(selectedTag === tag ? undefined : tag)}
              data-testid={`badge-filter-${tag}`}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-24">
      <header className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden shrink-0" data-testid="button-filters">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <div className="pt-8">
                <FilterSidebar />
              </div>
            </SheetContent>
          </Sheet>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Journal</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Capture your thoughts and log decisions.</p>
          </div>
        </div>
        <Link href="/journal/new">
          <Button className="shrink-0 w-full sm:w-auto" data-testid="button-new-entry">
            <Plus className="w-4 h-4 mr-2" /> New Entry
          </Button>
        </Link>
      </header>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="hidden md:block w-64 shrink-0">
          <FilterSidebar />
        </div>

        <div className="flex-1 space-y-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-5/6 mb-4" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : error ? (
            <div className="text-center p-8 text-muted-foreground" data-testid="text-error">Failed to load entries.</div>
          ) : entries?.length === 0 ? (
            <Card className="border-dashed shadow-none bg-transparent">
              <CardContent className="p-8 sm:p-12 text-center text-muted-foreground">
                <p>No entries found. Start writing to capture your thinking.</p>
                <Link href="/journal/new">
                  <Button variant="outline" className="mt-4" data-testid="button-first-entry">Write your first entry</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            entries?.map(entry => (
              <Link key={entry.id} href={`/journal/${entry.id}/edit`}>
                <Card className="cursor-pointer hover:border-primary/40 transition-colors group" data-testid={`card-entry-${entry.id}`}>
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                        </span>
                        {entry.isPromoted && (
                          <Badge variant="secondary" className="bg-orange-500/15 text-orange-300 border border-orange-500/30 hover:bg-orange-500/20 text-[10px] px-1.5 py-0 shadow-none" data-testid="badge-promoted">
                            Decision Logged
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-foreground leading-relaxed line-clamp-3 mb-4 text-sm sm:text-base">
                        {entry.content.replace(/[#*`_~]/g, '')}
                      </p>
                      
                      <div className="flex flex-wrap gap-2">
                        {entry.tags.map(tag => (
                          <span key={tag} className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full border ${TAG_COLORS[tag]}`} data-testid={`tag-${tag}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div className="hidden sm:flex items-center sm:justify-end text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}