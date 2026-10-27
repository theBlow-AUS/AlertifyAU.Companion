import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, ExternalLink, Map, MapPin, Share2, ShieldAlert, TriangleAlert } from "lucide-react";
import "./_group.css";
import { BrandHeader } from "./_shared/Brand";

export function IncidentDetail() {
  const [feedback, setFeedback] = useState("");
  return (
    <main className="alertify-screen relative mx-auto min-h-[844px] w-full max-w-[390px] overflow-hidden bg-[#f2f4ed] text-[#1c303d]">
      <div className="bg-[#1b2b37] px-5 pb-3 pt-2">
        <div className="flex h-5 items-center justify-between text-[11px] font-bold text-[#f3f4ed]"><span>9:41</span><span className="alertify-mono text-[9px] tracking-[.12em] text-[#aab8bd]">ALERT DETAILS</span><span className="h-2.5 w-4 rounded-[3px] border border-[#d4e0e2] p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-[#63c39a]" /></span></div>
        <BrandHeader back />
      </div>
      <div className="relative h-[190px] overflow-hidden">
        <div className="alertify-map-grid absolute inset-0" />
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 190" preserveAspectRatio="none" aria-label="Map showing incident location and your home">
          <path d="M-10 139 C55 114 80 133 134 88 S236 82 278 36 S348 24 406 7" fill="none" stroke="#f8faf1" strokeWidth="12" />
          <path d="M-10 139 C55 114 80 133 134 88 S236 82 278 36 S348 24 406 7" fill="none" stroke="#92aaa0" strokeWidth="2" />
          <path d="M68 202 C87 151 129 125 155 95 S214 49 227 -10" fill="none" stroke="#f8faf1" strokeWidth="8" />
          <path d="M68 202 C87 151 129 125 155 95 S214 49 227 -10" fill="none" stroke="#aabdb3" strokeWidth="1.5" />
          <path d="M220 105 C252 71 294 77 320 52 S369 39 390 52" fill="none" stroke="#d89c50" strokeWidth="2" strokeDasharray="5 5" />
        </svg>
        <div className="absolute left-[63%] top-[27%] grid h-[54px] w-[54px] place-items-center rounded-full border border-[#df786b]/40 bg-[#e97567]/20"><span className="absolute h-8 w-8 rounded-full bg-[#e97567]/25" /><span className="relative grid h-7 w-7 place-items-center rounded-full bg-[#d9574f] text-white shadow-md"><TriangleAlert size={14} /></span></div>
        <div className="absolute left-[32%] top-[66%] grid h-8 w-8 place-items-center rounded-full border-[3px] border-white bg-[#3179ae] text-white shadow-md"><MapPin size={15} fill="currentColor" /></div>
        <span className="absolute left-[25%] top-[87%] rounded-md bg-white/90 px-2 py-1 text-[9px] font-bold text-[#35515a] shadow">YOUR HOME</span>
        <span className="absolute left-[60%] top-[13%] rounded-md bg-[#fff8e9] px-2 py-1 text-[9px] font-bold text-[#9a622b] shadow">INCIDENT</span>
        <button onClick={() => setFeedback("Map view opened for this incident.")} className="absolute bottom-3 right-4 flex items-center gap-1.5 rounded-full bg-[#203644] px-3 py-2 text-[10px] font-bold text-white shadow"><Map size={13} /> Open map</button>
      </div>
      <div className="space-y-4 px-5 pb-7 pt-4">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#dc9b44]" /><span className="text-[10px] font-bold uppercase tracking-[.15em] text-[#a16e32]">Nearby incident · Monitor</span><span className="ml-auto text-[10px] text-[#84918e]">Updated 8:42 am</span></div>
        <div><h1 className="text-[24px] font-bold leading-[1.12] tracking-[-.045em] text-[#1e3541]">Vegetation fire reported</h1><p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#6f8186]"><MapPin size={14} /> Camperdown · 3.8 km from home</p></div>

        <section className="rounded-[18px] border border-[#ead9bc] bg-[#fff8e9] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#f5e8ce] text-[#ad7837]"><ShieldAlert size={18} /></div>
            <div><h2 className="text-[12px] font-extrabold text-[#624d31]">Alertify proximity context</h2><p className="mt-1.5 text-[11px] leading-[1.55] text-[#76674f]">This report is within your selected area. It is a nearby incident, not an instruction to evacuate.</p></div>
          </div>
        </section>
        <section className="rounded-[18px] border border-[#dbe2d9] bg-[#fffefa] p-4">
          <div className="flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#78888b]">Official warning status</span><span className="rounded-full bg-[#e4efe9] px-2.5 py-1 text-[9px] font-bold text-[#477b63]">NO WARNING FOUND</span></div>
          <p className="mt-2 text-[11px] leading-[1.55] text-[#65777d]">No active NSW RFS warning is listed for this location at the time of this update.</p>
          <button onClick={() => setFeedback("Opening NSW RFS official incident information.")} className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-[#287bb6]">Check NSW RFS source <ExternalLink size={12} /></button>
        </section>
        <section>
          <h2 className="mb-2 text-[13px] font-bold text-[#203441]">What changed</h2>
          <div className="rounded-[16px] bg-[#e8eeea] p-3.5">
            <div className="flex gap-3"><span className="mt-1 h-2 w-2 rounded-full bg-[#cf7952]" /><div><p className="text-[11px] font-bold text-[#354e54]">New report received</p><p className="mt-1 text-[10px] leading-4 text-[#718187]">A vegetation fire was reported near Parramatta Road. Alertify added it because it falls within your Home Watch radius.</p></div></div>
          </div>
        </section>
        <div className="flex gap-2.5">
          <button onClick={() => setFeedback("Share options opened.")} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] border border-[#cbd8d8] bg-[#fffefa] text-[12px] font-bold text-[#355461] transition active:scale-[.98]"><Share2 size={16} /> Share</button>
          <button onClick={() => setFeedback("Official sources are shown above.")} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-[#287bb6] text-[12px] font-bold text-white shadow-[0_5px_12px_rgba(40,123,182,.18)] transition active:scale-[.98]">Official source <ArrowUpRight size={15} /></button>
        </div>
        <div className="flex items-start gap-2 px-1 text-[9px] leading-4 text-[#83908e]"><Check size={12} className="mt-0.5 shrink-0 text-[#478b75]" />Alertify adds location context to public information. Always follow official emergency advice.</div>
      </div>
      {feedback && <button onClick={() => setFeedback("")} className="absolute bottom-4 left-4 right-4 rounded-xl bg-[#203644] px-4 py-3 text-left text-[12px] font-medium text-white shadow-lg">{feedback}<span className="ml-2 text-[#95cbee]">Dismiss</span></button>}
    </main>
  );
}
