import { useState } from "react";
import { Check, ChevronDown, Crosshair, MapPin, ShieldCheck, BellRing, Info } from "lucide-react";
import "./_group.css";
import { BrandHeader } from "./_shared/Brand";

type PermissionState = "not-asked" | "granted" | "declined";

export function HomeSetup() {
  const [home, setHome] = useState("18 Wattle Street, Newtown");
  const [radius, setRadius] = useState(10);
  const [permission, setPermission] = useState<PermissionState>("not-asked");
  const [saved, setSaved] = useState(false);
  const [feedback, setFeedback] = useState("");

  const setMockPermission = (state: Exclude<PermissionState, "not-asked">) => {
    setPermission(state);
    setSaved(false);
  };

  const saveSetup = () => {
    setSaved(true);
    setFeedback(`Home Watch saved for ${home.split(",")[0]} within ${radius} km.`);
  };

  return (
    <main className="alertify-screen relative mx-auto min-h-[844px] w-full max-w-[390px] overflow-hidden bg-[#f2f4ed] pb-6 text-[#1c303d]">
      <div className="bg-[#1b2b37] px-5 pb-3 pt-2">
        <div className="flex h-5 items-center justify-between text-[11px] font-bold text-[#f3f4ed]">
          <span>9:41</span><span className="alertify-mono text-[9px] tracking-[.12em] text-[#aab8bd]">HOME WATCH SETUP</span>
          <span className="h-2.5 w-4 rounded-[3px] border border-[#d4e0e2] p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-[#63c39a]" /></span>
        </div>
        <BrandHeader back />
      </div>

      <div className="px-5 pb-8 pt-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#478172]"><ShieldCheck size={15} /> A little more local context</div>
        <h1 className="mt-2 text-[25px] font-bold leading-[1.12] tracking-[-.05em] text-[#1e3541]">Set up Home Watch.</h1>
        <p className="mt-2 text-[12px] leading-[1.55] text-[#718187]">We’ll keep an eye on relevant public updates around your saved home.</p>

        <section className="mt-5 rounded-[19px] border border-[#d8e1d9] bg-[#fffefa] p-4 shadow-[0_6px_20px_rgba(37,59,65,.05)]">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#e4eee9] text-[#477e70]"><Crosshair size={18} /></div>
            <div><h2 className="text-[12px] font-extrabold text-[#29434b]">What Home Watch monitors</h2>
              <p className="mt-1.5 text-[10px] leading-[1.55] text-[#718187]">Nearby official warnings, reported incidents and relevant weather changes. Alertify adds distance and local context; it does not replace emergency advice.</p>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-2.5 text-[13px] font-bold text-[#203441]">Choose a saved home</h2>
          <label className="sr-only" htmlFor="home-location">Saved home location</label>
          <div className="relative">
            <MapPin size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#548276]" />
            <select id="home-location" value={home} onChange={(event) => { setHome(event.target.value); setSaved(false); }} className="h-[53px] w-full appearance-none rounded-[15px] border border-[#d8e1d9] bg-[#fffefa] pl-11 pr-10 text-[12px] font-bold text-[#344b53] outline-none focus:border-[#4389ad] focus:ring-2 focus:ring-[#4389ad]/20">
              <option value="18 Wattle Street, Newtown">18 Wattle Street · Newtown, NSW</option>
              <option value="7 Banksia Avenue, Katoomba">7 Banksia Avenue · Katoomba, NSW</option>
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#748582]" />
          </div>
        </section>

        <section className="mt-5">
          <div className="flex items-end justify-between"><h2 className="text-[13px] font-bold text-[#203441]">How far around home?</h2><span className="text-[10px] font-semibold text-[#718187]">Radius</span></div>
          <div className="mt-2.5 grid grid-cols-3 gap-2" role="group" aria-label="Home Watch radius">
            {[5, 10, 20].map((value) => (
              <button key={value} type="button" aria-pressed={radius === value} onClick={() => { setRadius(value); setSaved(false); }} className={`h-[43px] rounded-[13px] border text-[11px] font-bold transition active:scale-[.98] ${radius === value ? "border-[#4389ad] bg-[#e8f1f4] text-[#315e70] ring-1 ring-[#4389ad]/25" : "border-[#d8e1d9] bg-[#fffefa] text-[#718187]"}`}>
                {value} km
              </button>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-[#84918f]">A wider area may include updates further from your address.</p>
        </section>

        <section className="mt-5 rounded-[18px] bg-[#e5eeea] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[#d0e3dc] text-[#397967]"><BellRing size={18} /></div>
            <div><h2 className="text-[12px] font-extrabold text-[#294b48]">Why notifications help</h2>
              <p className="mt-1 text-[10px] leading-[1.55] text-[#6c8280]">A timely heads-up can help you check the latest official information when conditions change nearby.</p>
            </div>
          </div>
          <div className="mt-3 rounded-[13px] border border-[#cbded5] bg-[#f8fbf6] p-3">
            <div className="flex items-start gap-2.5">
              <Info size={15} className="mt-0.5 shrink-0 text-[#588a7b]" />
              <p className="text-[9px] leading-[1.5] text-[#6e817d]">This is a prototype permission step. Choosing allow or not now only changes this screen; it does not request device permission.</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={permission === "granted"} onClick={() => setMockPermission("granted")} className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-[12px] px-2 text-[10px] font-bold transition active:scale-[.98] ${permission === "granted" ? "bg-[#315e58] text-white" : "bg-[#28424d] text-white"}`}>
                {permission === "granted" && <Check size={14} />} Allow in prototype
              </button>
              <button type="button" aria-pressed={permission === "declined"} onClick={() => setMockPermission("declined")} className={`min-h-[40px] rounded-[12px] border px-2 text-[10px] font-bold transition active:scale-[.98] ${permission === "declined" ? "border-[#ad8754] bg-[#fff6e7] text-[#805f35]" : "border-[#cbd8d8] bg-[#fffefa] text-[#526870]"}`}>
                Not now
              </button>
            </div>
            {permission !== "not-asked" && <div role="status" className={`mt-2 text-center text-[10px] font-semibold ${permission === "granted" ? "text-[#397967]" : "text-[#8b765a]"}`}>
              {permission === "granted" ? "Mock state: allowed in this prototype." : "Mock state: not now. You can continue without alerts."}
            </div>}
          </div>
        </section>

        <button type="button" onClick={saveSetup} className="mt-5 flex h-[51px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#287bb6] text-[13px] font-bold text-white shadow-[0_6px_15px_rgba(40,123,182,.2)] transition hover:bg-[#226ea8] active:scale-[.98]">
          {saved ? "Saved · Continue" : "Save and continue"} <Check size={16} />
        </button>
        <p className="mt-3 flex items-start justify-center gap-1.5 px-1 text-center text-[9px] leading-4 text-[#879290]"><ShieldCheck size={12} className="mt-0.5 shrink-0 text-[#538a77]" />Always follow official emergency guidance. Alertify provides awareness, not instructions.</p>
      </div>
      {feedback && <button type="button" role="status" onClick={() => setFeedback("")} className="fixed bottom-4 left-1/2 z-10 w-[calc(100%-32px)] max-w-[358px] -translate-x-1/2 rounded-xl bg-[#203644] px-4 py-3 text-left text-[12px] font-medium text-white shadow-lg">{feedback}<span className="ml-2 text-[#95cbee]">Dismiss</span></button>}
    </main>
  );
}
