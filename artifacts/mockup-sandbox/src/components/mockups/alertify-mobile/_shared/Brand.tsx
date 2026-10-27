import { ArrowLeft, Bell, ChevronRight, ShieldCheck } from "lucide-react";

export function FlameMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-label="Alertify mark" role="img">
      <path d="M20 2 38 35.5 20 42 2 35.5 20 2Z" fill="#E64D4B" />
      <path d="M22.6 12.2c1.2 5.1-4.5 6.1-4.5 10.2 0 1.5.8 2.7 2.1 3.4-.4-2.2 1.2-3.6 3-4.7 3.1 3.3 3.7 5.2 2.6 7.6-1.1 2.4-3.5 3.6-6.1 3.6-4.3 0-7.2-3-7.2-7 0-3.7 2.3-6.8 5.4-9.9.4 2.6-.4 4-1.2 5.2 4.4-2.1 6.6-5.2 5.9-8.4Z" fill="#FFF0E8" />
    </svg>
  );
}

export function BrandHeader({ back = false }: { back?: boolean }) {
  return (
    <header className="flex h-[58px] items-center justify-between">
      <div className="flex items-center gap-2.5">
        {back ? <button aria-label="Go back" className="mr-1 grid h-9 w-9 place-items-center rounded-full bg-[#263847] text-[#e8f1f2]"><ArrowLeft size={19} /></button> : <FlameMark />}
        <div className="leading-none">
          <div className="text-[16px] font-extrabold tracking-[-.04em] text-[#f6f4ec]">alertify</div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[.19em] text-[#9aabb2]">AWARENESS, NOT ALARM</div>
        </div>
      </div>
      <button aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full bg-[#263847] text-[#d4e0e2] transition active:scale-95">
        <Bell size={18} />
        <span className="absolute right-[9px] top-[8px] h-1.5 w-1.5 rounded-full bg-[#e34d4b]" />
      </button>
    </header>
  );
}

export function BottomNav({ active = "Home" }: { active?: string }) {
  const items = ["Home", "Trips", "Updates"];
  return (
    <nav className="absolute inset-x-0 bottom-0 flex h-[76px] items-center justify-around border-t border-[#304552] bg-[#1b2b37]/95 px-5 backdrop-blur">
      {items.map((item, index) => (
        <button key={item} className={`flex min-w-[72px] flex-col items-center gap-1.5 text-[10px] font-semibold transition ${active === item ? "text-[#72b9ed]" : "text-[#91a1a9]"}`}>
          {index === 0 ? <ShieldCheck size={19} /> : index === 1 ? <span className="text-[17px] leading-[19px]">↗</span> : <Bell size={18} />}
          {item}
        </button>
      ))}
    </nav>
  );
}

export function SectionHeading({ children, action }: { children: string; action?: string }) {
  return <div className="mb-3 flex items-center justify-between"><h2 className="text-[14px] font-bold tracking-[-.02em] text-[#203441]">{children}</h2>{action && <button className="flex items-center gap-1 text-[11px] font-bold text-[#287bb6]">{action}<ChevronRight size={14} /></button>}</div>;
}

export function StatusDot({ color = "#46a981" }: { color?: string }) {
  return <span className="relative flex h-2.5 w-2.5 items-center justify-center"><span style={{ backgroundColor: color }} className="absolute h-2.5 w-2.5 rounded-full opacity-25 alertify-pulse" /><span style={{ backgroundColor: color }} className="relative h-1.5 w-1.5 rounded-full" /></span>;
}
