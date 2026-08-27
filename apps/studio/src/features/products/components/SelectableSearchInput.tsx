"use client";

/**
 * SelectableSearchInput — Reusable search input with field-selector dropdown.
 *
 * Mirrors the legacy CsaSelectableSearchInput pattern:
 * - A <select> dropdown for the search field
 * - A text input for the search query
 * - Optional reset/clear button
 * - Accessible, keyboard-friendly
 *
 * Generic enough to be used by any module (Products, Customers, Tickets…).
 */

import React, { useId } from "react";
import { SearchBar, Select, Button, Icon } from "@csa/ui";

export interface SearchFieldOption {
  value: string;
  label: string;
}

export interface SelectableSearchInputProps {
  /** Current field selector value */
  fieldValue: string;
  /** Current search text value */
  searchValue: string;
  /** Options for the field dropdown */
  fieldOptions: SearchFieldOption[];
  /** Placeholder for the text input */
  placeholder?: string;
  /** Called when field selector changes */
  onFieldChange: (field: string) => void;
  /** Called when search text changes */
  onSearchChange: (text: string) => void;
  /** Called when the user submits (Enter or button) */
  onSearch: () => void;
  /** Called when the user clicks Reset */
  onReset: () => void;
  /** If true, the reset button is shown */
  showReset?: boolean;
  /** ID prefix for a11y label association */
  id?: string;
  className?: string;
}

export function SelectableSearchInput({
  fieldValue,
  searchValue,
  fieldOptions,
  placeholder = "Search...",
  onFieldChange,
  onSearchChange,
  onSearch,
  onReset,
  showReset = false,
  id: idProp,
  className = "",
}: SelectableSearchInputProps) {
  const autoId = useId();
  const rootId = idProp ?? autoId;
  const selectId = `${rootId}-field`;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearch();
    }
  };

  const handleFieldChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFieldChange(e.target.value);
  };

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="search"
      aria-label="Product search"
    >
      {/* Field selector */}
      <div className="shrink-0 min-w-[160px]">
        <label htmlFor={selectId} className="sr-only">
          Search field
        </label>
        <Select
          id={selectId}
          value={fieldValue}
          options={fieldOptions}
          onChange={handleFieldChange}
          size="md"
        />
      </div>

      {/* Text input */}
      <div className="flex-1 min-w-0">
        <SearchBar
          value={searchValue}
          onChange={onSearchChange}
          onSearch={onSearch}
          onClear={() => onSearchChange("")}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          size="md"
          aria-label={`Search by ${fieldOptions.find((o) => o.value === fieldValue)?.label ?? "all fields"}`}
        />
      </div>

      {/* Reset button */}
      {showReset && (
        <Button
          variant="ghost"
          size="md"
          onClick={onReset}
          title="Reset search and filters"
          aria-label="Reset search"
          className="shrink-0 flex items-center gap-1.5"
        >
          <Icon name="x" size="sm" />
          Reset
        </Button>
      )}
    </div>
  );
}
