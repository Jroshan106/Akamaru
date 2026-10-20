import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './ThemedSelect.css';

type Props = {
  value: string | number;
  onChange: (event: { target: { value: string } }) => void;
  children: ReactNode;
  disabled?: boolean;
  'aria-label'?: string;
};

/** Single-select listbox; focus stays on the trigger for keyboard navigation. */
export default function ThemedSelect({ value, onChange, children, disabled, 'aria-label': label }: Props) {
  const options = Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children: ReactNode; disabled?: boolean }>(child)) return [];
    const text = Children.toArray(child.props.children).join('');
    return [{ value: String(child.props.value ?? text), label: child.props.children, text, disabled: child.props.disabled }];
  });
  const selected = options.findIndex(option => option.value === String(value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0, maxHeight: 280, above: false });
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const id = useId();
  function show() { setActive(selected >= 0 ? selected : Math.max(0, options.findIndex(o => !o.disabled))); setOpen(true); }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange({ target: { value: option.value } });
    setOpen(false);
    trigger.current?.focus();
  }
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 16;
      const above = below < Math.min(280, options.length * 44 + 16) && rect.top > below;
      const maxHeight = Math.max(60, Math.min(280, above ? rect.top - 16 : below));
      const width = Math.min(Math.max(rect.width, 190), window.innerWidth - 24);
      setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: above ? rect.top - 6 : rect.bottom + 6, width, maxHeight, above });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, options.length]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    const close = () => setOpen(false);
    document.addEventListener('fullscreenchange', close);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('fullscreenchange', close); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (open) menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  function keyboard(event: KeyboardEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (event.key === 'Tab') { setOpen(false); return; }
    if (event.key === 'Escape') { if (open) { event.preventDefault(); event.stopPropagation(); setOpen(false); } return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open ? choose(active) : show(); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(); return; }
      const enabled = options.map((o, i) => o.disabled ? -1 : i).filter(i => i >= 0);
      if (!enabled.length) return;
      const index = enabled.indexOf(active);
      setActive(event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled[enabled.length - 1] : enabled[Math.max(0, Math.min(enabled.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + event.key.toLowerCase(), at: now };
      const match = options.findIndex(o => !o.disabled && o.text.toLowerCase().startsWith(typed.current.text));
      if (match >= 0) { setOpen(true); setActive(match); }
    }
  }
  return <>
    <button ref={trigger} type="button" className={`themed-select ${open ? 'is-open' : ''}`} role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined} disabled={disabled || !options.length} onClick={() => open ? setOpen(false) : show()} onKeyDown={keyboard} onBlur={e => { if (!menu.current?.contains(e.relatedTarget as Node)) setOpen(false); }}>
      <span>{options[selected]?.label ?? 'Choose an option'}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className={`themed-select-menu ${position.above ? 'opens-above' : ''}`} style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }} onPointerDown={e => e.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} data-index={index} role="option" aria-selected={index === selected} aria-disabled={option.disabled || undefined} className={`themed-select-option ${index === active ? 'is-active' : ''}`} onClick={() => choose(index)} onPointerMove={() => !option.disabled && setActive(index)}><span>{option.label}</span>{index === selected && <Check size={16} aria-hidden="true"/>}</div>)}
    </div>, trigger.current?.closest('dialog') || document.fullscreenElement || document.body)}
  </>;
}
