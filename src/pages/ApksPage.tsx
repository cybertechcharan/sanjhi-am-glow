import { Package, Clock, Sparkles } from "lucide-react";

const ApksPage = () => {
  return (
    <div className="min-h-screen pb-24 lg:pb-6 bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-2xl">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/10 flex items-center justify-center">
              <Package className="h-4.5 w-4.5 text-violet-500" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-foreground tracking-tight">APKs</h1>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Manage & download APK files</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-col items-center justify-center px-5 py-20">
        <div className="relative">
          <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 border border-violet-500/15 flex items-center justify-center">
            <Package className="h-10 w-10 text-violet-500/60" />
          </div>
          <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
        </div>

        <h2 className="text-xl font-black text-foreground mt-6 tracking-tight">Coming Soon</h2>
        <p className="text-sm text-muted-foreground text-center mt-2 max-w-xs leading-relaxed">
          APK management is under development. You'll be able to upload, manage and push APKs to devices soon.
        </p>

        <div className="flex items-center gap-2 mt-6 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/15">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <span className="text-[11px] font-bold text-violet-500">Stay tuned for updates</span>
        </div>
      </div>
    </div>
  );
};

export default ApksPage;
