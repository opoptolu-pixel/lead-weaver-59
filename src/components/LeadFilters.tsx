import { useState, useEffect } from "react";
import { Filter, X, Save, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface LeadFilter {
  jobType: string;
  postcodeArea: string;
  dateFrom: string;
  dateTo: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  filter: LeadFilter;
}

interface LeadFiltersProps {
  onFilterChange: (filter: LeadFilter) => void;
  jobTypes: string[];
}

const STORAGE_KEY = "leadFilters";

const defaultFilter: LeadFilter = {
  jobType: "",
  postcodeArea: "",
  dateFrom: "",
  dateTo: "",
};

export function LeadFilters({ onFilterChange, jobTypes }: LeadFiltersProps) {
  const [filter, setFilter] = useState<LeadFilter>(defaultFilter);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [filterName, setFilterName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Load saved filters from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSavedFilters(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved filters:", e);
      }
    }
  }, []);

  const activeFilterCount = Object.values(filter).filter((v) => v !== "").length;

  const updateFilter = (updates: Partial<LeadFilter>) => {
    const newFilter = { ...filter, ...updates };
    setFilter(newFilter);
    onFilterChange(newFilter);
  };

  const clearFilters = () => {
    setFilter(defaultFilter);
    onFilterChange(defaultFilter);
  };

  const saveFilter = () => {
    if (!filterName.trim()) {
      toast.error("Please enter a filter name");
      return;
    }

    const newSavedFilter: SavedFilter = {
      id: Date.now().toString(),
      name: filterName.trim(),
      filter: { ...filter },
    };

    const updated = [...savedFilters, newSavedFilter];
    setSavedFilters(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setFilterName("");
    setShowSaveDialog(false);
    toast.success("Filter saved!");
  };

  const loadFilter = (saved: SavedFilter) => {
    setFilter(saved.filter);
    onFilterChange(saved.filter);
    setIsOpen(false);
    toast.success(`Loaded filter: ${saved.name}`);
  };

  const deleteFilter = (id: string) => {
    const updated = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Filter deleted");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="font-medium text-sm text-foreground">Filter Leads</div>

            {/* Job Type */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Job Type</Label>
              <Select
                value={filter.jobType}
                onValueChange={(value) => updateFilter({ jobType: value === "all" ? "" : value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All job types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All job types</SelectItem>
                  {jobTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Postcode Area */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Postcode Area</Label>
              <Input
                placeholder="e.g., SW, E1, M"
                value={filter.postcodeArea}
                onChange={(e) => updateFilter({ postcodeArea: e.target.value.toUpperCase() })}
                className="h-9"
              />
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">From Date</Label>
                <Input
                  type="date"
                  value={filter.dateFrom}
                  onChange={(e) => updateFilter({ dateFrom: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">To Date</Label>
                <Input
                  type="date"
                  value={filter.dateTo}
                  onChange={(e) => updateFilter({ dateTo: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>

            {/* Saved Filters */}
            {savedFilters.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs text-muted-foreground">Saved Filters</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {savedFilters.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <button
                        onClick={() => loadFilter(saved)}
                        className="text-sm text-foreground hover:text-secondary text-left flex-1"
                      >
                        {saved.name}
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteFilter(saved.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className="gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </Button>
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activeFilterCount === 0}
                    className="gap-1 ml-auto"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Save Filter</DialogTitle>
                    <DialogDescription>
                      Give this filter a name to quickly apply it later.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Filter name"
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                    />
                    <Button onClick={saveFilter} className="w-full">
                      Save Filter
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {filter.jobType && (
        <Badge variant="secondary" className="gap-1">
          {filter.jobType}
          <button onClick={() => updateFilter({ jobType: "" })}>
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
      {filter.postcodeArea && (
        <Badge variant="secondary" className="gap-1">
          {filter.postcodeArea}
          <button onClick={() => updateFilter({ postcodeArea: "" })}>
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
      {(filter.dateFrom || filter.dateTo) && (
        <Badge variant="secondary" className="gap-1">
          {filter.dateFrom && filter.dateTo
            ? `${filter.dateFrom} - ${filter.dateTo}`
            : filter.dateFrom
            ? `From ${filter.dateFrom}`
            : `To ${filter.dateTo}`}
          <button onClick={() => updateFilter({ dateFrom: "", dateTo: "" })}>
            <X className="w-3 h-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
