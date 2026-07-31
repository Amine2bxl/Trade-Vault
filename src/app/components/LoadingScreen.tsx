import { Loader2 } from "lucide-react";

export default function LoadingScreen({ message = "Loading…" }: { message?: string }) {
  return (
    <div
      className="relative h-dvh w-full overflow-hidden flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(1000px 700px at 80% -10%, rgba(34,211,238,.08), transparent 60%), linear-gradient(160deg,#05070a 0%,#0a0f1e 55%,#05080c 100%)",
      }}
    >
      <div className="relative z-10 text-center animate-fade-in-up">
        <div className="flex items-center justify-center gap-2 mb-8 opacity-85">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-cyan-400 to-teal-400 shadow-[0_0_12px_rgba(34,211,238,.6)]" />
          <span className="text-[0.95rem] font-bold text-white tracking-tight">TradeVault</span>
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mx-auto" />
        <p className="mt-4 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}
