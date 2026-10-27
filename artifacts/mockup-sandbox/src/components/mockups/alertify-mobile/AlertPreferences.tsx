import { useState } from "react";
import { Check, Home, Route, SlidersHorizontal, ShieldCheck } from "lucide-react";
import "./_group.css";
import { BrandHeader } from "./_shared/Brand";

type Sensitivity = "Urgent only" | "Significant" | "All relevant changes";
const choices: Sensitivity[] = ["Urgent only", "Significant", "All relevant changes"];

function PreferenceGroup({ title, detail, icon, value, onChange, name }: {
  title: string;
  detail: string;
  icon: "home" | "trip";
  value: Sensitivity;
  onChange: (value: Sensitivity) => void;
  name: string;
}) {
  const Icon = icon === "home" ? Home : Route;
  return (
    <section className="rounded-[19px] border border-[#d8e1d9] bg-[#fffefa] p-4 shadow-[0_6px_20px_rgba(37,59,65,.05)]">
      <div className="flex items-center gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-[13px] ${icon === "home" ? "bg-[#e4eee9] text-[#477e70]" : "bg-[#e6edf2] text-[#4b83a5]"}`}><Icon size={19} /></div>
        <div><h2 className="text-[13px] font-extrabold text-[#29434b]">{title}</h2><p className="mt-0.5 text-[9px] text-[#81908f]">{detail}</p></div>
        <span className="ml-auto rounded-full bg-[#eff3ef] px-2 py-1 text-[8px] font-bold uppercase tracking-[.08em] text-[#718187]">Independent</span>
      </div>
      <div className="mt-4 space-y-2" role="radiogroup" aria-label={`${title} sensitivity`}>
        {choices.map((choice, index) => {
          const selected = value === choice;
          const descriptions = ["Only urgent official warnings and major changes.", "Prioritise important nearby updates and warnings.", "Include relevant local conditions and smaller changes."];
          return (
            <button key={choice} type="button" role="radio" aria-checked={selected} name={name} onClick={() => onChange(choice)} className={`flex min-h-[55px] w-full items-center gap-3 rounded-[14px] border px-3 text-left transition active:scale-[.99] ${selected ? "border-[#4389ad] bg-[#eaf2f4] ring-1 ring-[#4389ad]/20" : "border-[#e3e9e2] bg-[#fffefa] hover:bg-[#f8faf6]"}`}>
              <span aria-hidden="true" className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border ${selected ? "border-[#287bb6] bg-[#287bb6] text-white" : "border-[#aebdb8] bg-white"}`}>{selected && <Check size={12} strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1"><span className={`block text-[11px] font-bold ${selected ? "text-[#315e70]" : "text-[#344b53]"}`}>{choice}</span><span className="mt-0.5 block text-[9px] leading-4 text-[#81908f]">{descriptions[index]}</span></span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 rounded-[11px] bg-[#f1f5f0] px-3 py-2 text-[9px] leading-4 text-[#6c8280]"><span className="font-bold text-[#477e70]">Selected:</span> {value}</p>
    </section>
  );
}

export function AlertPreferences() {
  const [homeSensitivity, setHomeSensitivity] = useState<Sensitivity>("Significant");
  const [tripSensitivity, setTripSensitivity] = useState<Sensitivity>("Significant");
  const [message, setMessage] = useState("");

  const save = () => setMessage(`Preferences saved — Home: ${homeSensitivity}; Trip: ${tripSensitivity}.`);

  return (
    <main className="alertify-screen relative mx-auto min-h-[844px] w-full max-w-[390px] overflow-hidden bg-[#f2f4ed] text-[#1c303d]">
      <div className="bg-[#1b2b37] px-5 pb-3 pt-2">
        <div className="flex h-5 items-center justify-between text-[11px] font-bold text-[#f3f4ed]">
          <span>9:41</span><span className="alertify-mono text-[9px] tracking-[.12em] text-[#aab8bd]">ALERT PREFERENCES</span>
          <span className="h-2.5 w-4 rounded-[3px] border border-[#d4e0e2] p-[1px]"><span className="block h-full w-3/4 rounded-[1px] bg-[#63c39a]" /></span>
        </div>
        <BrandHeader back />
      </div>
      <div className="px-5 pb-8 pt-5">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#478172]"><SlidersHorizontal size={15} /> Your alerts, your pace</div>
        <h1 className="mt-2 text-[25px] font-bold leading-[1.12] tracking-[-.05em] text-[#1e3541]">Choose what reaches you.</h1>
        <p className="mt-2 text-[12px] leading-[1.55] text-[#718187]">Set the level of change you want to hear about. Home and Trip work independently.</p>

        <div className="mt-5 space-y-4">
          <PreferenceGroup title="Home Watch" detail="Updates around your saved home" icon="home" name="home-sensitivity" value={homeSensitivity} onChange={setHomeSensitivity} />
          <PreferenceGroup title="Trip Watch" detail="Updates along your planned trip" icon="trip" name="trip-sensitivity" value={tripSensitivity} onChange={setTripSensitivity} />
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-[15px] bg-[#e5eeea] p-3.5">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#538a77]" />
          <p className="text-[9px] leading-[1.55] text-[#6c8280]">Alertify adds context to public information. These preferences don’t change official warnings or emergency advice.</p>
        </div>
        <button type="button" onClick={save} className="mt-5 flex h-[51px] w-full items-center justify-center gap-2 rounded-[15px] bg-[#287bb6] text-[13px] font-bold text-white shadow-[0_6px_15px_rgba(40,123,182,.2)] transition hover:bg-[#226ea8] active:scale-[.98]">
          Save preferences <Check size={16} />
        </button>
      </div>
      {message && <button type="button" role="status" onClick={() => setMessage("")} className="fixed bottom-4 left-1/2 z-10 w-[calc(100%-32px)] max-w-[358px] -translate-x-1/2 rounded-xl bg-[#203644] px-4 py-3 text-left text-[12px] font-medium text-white shadow-lg">{message}<span className="ml-2 text-[#95cbee]">Dismiss</span></button>}
    </main>
  );
}
