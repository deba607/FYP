"use client";

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, RotateCcw, Ticket, ChevronUp, ChevronDown, CalendarDays, Plus, Minus, Users } from 'lucide-react';
import { createBooking, resetChatSession, sendChatMessage, createRazorpayOrder, verifyRazorpayPayment } from '../../lib/api';
import { encodeRtdbKey } from '../../lib/utils/firebaseKey';
import { translate } from '../../lib/i18n';
import { useLanguage } from '../../hooks/use-language';

type ChatMessage = {
  from: 'user' | 'bot';
  text: string;
  timestamp: string;
  museumOptions?: MuseumOption[];
  genericOptions?: GenericOption[];
  bookMuseumName?: string;
  showDatePicker?: boolean;
  showVisitorPicker?: boolean;
};

type MuseumOption = {
  label: string;
  value: string;
};

type GenericOption = {
  label: string;
  value: string;
};

type BookingData = {
  date?: string;
  time_slot?: string;
  tickets?: number;
  visitor_type?: string;
  visitor_combo?: Record<string, number>;
  primary_visitor_type?: 'Adult' | 'Child' | 'Senior Citizen' | 'Student' | 'Professor' | 'Researcher/Scientist';
  visitor_combo_remaining?: number;
  ready_to_confirm?: boolean;
  museumName?: string;
  museumLocation?: string;
  museumCategory?: string;
  museumId?: string;
  pricePerTicket?: number;
};

const CHAT_SESSION_KEY = 'bharat_museum_chat_session_id';
const AUTH_USER_KEY = 'museum_auth_user';

function makeSessionId() {
  return `web-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function getStableSessionIdFromLogin() {
  if (typeof window === 'undefined') return '';

  try {
    const raw = window.localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return '';

    const parsed = JSON.parse(raw) as { id?: string; email?: string };
    const userId = parsed?.id?.trim();
    const email = parsed?.email?.trim();

    if (userId) {
      return encodeRtdbKey(`user_${userId}`);
    }

    if (email) {
      return encodeRtdbKey(`email_${email.toLowerCase()}`);
    }

    return '';
  } catch {
    return '';
  }
}

function extractMuseumOptions(text: string) {
  return text
    .split('\n')
    .map((line) => line.match(/^\s*\d+\.\s+(.+?)\s*$/)?.[1]?.trim())
    .filter((name): name is string => Boolean(name))
    .map((name) => ({
      label: name,
      value: name
    }));
}

function extractGenericOptions(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const match = trimmed.match(/^\d+\.\s+(.+)$/);
      if (!match) return null;
      const label = match[1].trim();
      let value = label;
      if (label.includes('(')) {
        value = label.split('(')[0].trim();
      }
      return { label, value };
    })
    .filter((opt): opt is { label: string; value: string } => Boolean(opt));
}

function cleanMessageText(text: string) {
  return text
    .split('\n')
    .filter((line) => !line.trim().match(/^\d+\.\s+/))
    .join('\n')
    .trim();
}

function shouldShowDatePicker(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('when would you like to visit') ||
    lower.includes('please select a date') ||
    lower.includes('what date would you like') ||
    (lower.includes('book tickets') && lower.includes('date'))
  );
}

function shouldShowVisitorPicker(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('how many tickets would you like') ||
    lower.includes('ticket(s) left to assign') ||
    lower.includes('how many tickets for each visitor') ||
    lower.includes('please specify a number between 1 and')
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type CalendarCell = {
  day: number;
  month: number; // 0-indexed
  year: number;
  isCurrentMonth: boolean;
};

function buildCalendarGrid(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: CalendarCell[] = [];

  // Trailing days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    cells.push({ day: prevMonthDays - i, month: prevM, year: prevY, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, month, year, isCurrentMonth: true });
  }

  // Trailing days from next month (fill up to 6 rows = 42 cells)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    const nextM = month === 11 ? 0 : month + 1;
    const nextY = month === 11 ? year + 1 : year;
    cells.push({ day: d, month: nextM, year: nextY, isCurrentMonth: false });
  }

  return cells;
}

function InlineDatePicker({ onSelectDate, disabled }: { onSelectDate: (date: string) => void; disabled: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const alreadySent = useRef(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const cells = buildCalendarGrid(viewYear, viewMonth);

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const toDateStr = (cell: CalendarCell) =>
    `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;

  const toDisplayStr = (cell: CalendarCell) =>
    `${String(cell.day).padStart(2, '0')}-${String(cell.month + 1).padStart(2, '0')}-${cell.year}`;

  const handleSelect = (cell: CalendarCell) => {
    const d = new Date(cell.year, cell.month, cell.day);
    d.setHours(0, 0, 0, 0);
    if (d < today) return;

    const dateStr = toDateStr(cell);
    setSelected(dateStr);
    setInputValue(toDisplayStr(cell));

    if (!alreadySent.current) {
      alreadySent.current = true;
      onSelectDate(dateStr);
    }
  };

  const handleClear = () => {
    setSelected(null);
    setInputValue('');
    alreadySent.current = false;
  };

  const handleToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    const cell: CalendarCell = {
      day: today.getDate(),
      month: today.getMonth(),
      year: today.getFullYear(),
      isCurrentMonth: true
    };
    handleSelect(cell);
  };

  const isCellToday = (cell: CalendarCell) =>
    cell.year === today.getFullYear() && cell.month === today.getMonth() && cell.day === today.getDate();

  const isCellSelected = (cell: CalendarCell) => toDateStr(cell) === selected;

  const isCellDisabled = (cell: CalendarCell) => {
    const d = new Date(cell.year, cell.month, cell.day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };

  // Build dropdown options: 6 months before + current + 5 months after = 12 items
  const dropdownMonths: { month: number; year: number; label: string; isPast: boolean }[] = [];
  for (let offset = -6; offset <= 5; offset++) {
    let m = today.getMonth() + offset;
    let y = today.getFullYear();
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    const isPast = y < today.getFullYear() || (y === today.getFullYear() && m < today.getMonth());
    dropdownMonths.push({ month: m, year: y, label: `${MONTH_NAMES[m]}, ${y}`, isPast });
  }

  const selectDropdownMonth = (m: number, y: number) => {
    setViewMonth(m);
    setViewYear(y);
    setShowDropdown(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  return (
    <div className="mt-3 w-full max-w-[280px]" data-bmt-no-translate>
      {/* Calendar card */}
      <div
        style={{
          background: '#1a1a2e',
          border: '1px solid #2a2a3e',
          borderRadius: '8px',
          padding: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#e0e0e0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header: Month, Year ▾  ↑ ↓ */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', position: 'relative' }} ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowDropdown((v) => !v)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
              padding: '2px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {MONTH_NAMES[viewMonth]}, {viewYear} <span style={{ fontSize: '10px', opacity: 0.6, transition: 'transform 0.2s', transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </button>

          {/* Month dropdown */}
          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 50,
                marginTop: '4px',
                background: '#16162a',
                border: '1px solid #2a2a3e',
                borderRadius: '6px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                maxHeight: '200px',
                overflowY: 'auto',
                width: '180px',
              }}
            >
              {dropdownMonths.map((item) => {
                const isActive = item.month === viewMonth && item.year === viewYear;
                return (
                  <button
                    key={`${item.month}-${item.year}`}
                    type="button"
                    onClick={() => selectDropdownMonth(item.month, item.year)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? '#60a5fa' : item.isPast ? '#555566' : '#ccccdd',
                      background: isActive ? '#1e1e3a' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.target as HTMLButtonElement).style.background = '#22223a';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.target as HTMLButtonElement).style.background = 'transparent';
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: '2px' }}>
            <button
              type="button"
              onClick={prevMonth}
              disabled={disabled || !canGoPrev}
              style={{
                background: 'transparent',
                border: 'none',
                color: canGoPrev ? '#f0a030' : '#555',
                cursor: canGoPrev && !disabled ? 'pointer' : 'default',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Previous month"
            >
              <ChevronUp style={{ width: '16px', height: '16px' }} />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              disabled={disabled}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f0a030',
                cursor: disabled ? 'default' : 'pointer',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
              }}
              aria-label="Next month"
            >
              <ChevronDown style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
        </div>

        {/* Day header row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', marginBottom: '4px' }}>
          {DAY_NAMES.map((dn) => (
            <div
              key={dn}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#8888aa',
                padding: '4px 0',
              }}
            >
              {dn}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center' }}>
          {cells.map((cell, idx) => {
            const cellDisabled = isCellDisabled(cell);
            const cellToday = isCellToday(cell);
            const cellSelected = isCellSelected(cell);

            let bg = 'transparent';
            let color = cell.isCurrentMonth ? '#e0e0e0' : '#555566';
            let fontWeight = '400';
            let border = 'none';

            if (cellSelected) {
              bg = '#1565c0';
              color = '#ffffff';
              fontWeight = '700';
            } else if (cellToday) {
              bg = '#1976d2';
              color = '#ffffff';
              fontWeight = '700';
            }

            if (cellDisabled && !cellToday) {
              color = cell.isCurrentMonth ? '#555566' : '#333344';
            }

            return (
              <button
                key={`${cell.month}-${cell.day}-${idx}`}
                type="button"
                disabled={disabled || cellDisabled}
                onClick={() => handleSelect(cell)}
                style={{
                  background: bg,
                  color,
                  fontWeight,
                  border,
                  borderRadius: '4px',
                  padding: '6px 0',
                  fontSize: '13px',
                  cursor: cellDisabled || disabled ? 'default' : 'pointer',
                  margin: '1px',
                  transition: 'background 0.15s',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!cellDisabled && !disabled && !cellToday && !cellSelected) {
                    (e.target as HTMLButtonElement).style.background = '#2a2a4e';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!cellDisabled && !disabled && !cellToday && !cellSelected) {
                    (e.target as HTMLButtonElement).style.background = 'transparent';
                  }
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        {/* Footer: Clear / Today */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #2a2a3e' }}>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6699cc',
              fontSize: '12px',
              cursor: disabled ? 'default' : 'pointer',
              padding: '2px 4px',
              fontWeight: 500,
            }}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleToday}
            disabled={disabled}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6699cc',
              fontSize: '12px',
              cursor: disabled ? 'default' : 'pointer',
              padding: '2px 4px',
              fontWeight: 500,
            }}
          >
            Today
          </button>
        </div>
      </div>

      {/* Date input field below */}
      <div
        style={{
          marginTop: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: '#1a1a2e',
          border: '1px solid #2a2a3e',
          borderRadius: '6px',
          padding: '8px 10px',
        }}
      >
        <CalendarDays style={{ width: '14px', height: '14px', color: '#8888aa', flexShrink: 0 }} />
        <input
          type="text"
          readOnly
          value={inputValue}
          placeholder="dd-mm-yyyy"
          style={{
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: inputValue ? '#e0e0e0' : '#555566',
            fontSize: '13px',
            width: '100%',
            fontFamily: 'monospace',
          }}
        />
      </div>
    </div>
  );
}

const VISITOR_CATEGORIES = [
  { name: 'Adult', price: 200, emoji: '👨' },
  { name: 'Child', price: 100, emoji: '👶' },
  { name: 'Senior Citizen', price: 150, emoji: '👴' },
  { name: 'Student', price: 120, emoji: '🎓' },
  { name: 'Professor', price: 180, emoji: '📚' },
  { name: 'Researcher/Scientist', price: 180, emoji: '🔬' },
];
const MAX_TICKETS = 6;

function InlineVisitorPicker({ onConfirm, disabled }: { onConfirm: (combo: Record<string, number>) => void; disabled: boolean }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirmed, setConfirmed] = useState(false);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalPrice = VISITOR_CATEGORIES.reduce((sum, cat) => sum + (counts[cat.name] || 0) * cat.price, 0);

  const increment = (name: string) => {
    if (total >= MAX_TICKETS) return;
    setCounts((prev) => ({ ...prev, [name]: (prev[name] || 0) + 1 }));
  };

  const decrement = (name: string) => {
    setCounts((prev) => {
      const curr = prev[name] || 0;
      if (curr <= 0) return prev;
      const next = { ...prev, [name]: curr - 1 };
      if (next[name] === 0) delete next[name];
      return next;
    });
  };

  const handleConfirm = () => {
    if (total === 0 || confirmed) return;
    setConfirmed(true);
    onConfirm(counts);
  };

  return (
    <div className="mt-3 w-full max-w-[300px]" data-bmt-no-translate>
      <div
        style={{
          background: '#1a1a2e',
          border: '1px solid #2a2a3e',
          borderRadius: '8px',
          padding: '14px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#e0e0e0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #2a2a3e' }}>
          <Users style={{ width: '16px', height: '16px', color: '#60a5fa' }} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>Select Visitors</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#8888aa' }}>
            {total}/{MAX_TICKETS} tickets
          </span>
        </div>

        {/* Category rows */}
        {VISITOR_CATEGORIES.map((cat) => {
          const count = counts[cat.name] || 0;
          const canAdd = total < MAX_TICKETS;
          return (
            <div
              key={cat.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #1e1e35',
              }}
            >
              {/* Label + price */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: count > 0 ? '#e0e0e0' : '#8888aa', fontWeight: count > 0 ? 600 : 400 }}>
                  {cat.emoji} {cat.name}
                </div>
                <div style={{ fontSize: '10px', color: '#666688' }}>₹{cat.price}/ticket</div>
              </div>

              {/* +/- controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                <button
                  type="button"
                  onClick={() => decrement(cat.name)}
                  disabled={disabled || confirmed || count === 0}
                  style={{
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: count > 0 ? '#2a2a4e' : '#1e1e35',
                    border: '1px solid #3a3a5e',
                    borderRadius: '6px 0 0 6px',
                    color: count > 0 ? '#ff6b6b' : '#444',
                    cursor: count > 0 && !disabled && !confirmed ? 'pointer' : 'default',
                    fontSize: '14px',
                    fontWeight: 700,
                    transition: 'all 0.15s',
                  }}
                >
                  <Minus style={{ width: '12px', height: '12px' }} />
                </button>
                <div
                  style={{
                    width: '32px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#16162a',
                    borderTop: '1px solid #3a3a5e',
                    borderBottom: '1px solid #3a3a5e',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: count > 0 ? '#ffffff' : '#555',
                  }}
                >
                  {count}
                </div>
                <button
                  type="button"
                  onClick={() => increment(cat.name)}
                  disabled={disabled || confirmed || !canAdd}
                  style={{
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: canAdd ? '#2a2a4e' : '#1e1e35',
                    border: '1px solid #3a3a5e',
                    borderRadius: '0 6px 6px 0',
                    color: canAdd && !confirmed ? '#60a5fa' : '#444',
                    cursor: canAdd && !disabled && !confirmed ? 'pointer' : 'default',
                    fontSize: '14px',
                    fontWeight: 700,
                    transition: 'all 0.15s',
                  }}
                >
                  <Plus style={{ width: '12px', height: '12px' }} />
                </button>
              </div>
            </div>
          );
        })}

        {/* Total + Confirm */}
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #2a2a3e' }}>
          {total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '12px' }}>
              <span style={{ color: '#8888aa' }}>Total: {total} ticket{total > 1 ? 's' : ''}</span>
              <span style={{ color: '#f0a030', fontWeight: 600 }}>₹{totalPrice}</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={disabled || confirmed || total === 0}
            style={{
              width: '100%',
              padding: '9px',
              borderRadius: '6px',
              border: 'none',
              background: total > 0 && !confirmed ? '#1976d2' : '#2a2a3e',
              color: total > 0 && !confirmed ? '#ffffff' : '#555',
              fontSize: '13px',
              fontWeight: 600,
              cursor: total > 0 && !disabled && !confirmed ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
          >
            {confirmed ? '✓ Confirmed' : total === 0 ? 'Select at least 1 visitor' : `Confirm ${total} Ticket${total > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}



function toApiTimeSlot(timeSlot?: string) {
  if (!timeSlot) {
    return 'Morning (9 AM-12 PM)' as const;
  }

  if (timeSlot.includes('4:00 PM')) {
    return 'Evening (3 PM-6 PM)' as const;
  }

  if (timeSlot.includes('12:00 PM') || timeSlot.includes('2:00 PM')) {
    return 'Afternoon (12 PM-3 PM)' as const;
  }

  return 'Morning (9 AM-12 PM)' as const;
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }

    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BookingWithChatBot() {
  const { language } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [bookingData, setBookingData] = useState<BookingData>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, sending]);

  const canConfirm = useMemo(() => {
    const hasVisitorInfo = Boolean(
      bookingData.visitor_type ||
      (bookingData.visitor_combo && Object.values(bookingData.visitor_combo).some((v) => v > 0))
    );
    return Boolean(
      bookingData.ready_to_confirm &&
        bookingData.date &&
        bookingData.time_slot &&
        bookingData.tickets &&
        hasVisitorInfo
    );
  }, [bookingData]);

  useEffect(() => {
    const generated = encodeRtdbKey(makeSessionId());
    window.sessionStorage.setItem(CHAT_SESSION_KEY, generated);
    setSessionId(generated);
  }, []);

  // Initialize welcome message when session is ready.
  useEffect(() => {
    if (!sessionId) return;

    setMessages([
      {
        from: 'bot',
        text: translate(language, 'chat.welcome'),
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
  }, [language, sessionId]);

  const sendMessage = async (displayText: string, apiText = displayText) => {
    if (!displayText.trim() || !sessionId) return;

    const msg = {
      from: 'user' as const,
      text: displayText.trim(),
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages((m) => [...m, msg]);
    setInput('');
    setSending(true);

    try {
      const response = await sendChatMessage(apiText.trim(), sessionId, language);
      const isSearchMuseums = response.intent === 'search_museums';
      const museumOptions = isSearchMuseums
        ? extractMuseumOptions(response.response || '')
        : [];
      const genericOptions = !isSearchMuseums
        ? extractGenericOptions(response.response || '')
        : [];
      const fullResponseText = response.response || '';
      const datePickerNeeded = shouldShowDatePicker(fullResponseText);
      const visitorPickerNeeded = !datePickerNeeded && shouldShowVisitorPicker(fullResponseText);
      const reply = {
        from: 'bot' as const,
        text: datePickerNeeded || visitorPickerNeeded
          ? cleanMessageText(fullResponseText) || translate(language, 'chat.noResponse')
          : cleanMessageText(fullResponseText || translate(language, 'chat.noResponse')),
        timestamp: new Date().toLocaleTimeString(),
        museumOptions: museumOptions.length > 0 ? museumOptions : undefined,
        genericOptions: (!datePickerNeeded && !visitorPickerNeeded && genericOptions.length > 0) ? genericOptions : undefined,
        showDatePicker: datePickerNeeded || undefined,
        showVisitorPicker: visitorPickerNeeded || undefined
      };

      setMessages((m) => [...m, reply]);

      if (response.booking_data) {
        setBookingData((prev) => ({ ...prev, ...(response.booking_data as BookingData) }));
      }
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          from: 'bot',
          text: (error as Error).message || translate(language, 'chat.serviceUnavailable'),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    await sendMessage(input.trim());
  };

  const chooseMuseum = (museumName: string) => {
    if (sending || confirming) return;

    setMessages((prev) => [
      ...prev,
      {
        from: 'user',
        text: museumName,
        timestamp: new Date().toLocaleTimeString()
      },
      {
        from: 'bot',
        text: museumName,
        timestamp: new Date().toLocaleTimeString(),
        bookMuseumName: museumName
      }
    ]);
  };

  const bookMuseumTickets = async (museumName: string) => {
    await sendMessage('Book Tickets', `Book tickets for ${museumName}`);
  };

  const sendVisitorCombo = async (combo: Record<string, number>) => {
    const total = Object.values(combo).reduce((a, b) => a + b, 0);
    if (total === 0 || !sessionId) return;

    // Build user-facing summary
    const parts = Object.entries(combo)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${count}× ${type}`);

    setMessages((prev) => [
      ...prev,
      { from: 'user', text: parts.join(', '), timestamp: new Date().toLocaleTimeString() }
    ]);
    setSending(true);

    try {
      // Step 1: send total ticket count
      let lastResponse = await sendChatMessage(String(total), sessionId, language);
      if (lastResponse.booking_data) {
        setBookingData((prev) => ({ ...prev, ...(lastResponse.booking_data as BookingData) }));
      }

      // Step 2: send each visitor category
      for (const [type, count] of Object.entries(combo)) {
        if (count > 0) {
          lastResponse = await sendChatMessage(`${count} ${type}`, sessionId, language);
          if (lastResponse.booking_data) {
            setBookingData((prev) => ({ ...prev, ...(lastResponse.booking_data as BookingData) }));
          }
        }
      }

      // Show only the final bot response
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: cleanMessageText(lastResponse.response || translate(language, 'chat.noResponse')),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: (error as Error).message || translate(language, 'chat.serviceUnavailable'),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setSending(false);
    }
  };

  const reset = async () => {
    if (!sessionId) return;

    try {
      await resetChatSession(sessionId);
    } catch {
      // Keep client reset functional even if server reset fails.
    }

    const nextSession = makeSessionId();
    window.sessionStorage.setItem(CHAT_SESSION_KEY, nextSession);
    setSessionId(nextSession);
    setBookingData({});
    setName('');
    setEmail('');
    setPhone('');
    setMessages([
      {
          from: 'bot',
          text: translate(language, 'chat.newSession'),
          timestamp: new Date().toLocaleTimeString()
        }
    ]);
  };

  const confirmBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canConfirm) {
      return;
    }

    if (!name.trim() || !email.trim() || !phone.trim()) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: translate(language, 'chat.nameRequired'),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      return;
    }

    try {
      setConfirming(true);
      const totalAmount = Object.entries(bookingData.visitor_combo || {}).reduce((sum, [type, count]) => {
        const price = (type === 'Child' ? 100 : type === 'Senior Citizen' ? 150 : type === 'Student' ? 120 : type === 'Professor' || type === 'Researcher/Scientist' ? 180 : 200);
        return sum + price * count;
      }, 0) || Number(bookingData.tickets || 1) * (bookingData.pricePerTicket || (bookingData as any).price || 200);

      const bookingPayload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        visitDate: bookingData.date!,
        timeSlot: toApiTimeSlot(bookingData.time_slot),
        numberOfTickets: Number(bookingData.tickets),
        visitorType: bookingData.visitor_type || 'Adult',
        visitorCombo: bookingData.visitor_combo || undefined,
        museumName: bookingData.museumName || (bookingData as any).museum_name || undefined,
        museumLocation: bookingData.museumLocation || (bookingData as any).museum_location || undefined,
        museumCategory: bookingData.museumCategory || (bookingData as any).museum_category || undefined,
        museumId: bookingData.museumId || (bookingData as any).museum_id || undefined,
        pricePerTicket: totalAmount / (Number(bookingData.tickets) || 1),
        totalPrice: totalAmount
      };

      const orderResponse = await createRazorpayOrder(bookingPayload);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay checkout. Please try again.');
      }

      const RazorpayCheckout = (window as any).Razorpay;
      if (!RazorpayCheckout) {
        throw new Error('Payment gateway is unavailable. Please refresh and try again.');
      }

      const payment = new RazorpayCheckout({
        key: orderResponse.keyId,
        amount: orderResponse.order.amount,
        currency: orderResponse.order.currency,
        name: 'Bharat Museum Tickets',
        description: `${bookingPayload.museumName || 'Museum'} ticket booking`,
        order_id: orderResponse.order.id,
        prefill: {
          name: name.trim(),
          email: email.trim(),
          contact: phone.trim()
        },
        notes: {
          museumName: bookingPayload.museumName || '',
          museumLocation: bookingPayload.museumLocation || '',
          museumCategory: bookingPayload.museumCategory || '',
          visitorType: bookingPayload.visitorType,
          numberOfTickets: String(bookingPayload.numberOfTickets)
        },
        theme: {
          color: '#111827'
        },
        modal: {
          ondismiss: () => {
            setConfirming(false);
          }
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setConfirming(true);
            const verified = await verifyRazorpayPayment({
              booking: bookingPayload,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            });

            setMessages((prev) => [
              ...prev,
              {
                from: 'bot',
                text: translate(language, 'chat.bookingConfirmed', {
                  bookingId: verified.booking.bookingId,
                  email: email.trim()
                }),
                timestamp: new Date().toLocaleTimeString()
              }
            ]);

            try {
              const mod = await import('canvas-confetti');
              const confetti = (mod && (mod.default || mod)) as any;
              confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            } catch {
              // ignore if confetti isn't available
            }

            setBookingData((prev) => ({ ...prev, ready_to_confirm: false }));
            setName('');
            setEmail('');
            setPhone('');
          } catch (paymentError) {
            setMessages((prev) => [
              ...prev,
              {
                from: 'bot',
                text: (paymentError as Error).message || 'Payment verification failed. Please contact support.',
                timestamp: new Date().toLocaleTimeString()
              }
            ]);
          } finally {
            setConfirming(false);
          }
        }
      });

      payment.open();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          from: 'bot',
          text: (error as Error).message || translate(language, 'chat.confirmFailed'),
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
      setConfirming(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <aside className="rounded-lg border bg-background p-4">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle />
          <h4 className="text-lg font-medium">{translate(language, 'chat.title')}</h4>
          <button
            type="button"
            className="ml-auto rounded border px-2 py-1 text-xs"
            onClick={reset}
            disabled={sending || confirming}
          >
            <span className="inline-flex items-center gap-1">
              <RotateCcw className="h-3 w-3" />
              {translate(language, 'chat.reset')}
            </span>
          </button>
        </div>

        <div ref={chatContainerRef} className="mb-3 h-105 overflow-auto rounded border p-3">
          {messages.map((m, i) => (
            <div key={i} className={`mb-2 max-w-[85%] ${m.from === 'bot' ? 'text-sm text-muted-foreground' : 'ml-auto text-right'}`}>
              <div className={`inline-block whitespace-pre-line rounded px-3 py-1 ${m.from === 'bot' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                {m.text}
              </div>
              {m.museumOptions && (
                <div className="mt-2 w-full max-w-xs">
                  <select
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        chooseMuseum(e.target.value);
                      }
                    }}
                    disabled={sending || confirming}
                  >
                    <option value="" disabled>Select a museum...</option>
                    {m.museumOptions.map((museum) => (
                      <option key={museum.value} value={museum.value}>
                        {museum.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {m.genericOptions && (
                <div className="mt-2 w-full max-w-xs">
                  <select
                    className="w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        sendMessage(e.target.value);
                      }
                    }}
                    disabled={sending || confirming}
                  >
                    <option value="" disabled>Select an option...</option>
                    {m.genericOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {m.bookMuseumName && (
                <div className="mt-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
                    onClick={() => bookMuseumTickets(m.bookMuseumName!)}
                    disabled={sending || confirming}
                  >
                    <Ticket className="h-3.5 w-3.5" />
                    Book Tickets
                  </button>
                </div>
              )}
              {m.showDatePicker && (
                <InlineDatePicker
                  disabled={sending || confirming}
                  onSelectDate={(dateStr) => {
                    sendMessage(dateStr);
                  }}
                />
              )}
              {m.showVisitorPicker && (
                <InlineVisitorPicker
                  disabled={sending || confirming}
                  onConfirm={(combo) => {
                    sendVisitorCombo(combo);
                  }}
                />
              )}
              <div className="mt-1 text-[10px] opacity-60">{m.timestamp}</div>
            </div>
          ))}
          {sending && <div className="text-xs text-muted-foreground">{translate(language, 'chat.typing')}</div>}
        </div>

        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && send()}
            placeholder={translate(language, 'chat.placeholder')}
            className="flex-1 rounded border px-3 py-2"
            disabled={sending}
          />
          <button onClick={send} className="rounded bg-primary px-4 py-2 text-primary-foreground" disabled={sending}>
            {sending ? translate(language, 'chat.sending') : translate(language, 'chat.send')}
          </button>
        </div>

        {canConfirm && (
          <form onSubmit={confirmBooking} className="mt-4 rounded border p-3">
            <h5 className="mb-3 text-sm font-semibold">{translate(language, 'chat.confirmDetails')}</h5>
            <div className="mb-2 grid gap-2 md:grid-cols-2">
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder={translate(language, 'booking.fullName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={confirming}
              />
              <input
                className="rounded border px-3 py-2 text-sm"
                placeholder={translate(language, 'booking.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={confirming}
              />
            </div>
            <input
              className="mb-3 w-full rounded border px-3 py-2 text-sm"
              placeholder={translate(language, 'booking.phone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={confirming}
            />

            <div className="mb-3 rounded bg-muted p-2 text-xs" data-bmt-no-translate>
              <div>{translate(language, 'booking.date')}: {bookingData.date}</div>
              <div>{translate(language, 'booking.time')}: {bookingData.time_slot}</div>
              <div>{translate(language, 'booking.ticketCount')}: {bookingData.tickets}</div>
              {bookingData.visitor_combo && Object.keys(bookingData.visitor_combo).length > 0 ? (
                <div>
                  <div className="mt-1 font-semibold">{translate(language, 'booking.visitorCategory')}:</div>
                  {Object.entries(bookingData.visitor_combo).map(([vtype, count]) => (
                    count > 0 ? (
                      <div key={vtype} className="ml-2">{count}× {vtype}</div>
                    ) : null
                  ))}
                </div>
              ) : (
                <div>{translate(language, 'booking.visitorCategory')}: {bookingData.visitor_type}</div>
              )}
            </div>

            <button
              type="submit"
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
              disabled={confirming}
            >
              {confirming ? translate(language, 'chat.confirming') : translate(language, 'chat.confirm')}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}


