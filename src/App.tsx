import {
  AddCircleIcon,
  BuildingIcon,
  CameraIcon,
  KeyIcon,
  LogoMark,
  MicIcon,
  SendIcon,
  TagIcon,
} from "./components/icons";

type Suggestion = {
  icon: React.ReactNode;
  text: string;
};

const suggestions: Suggestion[] = [
  { icon: <BuildingIcon className="size-3" />, text: "I want to buy a 4BHK under $500K in Austin, safe and schools nearby" },
  { icon: <KeyIcon className="size-3" />, text: "Rent a 1-bedroom near downtown" },
  { icon: <BuildingIcon className="size-3" />, text: "Book a cozy Airbnb in Miami" },
  { icon: <TagIcon className="size-3" />, text: "I want to list my apartment in San Diego for short-term stays and maximize bookings." },
];

function SuggestionPill({ icon, text }: Suggestion) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-[#67a0ff] bg-white/60 px-3 py-2 text-[11px] leading-tight text-[#010028]/80">
      <span className="shrink-0 text-[#183eeb]">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-[#e4e9f2] flex items-center justify-center py-10 px-4">
      <div className="relative w-full max-w-[400px] rounded-[36px] bg-[#f0f3f8] px-6 pb-8 pt-10 shadow-[0_20px_60px_rgba(16,24,64,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-center gap-3">
          <div
            className="flex size-[52px] shrink-0 items-center justify-center rounded-full shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
            style={{ backgroundImage: "linear-gradient(140deg, #67A0FF 0%, #183EEB 92%)" }}
          >
            <LogoMark className="size-7" />
          </div>
          <div className="text-left">
            <p className="text-lg font-semibold text-[#010028]">Doorvisor</p>
            <p className="text-xs text-[#010028]/40">Your AI Assistant</p>
          </div>
        </div>

        {/* Greeting bubble */}
        <div className="mt-4 flex justify-center">
          <div className="max-w-[220px] rounded-tr-[20px] rounded-bl-[20px] rounded-br-[20px] bg-white px-4 py-3 text-center text-xs font-medium leading-4 text-[#010028] shadow-sm">
            <p>Hi Vibha,</p>
            <p>Turn Your Property Search into a Smarter Experience!</p>
          </div>
        </div>

        {/* Hero image */}
        <div className="mt-5 h-[220px] w-full overflow-hidden rounded-[20px] bg-[#c9d6ea]">
          <img
            src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
            alt="Modern home with pool"
            className="size-full object-cover"
          />
        </div>

        {/* Chat input */}
        <div className="mt-5 flex items-center justify-between rounded-full bg-white p-3 shadow-[0_4px_20px_rgba(16,24,64,0.08)]">
          <div className="flex flex-1 items-center gap-1.5">
            <AddCircleIcon className="size-6 shrink-0" />
            <span className="truncate text-xs font-light text-[#010028]/40">Ask about your Real Estate Needs...</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 pl-2">
            <CameraIcon className="size-5" />
            <MicIcon className="size-5" />
            <SendIcon className="size-8" />
          </div>
        </div>

        {/* Suggestions */}
        <p className="mt-5 text-center text-xs text-[#010028]/80">Not sure where to start? Try one of these:</p>
        <div className="mt-3 flex flex-col gap-2">
          <SuggestionPill {...suggestions[0]} />
          <div className="flex gap-2">
            <SuggestionPill {...suggestions[1]} />
            <SuggestionPill {...suggestions[2]} />
          </div>
          <SuggestionPill {...suggestions[3]} />
        </div>
      </div>
    </div>
  );
}

export default App;
