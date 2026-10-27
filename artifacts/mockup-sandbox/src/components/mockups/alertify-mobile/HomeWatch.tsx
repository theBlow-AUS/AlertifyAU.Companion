import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, CloudRain, Flame, MapPin, Shield, Wind } from "lucide-react";
import "./_group.css";
import { BottomNav, BrandHeader, SectionHeading, StatusDot } from "./_shared/Brand";

export function HomeWatch() {
  const [watchOn, setWatchOn] = useState(true);
  const [notice, setNotice] = useState("");
  return (
    <main className="alertify-screen relative mx-auto min-h-[844px] w-full max-w-[390px] overflow-hidden bg-[#f2f4ed] pb-[86px] text-[#1c303d]">
      <div className="bg-[#1b2b37] px-5 pb-4 pt-2">
        <div className="flex h-5 items-center justify-between text-[11px] font-bold text-[#f3f4ed]"><span>9:41</span><span className="alertify-mono text-[9px] tracking-[.12em] text-[#aab8bd]">SYDNEY · AEST</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-[3px] border border-[#d4e0e2] p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-[#63c39a]" /></span></span></div>
        <BrandHeader />
      </div>

      <section className="relative overflow-hidden bg-[#243b49] px-5 pb-5 pt-4 text-[#f7f4ec]">
        <div className="pointer-events-none absolute -right-8 -top-16 h-48 w-48 rounded-full border border-[#4b6670]/40" />
        <div className="pointer-events-none absolute -right-1 -top-9 h-36 w-36 rounded-full border border-[#4b6670]/30" />
        <div className="relative flex items-center justify-between">
          <div><p className="text-[11px] font-bold uppercase tracking-[.15em] text-[#adc0c3]">Your saved place</p><h1 className="mt-1 text-[24px] font-bold tracking-[-.045em]">Home Watch</h1></div>
          <button onClick={() => setWatchOn(!watchOn)} aria-pressed={watchOn} className={`flex h-9 items-center gap-2 rounded-full px-3 text-[11px] font-bold transition active:scale-95 ${watchOn ? "bg-[#244f49] text-[#b7ebd1]" : "bg-[#46545a] text-[#d7dedb]"}`}>
            <StatusDot color={watchOn ? "#64d49f" : "#9ba6a7"} />{watchOn ? "ON" : "PAUSED"}
          </button>
        </div>
        <button onClick={() => setNotice("Home Watch is monitoring your saved area.")} className="relative mt-4 flex w-full items-center justify-between rounded-[18px] border border-[#425d68] bg-[#1b303c]/80 p-3.5 text-left transition active:scale-[.99]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#315044] text-[#83d9af]"><Shield size={20} /></div>
            <div><div className="text-[14px] font-bold">All clear around home</div><div className="mt-1 text-[11px] text-[#aec0c3]">No active warnings for your area</div></div>
          </div><ChevronRight size={17} className="text-[#a6bbbf]" />
        </button>
      </section>

      <div className="space-y-5 px-5 pb-7 pt-5">
        <section>
          <SectionHeading>Watching this address</SectionHeading>
          <div className="flex items-center gap-3 rounded-[18px] border border-[#dbe2d9] bg-[#fffefa] p-3.5 shadow-[0_5px_16px_rgba(38,60,68,.04)]">
            <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#e6f0ee] text-[#377a79]"><MapPin size={20} /></div>
            <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-bold">18 Wattle Street</div><div className="mt-1 text-[11px] text-[#71818a]">Newtown, NSW 2042</div></div>
            <button aria-label="Edit saved address" onClick={() => setNotice("Address settings are ready to review.")} className="rounded-full bg-[#eff3ef] px-3 py-2 text-[10px] font-bold text-[#526870]">EDIT</button>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between"><SectionHeading>Nearby conditions</SectionHeading><span className="mb-3 text-[10px] text-[#7b8c8d]">Within 10 km</span></div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-[17px] bg-[#e4eee9] p-3.5">
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#5b7670]">Fire danger</span><Flame size={17} className="text-[#d46b4b]" /></div>
              <div className="mt-2 text-[19px] font-bold tracking-[-.04em] text-[#294b48]">No rating</div><div className="mt-1 text-[10px] text-[#70857e]">No fire weather warning</div>
            </div>
            <div className="rounded-[17px] bg-[#e6edf2] p-3.5">
              <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.08em] text-[#5a7181]">Weather</span><CloudRain size={17} className="text-[#4b83a5]" /></div>
              <div className="mt-2 text-[19px] font-bold tracking-[-.04em] text-[#294353]">18° <span className="text-[12px] font-medium">Light rain</span></div><div className="mt-1 flex items-center gap-1 text-[10px] text-[#70828b]"><Wind size={11} /> Wind 14 km/h</div>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading action="See all">Recent updates</SectionHeading>
          <div className="rounded-[18px] border border-[#dbe2d9] bg-[#fffefa] px-3.5">
            <button onClick={() => setNotice("No official warning is currently active near Newtown.")} className="flex w-full items-start gap-3 border-b border-[#edf0e9] py-3.5 text-left">
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[#f8eedb] text-[#ba8540]"><Wind size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#263b46]">Strong wind conditions</span><span className="mt-1 block text-[10px] leading-4 text-[#74838a]">Sydney • Conditions eased overnight</span></span>
              <span className="pt-1 text-[9px] text-[#8b9898]">6:18 am</span>
            </button>
            <button onClick={() => setNotice("Rainfall observation is sourced from nearby weather data.")} className="flex w-full items-start gap-3 py-3.5 text-left">
              <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[#e4edf3] text-[#5284a1]"><CloudRain size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#263b46]">Rainfall recorded nearby</span><span className="mt-1 block text-[10px] leading-4 text-[#74838a]">Marrickville • 2.4 km away</span></span>
              <span className="pt-1 text-[9px] text-[#8b9898]">Yesterday</span>
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1.5 px-1 text-[9px] text-[#869391]"><Check size={12} className="text-[#419274]" />Updated 2 min ago · NSW incident feeds</div>
        </section>

        <button onClick={() => setNotice("Trip Watch helps you check conditions along a planned route.")} className="flex w-full items-center gap-3 rounded-[18px] bg-[#dfe9e6] px-4 py-3.5 text-left transition active:scale-[.99]">
          <div className="grid h-10 w-10 place-items-center rounded-[13px] bg-[#c8ded8] text-[#33786e]"><ArrowUpRight size={20} /></div>
          <div className="flex-1"><div className="text-[13px] font-bold text-[#26454a]">Heading somewhere?</div><div className="mt-1 text-[10px] text-[#6c8280]">Check conditions with Trip Watch</div></div>
          <ChevronRight size={17} className="text-[#66817c]" />
        </button>
      </div>
      {notice && <button onClick={() => setNotice("")} className="absolute bottom-[84px] left-4 right-4 rounded-xl bg-[#203644] px-4 py-3 text-left text-[12px] font-medium text-white shadow-lg">{notice} <span className="ml-2 text-[#95cbee]">Dismiss</span></button>}
      <BottomNav />
    </main>
  );
}
