import { useState } from "react";
import { ArrowRight, Check, ChevronDown, Clock3, MapPin, Route, Shield, SlidersHorizontal } from "lucide-react";
import "./_group.css";
import { BrandHeader } from "./_shared/Brand";

type AppChoice = "Google Maps" | "Waze";
type Sensitivity = "Essential" | "Balanced" | "More alerts";

export function TripHandoff() {
  const [app, setApp] = useState<AppChoice>("Google Maps");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("Balanced");
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <main className="alertify-screen relative mx-auto min-h-[844px] w-full max-w-[390px] overflow-hidden bg-[#f2f4ed] text-[#1c303d]">
      <div className="bg-[#1b2b37] px-5 pb-3 pt-2">
        <div className="flex h-5 items-center justify-between text-[11px] font-bold text-[#f3f4ed]"><span>9:41</span><span className="alertify-mono text-[9px] tracking-[.12em] text-[#aab8bd]">TRIP WATCH</span><span className="h-2.5 w-4 rounded-[3px] border border-[#d4e0e2] p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-[#63c39a]" /></span></div>
        <BrandHeader back />
      </div>
      <div className="px-5 pb-6 pt-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#478172]"><Route size={15} /> Before you go</div>
        <h1 className="mt-2 text-[25px] font-bold leading-[1.12] tracking-[-.05em] text-[#1e3541]">A quick check along your route.</h1>
        <p className="mt-2 max-w-[310px] text-[12px] leading-[1.55] text-[#718187]">We’ll monitor relevant conditions. Choose a navigation app when you’re ready.</p>

        <section className="mt-5 overflow-hidden rounded-[20px] border border-[#d8e1d9] bg-[#fffefa] shadow-[0_6px_20px_rgba(37,59,65,.05)]">
          <div className="alertify-map-grid relative h-[153px] overflow-hidden">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 350 153" preserveAspectRatio="none" aria-label="Route map preview">
              <path d="M38 129 C70 114 75 93 117 95 S157 57 187 64 S222 33 252 37 S298 18 332 17" fill="none" stroke="#f9fbf4" strokeWidth="12" />
              <path d="M38 129 C70 114 75 93 117 95 S157 57 187 64 S222 33 252 37 S298 18 332 17" fill="none" stroke="#3785af" strokeWidth="4" strokeLinecap="round" />
              <path d="M4 46 C64 57 70 43 112 29 S182 21 209 -2" fill="none" stroke="#fff" strokeWidth="7" />
              <path d="M4 46 C64 57 70 43 112 29 S182 21 209 -2" fill="none" stroke="#a6b9ae" strokeWidth="1.5" />
              <circle cx="118" cy="95" r="8" fill="#e6a34f" stroke="#fff" strokeWidth="3" />
            </svg>
            <div className="absolute left-[7%] top-[70%] grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#2c7bb0] text-white shadow"><MapPin size={13} fill="currentColor" /></div>
            <div className="absolute right-[4%] top-[5%] grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#3b9274] text-white shadow"><span className="text-[11px] font-bold">B</span></div>
            <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[9px] font-bold text-[#3c5963] shadow">VIA M4</span>
            <span className="absolute bottom-3 right-3 rounded-lg bg-[#fff8e9] px-2.5 py-1.5 text-[9px] font-bold text-[#93662e] shadow">1 CONDITION NEAR ROUTE</span>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center"><span className="h-2.5 w-2.5 rounded-full border-[2px] border-[#2c7bb0] bg-white" /><span className="my-1 h-6 border-l border-dashed border-[#b6c5bf]" /><span className="h-2.5 w-2.5 rounded-full bg-[#3b9274]" /></div>
              <div className="min-w-0 flex-1 space-y-3">
                <div><div className="text-[12px] font-bold text-[#2a424c]">Newtown, Sydney</div><div className="mt-0.5 text-[9px] text-[#8b9796]">Starting point</div></div>
                <div><div className="text-[12px] font-bold text-[#2a424c]">Blue Mountains, NSW</div><div className="mt-0.5 text-[9px] text-[#8b9796]">Destination</div></div>
              </div>
              <div className="self-center rounded-[12px] bg-[#e7f0ed] px-2.5 py-2 text-center"><div className="flex items-center gap-1 text-[12px] font-bold text-[#315e5b]"><Clock3 size={13} />1h 31m</div><div className="mt-1 text-[9px] text-[#7d918e]">approx. 102 km</div></div>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between"><h2 className="text-[13px] font-bold text-[#203441]">Route conditions</h2><span className="text-[9px] text-[#81908f]">As at 9:38 am</span></div>
          <div className="mt-2.5 flex items-start gap-3 rounded-[16px] border border-[#ead9bc] bg-[#fff8e9] p-3.5">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-[#f4e7cf] text-[#b07b3d]"><span className="text-[16px] font-bold">!</span></div>
            <div className="flex-1"><div className="text-[11px] font-bold text-[#655037]">Heavy rain advisory</div><div className="mt-1 text-[10px] leading-4 text-[#7f7058]">Forecast rain near Lapstone, 7 km from route. No road closure reported.</div></div>
            <ChevronDown size={15} className="mt-1 text-[#98774a]" />
          </div>
        </section>
        <section className="mt-5">
          <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-[#488276]" /><h2 className="text-[13px] font-bold text-[#203441]">Trip alert sensitivity</h2></div>
          <div className="mt-2 grid grid-cols-3 rounded-[13px] bg-[#e2e9e3] p-1">
            {(["Essential", "Balanced", "More alerts"] as Sensitivity[]).map((option) => <button key={option} onClick={() => setSensitivity(option)} className={`min-h-[39px] rounded-[10px] px-1 text-[10px] font-bold transition ${sensitivity === option ? "bg-[#fffefa] text-[#2d625b] shadow-[0_2px_6px_rgba(37,59,65,.08)]" : "text-[#748582] hover:text-[#365b5a]"}`}>{option}</button>)}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-[#84918f]">{sensitivity === "Essential" ? "Only urgent official warnings and major closures." : sensitivity === "Balanced" ? "Urgent warnings plus relevant conditions near your route." : "More nearby weather and incident updates as you travel."}</p>
        </section>
        <section className="mt-5">
          <h2 className="mb-2.5 text-[13px] font-bold text-[#203441]">Continue with</h2>
          <div className="grid grid-cols-2 gap-2.5">
            {(["Google Maps", "Waze"] as AppChoice[]).map((option) => <button key={option} onClick={() => setApp(option)} className={`flex h-[48px] items-center gap-2.5 rounded-[14px] border px-3 text-left transition active:scale-[.98] ${app === option ? "border-[#4389ad] bg-[#e8f1f4] ring-1 ring-[#4389ad]/30" : "border-[#d8e1d9] bg-[#fffefa]"}`}>
              <span className={`grid h-7 w-7 place-items-center rounded-[9px] text-[11px] font-extrabold ${option === "Google Maps" ? "bg-[#e2ece8] text-[#42816e]" : "bg-[#eef0d9] text-[#828a38]"}`}>{option === "Google Maps" ? "G" : "W"}</span>
              <span className="flex-1 text-[11px] font-bold text-[#344b53]">{option}</span>{app === option && <Check size={15} className="text-[#287bb6]" />}
            </button>)}
          </div>
        </section>
        <button onClick={() => setRemember(!remember)} role="checkbox" aria-checked={remember} className="mt-4 flex w-full items-center gap-2.5 text-left">
          <span className={`grid h-[18px] w-[18px] place-items-center rounded-[5px] border transition ${remember ? "border-[#287bb6] bg-[#287bb6] text-white" : "border-[#aebdb8] bg-[#fffefa]"}`}>{remember && <Check size={12} />}</span>
          <span className="text-[10px] text-[#687b7d]">Remember {app} for next time</span>
        </button>
        <button onClick={() => setMessage(`Ready to hand off to ${app}${remember ? " — preference saved" : ""}. Alertify will keep monitoring, but won’t navigate.`)} className="mt-4 flex h-[51px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#287bb6] text-[13px] font-bold text-white shadow-[0_6px_15px_rgba(40,123,182,.2)] transition hover:bg-[#226ea8] active:scale-[.98]">
          Open {app} <ArrowRight size={17} />
        </button>
        <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[9px] text-[#879290]"><Shield size={12} className="text-[#538a77]" />Alertify monitors risk; your chosen app handles navigation.</div>
      </div>
      {message && <button onClick={() => setMessage("")} className="absolute bottom-4 left-4 right-4 rounded-xl bg-[#203644] px-4 py-3 text-left text-[12px] font-medium text-white shadow-lg">{message}<span className="ml-2 text-[#95cbee]">Dismiss</span></button>}
    </main>
  );
}
