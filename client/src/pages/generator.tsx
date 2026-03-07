import { useState, useCallback, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { imageGenerationConfigSchema, type ImageGenerationConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Wand2, Download, Copy, Loader2, Sparkles, ChevronDown, ChevronUp,
  Globe, Check, ArrowUp, ArrowDown, SlidersHorizontal, AlertCircle,
  Palette, Settings2, MapPin, FileText, RefreshCw, Zap, Image as ImageIcon,
  GripVertical, X, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

const INDUSTRIES = [
  "Technology / SaaS", "Cybersecurity", "Finance / Fintech", "Healthcare / Biotech",
  "Fashion / Luxury", "Food & Beverage", "Education", "Real Estate",
  "Travel & Tourism", "Sports & Fitness", "Creative / Design",
  "Music & Entertainment", "Non-profit / Social", "Automotive", "E-commerce / Retail",
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9", desc: "YouTube / LinkedIn", w: 32, h: 18 },
  { value: "9:16", label: "9:16", desc: "Story / Reel", w: 18, h: 32 },
  { value: "1:1", label: "1:1", desc: "Square", w: 24, h: 24 },
  { value: "4:5", label: "4:5", desc: "Instagram", w: 20, h: 25 },
  { value: "3:2", label: "3:2", desc: "Twitter", w: 30, h: 20 },
  { value: "2:3", label: "2:3", desc: "Pinterest", w: 20, h: 30 },
  { value: "21:9", label: "21:9", desc: "Hero Banner", w: 42, h: 18 },
];

const STYLES = [
  { value: "photorealistic", label: "Photo" },
  { value: "illustration", label: "Illustration" },
  { value: "abstract", label: "Abstract" },
  { value: "minimalist", label: "Minimal" },
  { value: "gradient", label: "Gradient" },
  { value: "editorial", label: "Editorial" },
];

const MODELS = [
  { value: "gemini-2.5-flash-image", label: "Nano Banana", badge: "Fast" },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro", badge: "Pro" },
];

const ASPECT_RATIO_CSS: Record<string, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "4:5": "aspect-[4/5]",
  "3:2": "aspect-[3/2]",
  "2:3": "aspect-[2/3]",
  "21:9": "aspect-[21/9]",
};

const PRESET_PALETTES = [
  { name: "Ocean Blue", primary: "#0A84FF", secondary: "#0B1F3B", accent: "#64D2FF" },
  { name: "Emerald", primary: "#10B981", secondary: "#064E3B", accent: "#A7F3D0" },
  { name: "Sunset", primary: "#F97316", secondary: "#1C0B00", accent: "#FDE68A" },
  { name: "Purple Rain", primary: "#8B5CF6", secondary: "#1E1030", accent: "#DDD6FE" },
  { name: "Rose Gold", primary: "#F43F5E", secondary: "#1C0510", accent: "#FECDD3" },
  { name: "Midnight", primary: "#334155", secondary: "#0F172A", accent: "#94A3B8" },
];

function intensityLabel(value: number): string {
  if (value <= 15) return "Minimal";
  if (value <= 30) return "Subtle";
  if (value <= 45) return "Light";
  if (value <= 55) return "Normal";
  if (value <= 70) return "Strong";
  if (value <= 85) return "Bold";
  return "Maximum";
}

interface GeneratedResult {
  id: number;
  imageData: string;
  mimeType: string;
  prompt: string;
  config?: ImageGenerationConfig;
  createdAt: string;
}

interface ScrapeColorInfo {
  hex: string;
  score: number;
  sources: string[];
}

interface ScrapeResult {
  eventName: string;
  industry: string;
  style: string;
  primaryColor: string;
  primaryConfidence: number;
  secondaryColor: string;
  secondaryConfidence: number;
  accentColor: string;
  accentConfidence: number;
  city: string;
  venue: string;
  theme: string;
  customPrompt: string;
  summary: string;
  screenshot?: string;
  logo?: { base64: string; mimeType: string } | null;
  allColors?: ScrapeColorInfo[];
}

type ColorRole = "primary" | "secondary" | "accent";

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  testId,
}: {
  title: string;
  icon: any;
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        data-testid={testId}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="px-3 pb-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
}

export default function GeneratorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [eventUrl, setEventUrl] = useState("");
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showColorDetails, setShowColorDetails] = useState(false);
  const [showPresets, setShowPresets] = useState(true);
  const [generatedWithModel, setGeneratedWithModel] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(true);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [logoPos, setLogoPos] = useState({ x: 16, y: 16 });
  const previewRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleLogoDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const onMove = (me: MouseEvent) => {
      if (!dragging.current || !previewRef.current) return;
      const containerRect = previewRef.current.getBoundingClientRect();
      const newX = me.clientX - containerRect.left - dragOffset.current.x;
      const newY = me.clientY - containerRect.top - dragOffset.current.y;
      setLogoPos({
        x: Math.max(0, Math.min(newX, containerRect.width - 48)),
        y: Math.max(0, Math.min(newY, containerRect.height - 48)),
      });
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const form = useForm<ImageGenerationConfig>({
    resolver: zodResolver(imageGenerationConfigSchema),
    defaultValues: {
      industry: "Technology / SaaS",
      aspectRatio: "16:9",
      style: "gradient",
      primaryColor: "#0A84FF",
      secondaryColor: "#0B1F3B",
      accentColor: "#64D2FF",
      primaryWeight: 70,
      secondaryWeight: 20,
      accentWeight: 10,
      industryIntensity: 50,
      cityIntensity: 50,
      styleIntensity: 50,
      city: "",
      venue: "",
      theme: "",
      venueIntensity: 50,
      themeIntensity: 50,
      customPrompt: "",
      model: "gemini-2.5-flash-image",
    },
  });

  const scrapeMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch("/api/scrape-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze website");
      return data as ScrapeResult;
    },
    onSuccess: (data) => {
      setScrapeResult(data);
      setScrapeError(null);
      setShowUrlInput(false);
      if (data.logo) {
        setLogoSrc(`data:${data.logo.mimeType};base64,${data.logo.base64}`);
        setShowLogo(true);
        setLogoPos({ x: 16, y: 16 });
      } else {
        setLogoSrc(null);
      }
      if (data.industry) form.setValue("industry", data.industry);
      if (data.style) form.setValue("style", data.style);
      if (data.primaryColor) form.setValue("primaryColor", data.primaryColor);
      if (data.secondaryColor) form.setValue("secondaryColor", data.secondaryColor);
      if (data.accentColor) form.setValue("accentColor", data.accentColor);
      form.setValue("city", data.city || "");
      form.setValue("venue", data.venue || "");
      form.setValue("theme", data.theme || "");
      form.setValue("customPrompt", data.customPrompt || "");
      setShowPresets(false);
      form.setValue("primaryWeight", 70);
      form.setValue("secondaryWeight", 20);
      form.setValue("accentWeight", 10);
      toast({
        title: "Website analyzed",
        description: data.eventName
          ? `Extracted details from "${data.eventName}"`
          : "Form auto-filled from website data",
      });
    },
    onError: (error: any) => {
      setScrapeError(error.message || "Check the URL and try again.");
    },
  });

  const handleScrape = () => {
    if (!eventUrl.trim()) {
      setScrapeError("Enter a URL first");
      return;
    }
    setScrapeError(null);
    scrapeMutation.mutate(eventUrl.trim());
  };

  const mutation = useMutation({
    mutationFn: async (data: ImageGenerationConfig) => {
      const res = await apiRequest("POST", "/api/generate", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setGenerationError(null);
      setGeneratedWithModel(form.getValues("model"));
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
    },
    onError: (error: any) => {
      setGenerationError(error.message || "Something went wrong. Please try again.");
    },
  });

  const onSubmit = (data: ImageGenerationConfig) => {
    setGenerationError(null);
    mutation.mutate(data);
  };

  const handleRetryGeneration = () => {
    setGenerationError(null);
    form.handleSubmit(onSubmit)();
  };

  const handleTryPro = () => {
    form.setValue("model", "gemini-3-pro-image-preview");
    setGeneratedWithModel(null);
    form.handleSubmit(onSubmit)();
  };

  const applyPalette = (palette: typeof PRESET_PALETTES[0]) => {
    form.setValue("primaryColor", palette.primary);
    form.setValue("secondaryColor", palette.secondary);
    form.setValue("accentColor", palette.accent);
  };

  const swapColors = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= colorFields.length) return;
    const currentRole = colorFields[index].role;
    const targetRole = colorFields[targetIndex].role;
    const currentColor = form.getValues(`${currentRole}Color` as keyof ImageGenerationConfig) as string;
    const targetColor = form.getValues(`${targetRole}Color` as keyof ImageGenerationConfig) as string;
    form.setValue(`${currentRole}Color` as any, targetColor);
    form.setValue(`${targetRole}Color` as any, currentColor);
  };

  const downloadImage = useCallback(() => {
    if (!result) return;
    if (!showLogo || !logoSrc || !previewRef.current) {
      const link = document.createElement("a");
      link.href = `data:${result.mimeType};base64,${result.imageData}`;
      const ratio = form.getValues("aspectRatio").replace(":", "x");
      link.download = `nanabana-${ratio}-${result.id}.png`;
      link.click();
      return;
    }
    const bgImg = new window.Image();
    bgImg.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = bgImg.width;
      canvas.height = bgImg.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bgImg, 0, 0);
      const logoImg = new window.Image();
      logoImg.onload = () => {
        const container = previewRef.current!;
        const scaleX = bgImg.width / container.clientWidth;
        const scaleY = bgImg.height / container.clientHeight;
        const logoSize = 48;
        const drawX = logoPos.x * scaleX;
        const drawY = logoPos.y * scaleY;
        const drawW = logoSize * scaleX;
        const drawH = logoSize * scaleY;
        ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          const ratio = form.getValues("aspectRatio").replace(":", "x");
          link.download = `nanabana-${ratio}-${result.id}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
        }, "image/png");
      };
      logoImg.src = logoSrc;
    };
    bgImg.src = `data:${result.mimeType};base64,${result.imageData}`;
  }, [result, form, showLogo, logoSrc, logoPos]);

  const copyPrompt = useCallback(() => {
    if (!result?.prompt) return;
    navigator.clipboard.writeText(result.prompt);
    toast({ title: "Prompt copied to clipboard" });
  }, [result, toast]);

  const selectedRatio = form.watch("aspectRatio");

  const colorFields: { role: ColorRole; label: string; colorKey: keyof ImageGenerationConfig; weightKey: keyof ImageGenerationConfig; testIdColor: string; testIdInput: string; testIdWeight: string; defaultFallback: string }[] = [
    { role: "primary", label: "Primary", colorKey: "primaryColor", weightKey: "primaryWeight", testIdColor: "color-primary", testIdInput: "input-primary-color", testIdWeight: "slider-primary-weight", defaultFallback: "#0A84FF" },
    { role: "secondary", label: "Secondary", colorKey: "secondaryColor", weightKey: "secondaryWeight", testIdColor: "color-secondary", testIdInput: "input-secondary-color", testIdWeight: "slider-secondary-weight", defaultFallback: "#000000" },
    { role: "accent", label: "Accent", colorKey: "accentColor", weightKey: "accentWeight", testIdColor: "color-accent", testIdInput: "input-accent-color", testIdWeight: "slider-accent-weight", defaultFallback: "#ffffff" },
  ];

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">

          {/* ===== PREVIEW PANEL (LEFT — HERO) ===== */}
          <div className="space-y-3 order-2 xl:order-1">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight" data-testid="text-page-title">Generate Background</h1>
                <p className="text-xs text-muted-foreground">AI-powered social media backgrounds</p>
              </div>
              {result && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadImage}
                    data-testid="button-download"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </Button>
                </div>
              )}
            </div>

            {/* Preview Area */}
            <div
              ref={previewRef}
              className={cn(
                "w-full rounded-lg border border-border overflow-hidden bg-muted/20 relative",
                ASPECT_RATIO_CSS[selectedRatio] || "aspect-video",
                "min-h-[280px]"
              )}
              data-testid="preview-area"
            >
              {mutation.isPending ? (
                <div className="absolute inset-0 skeleton-shimmer flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground/80" data-testid="text-loading">Creating your background...</p>
                    <p className="text-xs text-muted-foreground mt-1">This usually takes 15-30 seconds</p>
                  </div>
                </div>
              ) : generationError ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <div className="text-center max-w-sm space-y-3" data-testid="generation-error">
                    <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Generation failed</p>
                      <p className="text-xs text-muted-foreground mt-1">{generationError}</p>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Button size="sm" onClick={handleRetryGeneration} data-testid="button-retry-generate">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try again
                      </Button>
                      {form.getValues("model") === "gemini-2.5-flash-image" && (
                        <Button size="sm" variant="outline" onClick={handleTryPro} data-testid="button-try-pro-error">
                          <Sparkles className="h-3.5 w-3.5" />
                          Try with Pro
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ) : result ? (
                <>
                  <img
                    src={`data:${result.mimeType};base64,${result.imageData}`}
                    alt="Generated social background"
                    className="w-full h-full object-cover"
                    data-testid="img-generated"
                  />
                  {logoSrc && showLogo && (
                    <div
                      className="absolute cursor-grab active:cursor-grabbing group"
                      style={{ left: logoPos.x, top: logoPos.y }}
                      onMouseDown={handleLogoDragStart}
                      data-testid="logo-overlay"
                    >
                      <img src={logoSrc} alt="Event logo" className="w-12 h-12 object-contain rounded shadow-lg pointer-events-none" draggable={false} />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowLogo(false); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid="button-remove-logo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium" data-testid="text-empty-state">Your generated image will appear here</p>
                    <p className="text-xs mt-1 opacity-60">Start by pasting a URL or picking a style</p>
                  </div>
                </div>
              )}
            </div>

            {/* Logo Toggle (show/hide when logo available but hidden) */}
            {logoSrc && !showLogo && result && (
              <button
                type="button"
                onClick={() => setShowLogo(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                data-testid="button-show-logo"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Show logo overlay
              </button>
            )}

            {/* Pro Upsell Banner */}
            {result && generatedWithModel === "gemini-2.5-flash-image" && (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-card" data-testid="upsell-pro">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Zap className="h-3.5 w-3.5 text-amber-500" />
                  <span>Generated with Nano Banana</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 gap-1.5 text-primary hover:text-primary"
                  onClick={handleTryPro}
                  data-testid="button-try-pro"
                >
                  <Sparkles className="h-3 w-3" />
                  Try Pro for higher fidelity
                </Button>
              </div>
            )}

            {/* Prompt Reveal */}
            {result && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowPrompt(!showPrompt)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                  data-testid="button-toggle-prompt"
                >
                  {showPrompt ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  <FileText className="h-3.5 w-3.5" />
                  {showPrompt ? "Hide prompt" : "View prompt used"}
                </button>
                {showPrompt && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Prompt sent to AI</p>
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={copyPrompt} data-testid="button-copy-prompt">
                        <Copy className="h-3 w-3" />
                        Copy prompt
                      </Button>
                    </div>
                    <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground leading-relaxed font-mono max-h-40 overflow-y-auto border border-border">
                      {result.prompt}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ===== CONFIG PANEL (RIGHT — COMPACT) ===== */}
          <div className="order-1 xl:order-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">

                {/* URL Input — Quick Setup */}
                <div className="space-y-2">
                  {showUrlInput ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <p className="text-xs font-semibold">Brand or Event URL</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground -mt-1">Paste any URL to extract colors, industry, and location</p>
                      <div className="flex gap-2">
                        <Input
                          value={eventUrl}
                          onChange={(e) => { setEventUrl(e.target.value); setScrapeError(null); }}
                          placeholder="https://example.com"
                          className="text-sm flex-1 h-9"
                          data-testid="input-event-url"
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScrape(); } }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleScrape}
                          disabled={scrapeMutation.isPending}
                          className="h-9 px-3"
                          data-testid="button-scrape"
                        >
                          {scrapeMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Globe className="h-3.5 w-3.5" />
                          )}
                          {scrapeMutation.isPending ? "Extracting..." : "Extract"}
                        </Button>
                      </div>
                    </>
                  ) : scrapeResult && (
                    <button
                      type="button"
                      onClick={() => setShowUrlInput(true)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-border text-left hover:bg-muted/50 transition-colors"
                      data-testid="button-reopen-url"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-xs font-medium truncate">{scrapeResult.eventName}</span>
                      </div>
                      <Pencil className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </button>
                  )}

                  {/* Scrape Error — Inline */}
                  {scrapeError && (
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/5 border border-destructive/20" data-testid="scrape-error">
                      <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-destructive font-medium">Couldn't analyze that URL</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{scrapeError}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        onClick={handleScrape}
                        data-testid="button-retry-scrape"
                      >
                        Try again
                      </Button>
                    </div>
                  )}

                  {/* Scrape Success */}
                  {scrapeResult && !scrapeError && (
                    <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20">
                      <div className="flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 w-full">
                          <p className="text-xs font-medium" data-testid="text-event-name">{scrapeResult.eventName}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            <Badge variant="secondary" className="text-[10px] h-5" data-testid="badge-industry">{scrapeResult.industry}</Badge>
                            {scrapeResult.theme && (
                              <Badge variant="secondary" className="text-[10px] h-5" data-testid="badge-theme">{scrapeResult.theme}</Badge>
                            )}
                            {scrapeResult.city && (
                              <Badge variant="outline" className="text-[10px] h-5" data-testid="badge-city">{scrapeResult.city}</Badge>
                            )}
                            {scrapeResult.venue && (
                              <Badge variant="outline" className="text-[10px] h-5" data-testid="badge-venue">{scrapeResult.venue}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2">
                            {[scrapeResult.primaryColor, scrapeResult.secondaryColor, scrapeResult.accentColor].map((c, i) => (
                              <div key={i} className="w-5 h-5 rounded border border-border flex-shrink-0" style={{ backgroundColor: c }} data-testid={`swatch-extracted-${i}`} />
                            ))}
                            <span className="text-[10px] text-muted-foreground ml-1">Extracted palette</span>
                          </div>

                          {(scrapeResult.allColors || scrapeResult.screenshot) && (
                            <button
                              type="button"
                              onClick={() => setShowColorDetails(!showColorDetails)}
                              className="mt-1.5 text-[10px] text-primary/70 hover:text-primary flex items-center gap-1"
                              data-testid="button-toggle-color-details"
                            >
                              {showColorDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {showColorDetails ? "Hide details" : "Show analysis details"}
                            </button>
                          )}

                          {showColorDetails && (
                            <div className="mt-2 space-y-2">
                              {scrapeResult.screenshot && (
                                <div className="rounded overflow-hidden border border-border">
                                  <img src={`data:image/png;base64,${scrapeResult.screenshot}`} alt="Analyzed page" className="w-full h-auto" data-testid="img-screenshot" />
                                </div>
                              )}
                              {scrapeResult.allColors && scrapeResult.allColors.length > 0 && (
                                <div>
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">All detected colors</p>
                                  <div className="flex flex-wrap gap-1">
                                    {scrapeResult.allColors.map((c, i) => (
                                      <div key={i} className="w-5 h-5 rounded border border-border cursor-default" style={{ backgroundColor: c.hex }} title={`${c.hex} (score: ${c.score})`} data-testid={`detected-color-${i}`} />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Visual Style & Aspect Ratio — Compact Dropdowns */}
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="style"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Style</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-style" className="h-9">
                              <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STYLES.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="aspectRatio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Aspect Ratio</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-aspect-ratio" className="h-9">
                              <SelectValue placeholder="Select ratio" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ASPECT_RATIOS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label} — {r.desc}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* GENERATE BUTTON — Primary CTA */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-11 text-sm font-semibold"
                  disabled={mutation.isPending}
                  data-testid="button-generate"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate Background
                    </>
                  )}
                </Button>

                <Separator />

                {/* === PROGRESSIVE DISCLOSURE SECTIONS === */}

                {/* Industry */}
                <CollapsibleSection title="Industry" icon={Settings2} testId="section-industry">
                  <FormField
                    control={form.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-industry" className="h-9">
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDUSTRIES.map((ind) => (
                              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Adds industry-specific motifs and visual vocabulary</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleSection>

                {/* Colors & Palette */}
                <CollapsibleSection title="Colors & Palette" icon={Palette} testId="section-colors">
                  <div className="space-y-3">
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowPresets(!showPresets)}
                        className="flex items-center justify-between w-full text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-toggle-presets"
                      >
                        <span>Presets</span>
                        {showPresets ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                      {showPresets && (
                        <div className="grid grid-cols-3 gap-1 mt-1.5">
                          {PRESET_PALETTES.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              data-testid={`palette-${p.name.toLowerCase().replace(" ", "-")}`}
                              onClick={() => applyPalette(p)}
                              className="flex flex-col items-center gap-1 p-1.5 rounded-md border border-border text-[10px] text-muted-foreground hover:border-primary/40 transition-colors"
                            >
                              <div className="flex gap-0.5">
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.primary }} />
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.secondary }} />
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.accent }} />
                              </div>
                              <span className="truncate w-full text-center">{p.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {colorFields.map((cf, index) => (
                      <div key={cf.role} className="space-y-1.5" data-testid={`color-row-${cf.role}`}>
                        <div className="flex items-center gap-1.5">
                          <div className="flex flex-col gap-0">
                            <button type="button" disabled={index === 0} onClick={() => swapColors(index, "up")} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors" data-testid={`button-color-up-${cf.role}`}>
                              <ArrowUp className="h-2.5 w-2.5" />
                            </button>
                            <button type="button" disabled={index === colorFields.length - 1} onClick={() => swapColors(index, "down")} className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors" data-testid={`button-color-down-${cf.role}`}>
                              <ArrowDown className="h-2.5 w-2.5" />
                            </button>
                          </div>
                          <FormField
                            control={form.control}
                            name={cf.colorKey as any}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5">
                                    <input type="color" value={field.value as string || cf.defaultFallback} onChange={(e) => field.onChange(e.target.value)} className="w-6 h-6 rounded cursor-pointer border border-border" data-testid={cf.testIdColor} />
                                    <span className="text-[11px] font-medium text-muted-foreground">{cf.label}</span>
                                  </div>
                                  <Input value={field.value as string} onChange={(e) => field.onChange(e.target.value)} className="w-20 h-6 text-[10px] font-mono uppercase px-1.5" placeholder={cf.defaultFallback} data-testid={cf.testIdInput} />
                                </div>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name={cf.weightKey as any}
                          render={({ field }) => (
                            <FormItem className="pl-6">
                              <div className="flex items-center gap-2">
                                <Slider min={0} max={100} step={5} value={[field.value as number]} onValueChange={([v]) => field.onChange(v)} className="flex-1" data-testid={cf.testIdWeight} />
                                <span className="text-[10px] font-mono text-muted-foreground w-8 text-right">{field.value as number}%</span>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>

                {/* Fine-Tune (Intensity Sliders) */}
                <CollapsibleSection title="Fine-Tune" icon={SlidersHorizontal} testId="section-fine-tune">
                  <div className="space-y-3">
                    {([
                      { name: "industryIntensity" as const, label: "Industry Motifs", valueKey: "industry" as const, testId: "slider-industry-intensity" },
                      { name: "styleIntensity" as const, label: "Visual Style", valueKey: "style" as const, testId: "slider-style-intensity" },
                      { name: "themeIntensity" as const, label: "Event Theme", valueKey: "theme" as const, testId: "slider-theme-intensity" },
                      { name: "cityIntensity" as const, label: "City / Location", valueKey: "city" as const, testId: "slider-city-intensity" },
                      { name: "venueIntensity" as const, label: "Venue", valueKey: "venue" as const, testId: "slider-venue-intensity" },
                    ]).map((item) => {
                      const currentValue = form.watch(item.valueKey);
                      const displayValue = typeof currentValue === "string" && currentValue ? currentValue : null;
                      return (
                        <FormField
                          key={item.name}
                          control={form.control}
                          name={item.name}
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between mb-0.5">
                                <FormLabel className="text-[11px] font-medium">
                                  {item.label}
                                  {displayValue && (
                                    <span className="text-[10px] text-primary/70 font-normal ml-1.5" data-testid={`label-${item.valueKey}-value`}>
                                      {displayValue}
                                    </span>
                                  )}
                                </FormLabel>
                                <span className="text-[10px] text-muted-foreground">{intensityLabel(field.value as number)} ({field.value}%)</span>
                              </div>
                              <Slider min={0} max={100} step={5} value={[field.value as number]} onValueChange={([v]) => field.onChange(v)} data-testid={item.testId} />
                            </FormItem>
                          )}
                        />
                      );
                    })}
                  </div>
                </CollapsibleSection>

                {/* Advanced (City, Custom Prompt, Model) */}
                <CollapsibleSection title="Advanced" icon={Settings2} testId="section-advanced">
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="theme"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-medium">Event / Brand Theme</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Artificial Intelligence, Sustainability, Fintech..." className="text-sm h-8" data-testid="input-theme" />
                          </FormControl>
                          <p className="text-[10px] text-muted-foreground">The topic or subject matter — adds conceptual imagery</p>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-medium flex items-center gap-1.5">
                            <MapPin className="h-3 w-3" />
                            City / Location
                          </FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Tokyo, New York, Paris..." className="text-sm h-8" data-testid="input-city" />
                          </FormControl>
                          <p className="text-[10px] text-muted-foreground">Adds skyline, landmarks, and cultural cues</p>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="venue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-medium">Venue</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="e.g. Moscone Center, ExCeL London..." className="text-sm h-8" data-testid="input-venue" />
                          </FormControl>
                          <p className="text-[10px] text-muted-foreground">Adds venue architecture and structural elements</p>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customPrompt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-medium">Additional Instructions</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="e.g. rainy evening atmosphere, neon reflections..." className="text-sm resize-none" rows={2} data-testid="textarea-custom-prompt" />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[11px] font-medium">Model</FormLabel>
                          <div className="grid grid-cols-2 gap-1.5">
                            {MODELS.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                data-testid={`model-${m.value}`}
                                onClick={() => field.onChange(m.value)}
                                className={cn(
                                  "flex items-center justify-between px-2.5 py-2 rounded-md border text-left transition-colors",
                                  field.value === m.value
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                                )}
                              >
                                <span className="text-[11px] font-medium">{m.label}</span>
                                <Badge variant={field.value === m.value ? "default" : "secondary"} className="text-[9px] h-4 px-1.5">
                                  {m.badge}
                                </Badge>
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleSection>

              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
