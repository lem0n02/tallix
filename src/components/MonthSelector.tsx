import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { formatMonthDisplay } from '../utils/monthFilter';

export interface MonthSelectorProps {
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  availableMonths: string[];
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  onSelectMonth,
  availableMonths,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const displayLabel = formatMonthDisplay(selectedMonth);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filter by month"
        className="h-8 sm:h-9 px-2.5 sm:px-3 text-[#fafafa] hover:text-white bg-[#0c1220] sm:bg-[#18181b] border border-[#1e293b] sm:border-[#27272a] hover:border-[#3f3f46] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2 text-xs font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
      >
        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="text-[11px] sm:text-xs font-medium whitespace-nowrap truncate max-w-[110px] xs:max-w-[140px] sm:max-w-none">
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[#71717a] shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 mt-1.5 w-48 max-h-72 overflow-y-auto custom-scrollbar bg-[#0c1220] sm:bg-[#18181b] border border-[#1e293b] sm:border-[#27272a] rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-bold text-[#71717a] border-b border-[#1e293b] sm:border-[#27272a]">
            Select Period
          </div>

          <div className="py-1">
            {availableMonths.map((mKey) => {
              const isSelected = selectedMonth === mKey;
              return (
                <button
                  key={mKey}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onSelectMonth(mKey);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 sm:py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                    isSelected
                      ? 'text-emerald-400 font-semibold bg-[#27272a]/60'
                      : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] sm:hover:bg-[#27272a]/40'
                  }`}
                >
                  <span className="truncate">{formatMonthDisplay(mKey)}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#1e293b] sm:border-[#27272a] my-0.5" />

          <button
            type="button"
            role="option"
            aria-selected={selectedMonth === 'ALL'}
            onClick={() => {
              onSelectMonth('ALL');
              setIsOpen(false);
            }}
            className={`w-full text-left px-3 py-1.5 sm:py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
              selectedMonth === 'ALL'
                ? 'text-emerald-400 font-semibold bg-[#27272a]/60'
                : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] sm:hover:bg-[#27272a]/40'
            }`}
          >
            <span>All Time</span>
            {selectedMonth === 'ALL' && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
          </button>
        </div>
      )}
    </div>
  );
};
