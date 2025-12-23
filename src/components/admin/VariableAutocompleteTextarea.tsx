import { useState, useRef, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const AVAILABLE_VARIABLES = [
  { name: "customer_name", description: "Customer's full name" },
  { name: "customer_email", description: "Customer's email address" },
  { name: "business_name", description: "Business name" },
  { name: "contact_name", description: "Business contact name" },
  { name: "job_type", description: "Type of cleaning job" },
  { name: "postcode", description: "Full postcode" },
  { name: "postcode_area", description: "Postcode area only" },
  { name: "display_value", description: "Display price value" },
  { name: "reference_id", description: "Reference ID" },
  { name: "preferred_date", description: "Customer's preferred date" },
  { name: "lead_date", description: "Lead date" },
  { name: "current_year", description: "Current year" },
  { name: "dashboard_url", description: "Dashboard URL" },
];

interface VariableAutocompleteTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function VariableAutocompleteTextarea({
  value,
  onChange,
  placeholder,
  className,
}: VariableAutocompleteTextareaProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredVars, setFilteredVars] = useState(AVAILABLE_VARIABLES);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getCurrentWord = (text: string, position: number) => {
    const beforeCursor = text.slice(0, position);
    const match = beforeCursor.match(/\{\{(\w*)$/);
    return match ? match[1] : null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const position = e.target.selectionStart || 0;
    setCursorPosition(position);
    onChange(newValue);

    const currentWord = getCurrentWord(newValue, position);
    if (currentWord !== null) {
      const filtered = AVAILABLE_VARIABLES.filter((v) =>
        v.name.toLowerCase().includes(currentWord.toLowerCase())
      );
      setFilteredVars(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertVariable = (varName: string) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const afterCursor = value.slice(cursorPosition);
    const matchStart = beforeCursor.lastIndexOf("{{");
    
    if (matchStart !== -1) {
      const newValue =
        beforeCursor.slice(0, matchStart) +
        `{{${varName}}}` +
        afterCursor;
      onChange(newValue);
      
      // Move cursor after the inserted variable
      const newPosition = matchStart + varName.length + 4;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newPosition;
          textareaRef.current.selectionEnd = newPosition;
          textareaRef.current.focus();
        }
      }, 0);
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredVars.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev === 0 ? filteredVars.length - 1 : prev - 1
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filteredVars.length > 0) {
        e.preventDefault();
        insertVariable(filteredVars[selectedIndex].name);
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        className={cn("font-mono text-sm min-h-[300px]", className)}
      />
      {showSuggestions && filteredVars.length > 0 && (
        <div className="absolute z-50 mt-1 w-72 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredVars.map((variable, index) => (
            <button
              key={variable.name}
              type="button"
              className={cn(
                "w-full px-3 py-2 text-left hover:bg-accent flex flex-col",
                index === selectedIndex && "bg-accent"
              )}
              onClick={() => insertVariable(variable.name)}
            >
              <span className="font-mono text-sm text-primary">
                {`{{${variable.name}}}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {variable.description}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        Type {"{{" } to see available variables
      </p>
    </div>
  );
}
