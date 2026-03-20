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
  Globe, Check, AlertCircle, Crosshair,
  Palette, Settings2, MapPin, FileText, RefreshCw, Zap, Image as ImageIcon,
  X, Pencil, Type, ArrowUp, ArrowDown, Minus, Plus, GripHorizontal,
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
  {
    value: "photorealistic",
    label: "Photorealistic",
    desc: "Real-world photography feel",
    gradient: "from-sky-900 to-blue-800",
    accent: "#0ea5e9",
  },
  {
    value: "illustration",
    label: "Illustration",
    desc: "Hand-drawn artistic style",
    gradient: "from-emerald-800 to-teal-700",
    accent: "#10b981",
  },
  {
    value: "abstract",
    label: "Abstract",
    desc: "Non-representational shapes",
    gradient: "from-violet-900 to-purple-800",
    accent: "#8b5cf6",
  },
  {
    value: "minimalist",
    label: "Minimalist",
    desc: "Clean, simple, lots of space",
    gradient: "from-slate-800 to-gray-700",
    accent: "#94a3b8",
  },
  {
    value: "gradient",
    label: "Gradient",
    desc: "Smooth color transitions",
    gradient: "from-rose-800 to-pink-700",
    accent: "#f43f5e",
  },
  {
    value: "editorial",
    label: "Editorial",
    desc: "Bold magazine-style layouts",
    gradient: "from-amber-900 to-orange-800",
    accent: "#f97316",
  },
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

const FOCUS_OPTIONS = [
  { value: "industry", label: "Industry" },
  { value: "city", label: "City / Location" },
  { value: "venue", label: "Venue" },
  { value: "graphic", label: "Current Header Graphic" },
  { value: "theme", label: "Theme" },
];


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
  eventDates?: string;
  city: string;
  venue: string;
  theme: string;
  customPrompt: string;
  summary: string;
  screenshot?: string;
  logo?: { base64: string; mimeType: string } | null;
  allColors?: ScrapeColorInfo[];
  fontFamily?: string | null;
}

interface TextOverlayItem {
  id: string;
  text: string;
  pos: { x: number; y: number };
  fontSize: number;
  color: string;
  visible: boolean;
}

type ColorRole = "primary" | "secondary" | "accent";


function StepHeader({
  stepNum,
  title,
  subtitle,
  isComplete,
  isActive,
  isLocked,
  onClick,
}: {
  stepNum: number;
  title: string;
  subtitle?: string;
  isComplete: boolean;
  isActive: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLocked}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors rounded-t-lg",
        isActive ? "bg-muted/40" : "hover:bg-muted/20",
        isLocked && "opacity-40 cursor-not-allowed"
      )}
      data-testid={`step-header-${stepNum}`}
    >
      <div className={cn(
        "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
        isComplete ? "bg-primary text-primary-foreground" :
        isActive ? "bg-primary/20 text-primary border-2 border-primary" :
        "bg-muted text-muted-foreground border-2 border-border"
      )}>
        {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNum}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-sm font-semibold",
          isActive ? "text-foreground" : isComplete ? "text-foreground" : "text-muted-foreground"
        )}>{title}</p>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {!isLocked && (
        isActive ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> :
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
    </button>
  );
}

export default function GeneratorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [previewResult, setPreviewResult] = useState<GeneratedResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedWithModel, setGeneratedWithModel] = useState<string | null>(null);

  const [eventUrl, setEventUrl] = useState("");
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [logoPos, setLogoPos] = useState({ x: 16, y: 16 });
  const [logoSize, setLogoSize] = useState(120);

  const computeLayout = useCallback((cw: number, ch: number) => {
    const isPortrait = ch > cw;
    const pad = Math.round(cw * 0.04);
    const newLogoSize = Math.round(Math.max(40, Math.min(400, cw * 0.27)));
    const logoX = pad;
    const logoY = pad;
    const headlineFontSize = Math.round(Math.max(12, Math.min(48, cw * 0.048)));
    const detailsFontSize = Math.round(Math.max(9, Math.min(32, cw * 0.032)));
    const ctaFontSize = Math.round(Math.max(9, Math.min(28, cw * 0.028)));
    const textLeft = pad;
    const contentTop = logoY + newLogoSize + Math.round(pad * 0.5);
    const contentBottom = ch - pad;
    const contentH = contentBottom - contentTop;
    const gap = Math.round(Math.max(4, ch * 0.02));
    let headlineY: number, detailsY: number, ctaY: number;
    if (isPortrait) {
      const midZone = contentTop + Math.round(contentH * 0.3);
      headlineY = midZone;
      detailsY = headlineY + Math.round(headlineFontSize * 2.2) + gap;
      ctaY = detailsY + Math.round(detailsFontSize * 1.4) + gap;
    } else {
      headlineY = contentTop;
      detailsY = headlineY + Math.round(headlineFontSize * 2.2) + gap;
      ctaY = detailsY + Math.round(detailsFontSize * 1.4) + gap;
    }
    return {
      logoSize: newLogoSize,
      logoPos: { x: logoX, y: logoY },
      overlays: [
        { fontSize: headlineFontSize, pos: { x: textLeft, y: headlineY } },
        { fontSize: detailsFontSize, pos: { x: textLeft, y: detailsY } },
        { fontSize: ctaFontSize, pos: { x: textLeft, y: ctaY } },
      ] as { fontSize: number; pos: { x: number; y: number } }[],
    };
  }, []);

  const [textOverlays, setTextOverlays] = useState<TextOverlayItem[]>([
    { id: "headline", text: "I'm Excited for [Event]", pos: { x: 50, y: 50 }, fontSize: 28, color: "#ffffff", visible: false },
    { id: "details", text: "[Dates] · [City]", pos: { x: 50, y: 90 }, fontSize: 18, color: "#ffffff", visible: false },
    { id: "cta", text: "Join Me, Link Above", pos: { x: 50, y: 130 }, fontSize: 16, color: "#ffffff", visible: false },
  ]);
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const [overlayFont, setOverlayFont] = useState<string>("");

  const updateOverlay = (id: string, updates: Partial<TextOverlayItem>) => {
    setTextOverlays((prev) => prev.map((o) => o.id === id ? { ...o, ...updates } : o));
  };

  const [containerWidth, setContainerWidth] = useState(0);
  const prevContainerWidth = useRef(0);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [focusLvl1, setFocusLvl1] = useState("industry");
  const [focusLvl2, setFocusLvl2] = useState("none");
  const [focusLvl3, setFocusLvl3] = useState("none");
  const setFocusTier = (tier: 1 | 2 | 3, value: string) => {
    if (tier === 1) { setFocusLvl1(value); form.setValue("focusPrimary", [value]); }
    if (tier === 2) { setFocusLvl2(value); form.setValue("focusSecondary", value === "none" ? [] : [value]); }
    if (tier === 3) { setFocusLvl3(value); form.setValue("focusTertiary", value === "none" ? [] : [value]); }
  };

  const [assigningColor, setAssigningColor] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const logoDragging = useRef(false);
  const logoDragOffset = useRef({ x: 0, y: 0 });
  const logoResizing = useRef(false);
  const logoResizeStart = useRef({ x: 0, y: 0, size: 120 });
  const textDragging = useRef(false);
  const textDragOffset = useRef({ x: 0, y: 0 });

  const form = useForm<ImageGenerationConfig>({
    resolver: zodResolver(imageGenerationConfigSchema),
    defaultValues: {
      industry: "Technology / SaaS",
      aspectRatio: "16:9",
      style: "gradient",
      primaryColor: "#0A84FF",
      secondaryColor: "#0B1F3B",
      accentColor: "#64D2FF",
      focusPrimary: ["industry"],
      focusSecondary: [] as string[],
      focusTertiary: [] as string[],
      colorProminence: 50,
      city: "",
      venue: "",
      theme: "",
      customPrompt: "",
      model: "gemini-2.5-flash-image",
    },
  });

  const selectedRatio = form.watch("aspectRatio");
  const prevRatio = useRef(selectedRatio);

  useEffect(() => {
    if (prevRatio.current === selectedRatio) return;
    prevRatio.current = selectedRatio;
    if (!previewRef.current) return;
    const cw = previewRef.current.clientWidth;
    const ch = previewRef.current.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    const layout = computeLayout(cw, ch);
    const ids = ["headline", "details", "cta"];
    setTextOverlays((prev) => prev.map((o, i) => {
      const li = ids.indexOf(o.id);
      if (li === -1) return o;
      return { ...o, fontSize: layout.overlays[li].fontSize, pos: layout.overlays[li].pos };
    }));
    setLogoSize(layout.logoSize);
    setLogoPos(layout.logoPos);
  }, [selectedRatio, computeLayout]);

  const colorFields: { role: ColorRole; label: string; colorKey: keyof ImageGenerationConfig; testIdColor: string; testIdInput: string; defaultFallback: string }[] = [
    { role: "primary", label: "Primary", colorKey: "primaryColor", testIdColor: "color-primary", testIdInput: "input-primary-color", defaultFallback: "#0A84FF" },
    { role: "secondary", label: "Secondary", colorKey: "secondaryColor", testIdColor: "color-secondary", testIdInput: "input-secondary-color", defaultFallback: "#000000" },
    { role: "accent", label: "Accent", colorKey: "accentColor", testIdColor: "color-accent", testIdInput: "input-accent-color", defaultFallback: "#ffffff" },
  ];

  const completeStep = (step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  };

  const goToStep = (step: number) => {
    if (step > 1 && !completedSteps.has(1)) return;
    if (step > 2 && !completedSteps.has(2)) return;
    setActiveStep(activeStep === step ? 0 : step);
  };

  useEffect(() => {
    if (!previewRef.current) return;
    const prevHeight = { current: 0 };
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (prevContainerWidth.current > 0 && newWidth > 0 && Math.abs(newWidth - prevContainerWidth.current) > 2) {
          const scaleX = newWidth / prevContainerWidth.current;
          const scaleY = newHeight > 0 && prevHeight.current > 0 ? newHeight / prevHeight.current : scaleX;
          setLogoSize((s) => Math.round(Math.max(32, Math.min(300, s * scaleX))));
          setLogoPos((p) => ({ x: Math.round(p.x * scaleX), y: Math.round(p.y * scaleY) }));
          setTextOverlays((prev) => prev.map((o) => ({
            ...o,
            fontSize: Math.round(Math.max(8, Math.min(200, o.fontSize * scaleX))),
            pos: { x: Math.round(o.pos.x * scaleX), y: Math.round(o.pos.y * scaleY) },
          })));
        }
        if (newWidth > 0) {
          prevContainerWidth.current = newWidth;
          setContainerWidth(newWidth);
        }
        if (newHeight > 0) prevHeight.current = newHeight;
      }
    });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLogoDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    logoDragging.current = true;
    const rect = (e.target as HTMLElement).closest("[data-overlay]")!.getBoundingClientRect();
    logoDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const startPos = { ...logoPos };
    const onMove = (me: MouseEvent) => {
      if (!logoDragging.current || !previewRef.current) return;
      const containerRect = previewRef.current.getBoundingClientRect();
      let newX = Math.max(0, Math.min(me.clientX - containerRect.left - logoDragOffset.current.x, containerRect.width - logoSize));
      let newY = Math.max(0, Math.min(me.clientY - containerRect.top - logoDragOffset.current.y, containerRect.height - logoSize));
      if (me.shiftKey) {
        const dx = Math.abs(newX - startPos.x);
        const dy = Math.abs(newY - startPos.y);
        if (dx > dy) { newY = startPos.y; } else { newX = startPos.x; }
      }
      setLogoPos({ x: newX, y: newY });
    };
    const onUp = () => {
      logoDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [logoSize, logoPos]);

  const handleLogoResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    logoResizing.current = true;
    logoResizeStart.current = { x: e.clientX, y: e.clientY, size: logoSize };
    const onMove = (me: MouseEvent) => {
      if (!logoResizing.current) return;
      const delta = (me.clientX - logoResizeStart.current.x + me.clientY - logoResizeStart.current.y) / 2;
      setLogoSize(Math.round(Math.max(16, Math.min(300, logoResizeStart.current.size + delta))));
    };
    const onUp = () => {
      logoResizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [logoSize]);

  const handleTextDragStart = useCallback((e: React.MouseEvent, overlayId: string) => {
    e.preventDefault();
    textDragging.current = true;
    const rect = (e.target as HTMLElement).closest("[data-overlay]")!.getBoundingClientRect();
    textDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const overlay = textOverlays.find((o) => o.id === overlayId);
    if (!overlay) return;
    const startPos = { ...overlay.pos };
    const onMove = (me: MouseEvent) => {
      if (!textDragging.current || !previewRef.current) return;
      const containerRect = previewRef.current.getBoundingClientRect();
      let newX = Math.max(0, Math.min(me.clientX - containerRect.left - textDragOffset.current.x, containerRect.width - 100));
      let newY = Math.max(0, Math.min(me.clientY - containerRect.top - textDragOffset.current.y, containerRect.height - 40));
      if (me.shiftKey) {
        const dx = Math.abs(newX - startPos.x);
        const dy = Math.abs(newY - startPos.y);
        if (dx > dy) { newY = startPos.y; } else { newX = startPos.x; }
      }
      updateOverlay(overlayId, { pos: { x: newX, y: newY } });
    };
    const onUp = () => {
      textDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    setActiveOverlayId(overlayId);
  }, [textOverlays]);

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
      setFocusLvl1("industry");
      const lvl2 = data.theme ? "theme" : "none";
      setFocusLvl2(lvl2);
      setFocusLvl3("none");
      form.setValue("focusPrimary", ["industry"]);
      form.setValue("focusSecondary", lvl2 === "none" ? [] : [lvl2]);
      form.setValue("focusTertiary", []);

      const eventName = data.eventName || "Event";
      const dateParts = [data.eventDates, data.city].filter(Boolean);
      const detailsText = dateParts.length > 0 ? dateParts.join(" · ") : "";
      const el = previewRef.current;
      const cw = el ? el.clientWidth : 400;
      const ch = el ? el.clientHeight : 225;
      const layout = computeLayout(cw, ch);
      setTextOverlays([
        { id: "headline", text: `I'm Excited for ${eventName}`, pos: layout.overlays[0].pos, fontSize: layout.overlays[0].fontSize, color: "#ffffff", visible: true },
        { id: "details", text: detailsText || "[Dates] · [City]", pos: layout.overlays[1].pos, fontSize: layout.overlays[1].fontSize, color: "#ffffff", visible: !!detailsText },
        { id: "cta", text: "Join Me, Link Above", pos: layout.overlays[2].pos, fontSize: layout.overlays[2].fontSize, color: "#ffffff", visible: true },
      ]);
      setLogoSize(layout.logoSize);
      setLogoPos(layout.logoPos);
      setActiveOverlayId("headline");
      setOverlayFont(data.fontFamily || "");

      completeStep(1);
      setActiveStep(2);

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

  const previewMutation = useMutation({
    mutationFn: async (data: ImageGenerationConfig) => {
      const res = await apiRequest("POST", "/api/generate", data);
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewResult(data);
    },
    onError: () => {},
  });

  const handleScrapeAndPreview = () => {
    if (!eventUrl.trim()) {
      setScrapeError("Enter a URL first");
      return;
    }
    setScrapeError(null);
    setPreviewResult(null);
    scrapeMutation.mutate(eventUrl.trim());
  };

  useEffect(() => {
    if (scrapeResult && !previewMutation.isPending && !previewResult) {
      const config = form.getValues();
      const previewConfig = { ...config, focusPrimary: ["graphic"], focusSecondary: ["industry"], focusTertiary: [], model: "gemini-2.5-flash-image" };
      previewMutation.mutate(previewConfig);
    }
  }, [scrapeResult]);

  const handleCompleteStep1 = () => {
    completeStep(1);
    setActiveStep(2);
  };

  const handleCompleteStep2 = () => {
    completeStep(2);
    setActiveStep(3);
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
      completeStep(3);
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
    const activeResult = result;
    const hasOverlays = (showLogo && logoSrc) || textOverlays.some((o) => o.visible);
    if (!hasOverlays || !previewRef.current) {
      const link = document.createElement("a");
      link.href = `data:${activeResult.mimeType};base64,${activeResult.imageData}`;
      const ratio = form.getValues("aspectRatio").replace(":", "x");
      link.download = `nanabana-${ratio}-${activeResult.id}.png`;
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
      const container = previewRef.current!;
      const scaleX = bgImg.width / container.clientWidth;
      const scaleY = bgImg.height / container.clientHeight;

      const canvasWrapText = (text: string, x: number, y: number, maxW: number, lineH: number) => {
        const words = text.split(" ");
        let line = "";
        let curY = y;
        for (let i = 0; i < words.length; i++) {
          const test = line + (line ? " " : "") + words[i];
          if (ctx.measureText(test).width > maxW && line) {
            ctx.strokeText(line, x, curY);
            ctx.fillText(line, x, curY);
            line = words[i];
            curY += lineH;
          } else {
            line = test;
          }
        }
        if (line) {
          ctx.strokeText(line, x, curY);
          ctx.fillText(line, x, curY);
        }
      };

      const doText = () => {
        const fontStack = overlayFont ? `"${overlayFont}", Inter, sans-serif` : "Inter, sans-serif";
        textOverlays.filter((o) => o.visible && o.text).forEach((o) => {
          const scaledSize = o.fontSize * scaleX;
          ctx.font = `bold ${scaledSize}px ${fontStack}`;
          ctx.fillStyle = o.color;
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = scaledSize * 0.08;
          const maxTextWidth = canvas.width * 0.65;
          canvasWrapText(o.text, o.pos.x * scaleX, (o.pos.y + o.fontSize) * scaleY, maxTextWidth, scaledSize * 1.25);
        });
        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          const ratio = form.getValues("aspectRatio").replace(":", "x");
          link.download = `nanabana-${ratio}-${activeResult.id}.png`;
          link.click();
          URL.revokeObjectURL(link.href);
        }, "image/png");
      };

      if (showLogo && logoSrc) {
        const logoImg = new window.Image();
        logoImg.onload = () => {
          ctx.drawImage(logoImg, logoPos.x * scaleX, logoPos.y * scaleY, logoSize * scaleX, logoSize * scaleY);
          doText();
        };
        logoImg.src = logoSrc;
      } else {
        doText();
      }
    };
    bgImg.src = `data:${activeResult.mimeType};base64,${activeResult.imageData}`;
  }, [result, form, showLogo, logoSrc, logoPos, logoSize, textOverlays, overlayFont]);

  const copyPrompt = useCallback(() => {
    if (!result?.prompt) return;
    navigator.clipboard.writeText(result.prompt);
    toast({ title: "Prompt copied to clipboard" });
  }, [result, toast]);

  const displayResult = result || previewResult;

  const step1Subtitle = scrapeResult
    ? scrapeResult.eventName || "Website analyzed"
    : undefined;

  const step2Subtitle = completedSteps.has(2) ? "Confirmed" : undefined;

  const currentStyle = form.watch("style");
  const styleObj = STYLES.find((s) => s.value === currentStyle);
  const step3Subtitle = completedSteps.has(3) ? (result ? `${styleObj?.label} — Generated` : styleObj?.label) : undefined;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">

          {/* ===== PREVIEW PANEL (LEFT — sticky on desktop) ===== */}
          <div className="space-y-3 order-2 xl:order-1 xl:self-start xl:sticky xl:top-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight" data-testid="text-page-title">Nano Banana Studio</h1>
                <p className="text-xs text-muted-foreground">Social media background generator</p>
              </div>
              {displayResult && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadImage}
                  data-testid="button-download"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              )}
            </div>

            <div
              ref={previewRef}
              className={cn(
                "w-full rounded-lg border border-border overflow-hidden bg-muted/20 relative",
                ASPECT_RATIO_CSS[selectedRatio] || "aspect-video",
                "min-h-[280px]"
              )}
              data-testid="preview-area"
            >
              {(mutation.isPending || previewMutation.isPending) ? (
                <div className="absolute inset-0 skeleton-shimmer flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary/60" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground/80" data-testid="text-loading">
                      {previewMutation.isPending ? "Generating preview..." : "Creating your background..."}
                    </p>
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
              ) : displayResult ? (
                <>
                  <img
                    key={displayResult.id}
                    src={`data:${displayResult.mimeType};base64,${displayResult.imageData}`}
                    alt="Generated social background"
                    className="w-full h-full object-cover image-reveal"
                    data-testid="img-generated"
                  />
                  {logoSrc && showLogo && (
                    <div
                      data-overlay="logo"
                      className="absolute cursor-grab active:cursor-grabbing group"
                      style={{ left: logoPos.x, top: logoPos.y, width: logoSize, height: logoSize }}
                      onMouseDown={handleLogoDragStart}
                      data-testid="logo-overlay"
                    >
                      <img src={logoSrc} alt="Event logo" style={{ width: logoSize, height: logoSize }} className="object-contain rounded shadow-lg pointer-events-none" draggable={false} />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowLogo(false); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        data-testid="button-remove-logo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div
                        className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-se-resize z-10"
                        onMouseDown={handleLogoResizeStart}
                        data-testid="logo-resize-handle"
                        title="Drag to resize"
                      >
                        <GripHorizontal className="h-2.5 w-2.5 text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  {textOverlays.filter((o) => o.visible && o.text).map((o) => (
                    <div
                      key={o.id}
                      data-overlay={`text-${o.id}`}
                      className={cn(
                        "absolute cursor-grab active:cursor-grabbing group select-none",
                        activeOverlayId === o.id && "ring-1 ring-primary/50 rounded"
                      )}
                      style={{ left: o.pos.x, top: o.pos.y, maxWidth: containerWidth > 0 ? containerWidth * 0.65 : "65%" }}
                      onMouseDown={(e) => handleTextDragStart(e, o.id)}
                      data-testid={`text-overlay-${o.id}`}
                    >
                      <p
                        style={{
                          fontSize: o.fontSize,
                          color: o.color,
                          fontFamily: overlayFont ? `"${overlayFont}", Inter, sans-serif` : "Inter, sans-serif",
                          textShadow: "0 2px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.9)",
                          fontWeight: 700,
                          lineHeight: 1.25,
                          whiteSpace: "normal",
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                          pointerEvents: "none",
                          userSelect: "none",
                        }}
                        data-testid={`text-overlay-content-${o.id}`}
                      >
                        {o.text}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); updateOverlay(o.id, { visible: false }); if (activeOverlayId === o.id) setActiveOverlayId(null); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid={`button-remove-text-${o.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {!result && previewResult && (
                    <div className="absolute top-2 right-2 bg-background/80 border border-border rounded px-2 py-1 text-[10px] text-muted-foreground">
                      Preview — based on header graphic
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
                    <p className="text-xs mt-1 opacity-60">Start by pasting an event URL in Step 1</p>
                  </div>
                </div>
              )}
            </div>

            {displayResult && (
              <div className="flex items-center gap-3 flex-wrap">
                {logoSrc && !showLogo && (
                  <button
                    type="button"
                    onClick={() => setShowLogo(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    data-testid="button-show-logo"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Show logo
                  </button>
                )}
                {textOverlays.filter((o) => !o.visible).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => { updateOverlay(o.id, { visible: true }); setActiveOverlayId(o.id); }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    data-testid={`button-show-text-${o.id}`}
                  >
                    <Type className="h-3.5 w-3.5" />
                    Show {o.id === "headline" ? "headline" : o.id === "details" ? "details" : "CTA"}
                  </button>
                ))}
              </div>
            )}

            {displayResult && activeOverlayId && textOverlays.find((o) => o.id === activeOverlayId && o.visible) && (() => {
              const ao = textOverlays.find((o) => o.id === activeOverlayId)!;
              return (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-primary/30 bg-muted/30" data-testid={`overlay-controls-${ao.id}`}>
                  <span className="text-[10px] font-medium text-muted-foreground w-14 truncate capitalize">{ao.id}</span>
                  <button type="button" onClick={() => updateOverlay(ao.id, { fontSize: Math.max(8, ao.fontSize - 2) })} className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted" data-testid={`button-font-dec-${ao.id}`}><Minus className="h-2.5 w-2.5" /></button>
                  <span className="text-[10px] font-mono w-6 text-center" data-testid={`text-font-size-${ao.id}`}>{ao.fontSize}</span>
                  <button type="button" onClick={() => updateOverlay(ao.id, { fontSize: Math.min(96, ao.fontSize + 2) })} className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted" data-testid={`button-font-inc-${ao.id}`}><Plus className="h-2.5 w-2.5" /></button>
                  <input type="color" value={ao.color} onChange={(e) => updateOverlay(ao.id, { color: e.target.value })} className="w-5 h-5 rounded cursor-pointer border border-border flex-shrink-0" data-testid={`input-color-${ao.id}`} />
                  <Input value={ao.text} onChange={(e) => updateOverlay(ao.id, { text: e.target.value })} className="flex-1 h-6 text-[10px] px-1.5" data-testid={`input-text-${ao.id}`} />
                </div>
              );
            })()}

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

          {/* ===== STEPPER PANEL (RIGHT — scrolls independently) ===== */}
          <div className="order-1 xl:order-2 xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto">
            <Form {...form}>
              <form onSubmit={(e) => { if (activeStep !== 3) { e.preventDefault(); return; } form.handleSubmit(onSubmit)(e); }} className="space-y-2">

                {/* ====== STEP 1: EXTRACTION ====== */}
                <div className="border border-border rounded-lg overflow-hidden" data-testid="step-1">
                  <StepHeader
                    stepNum={1}
                    title="Extract from Website"
                    subtitle={step1Subtitle}
                    isComplete={completedSteps.has(1)}
                    isActive={activeStep === 1}
                    isLocked={false}
                    onClick={() => goToStep(1)}
                  />
                  {activeStep === 1 && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground">Paste any event or brand URL to auto-extract colors, venue, and theme</p>
                        <div className="flex gap-2">
                          <Input
                            value={eventUrl}
                            onChange={(e) => { setEventUrl(e.target.value); setScrapeError(null); }}
                            placeholder="https://example.com"
                            className="text-sm flex-1 h-9"
                            data-testid="input-event-url"
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScrapeAndPreview(); } }}
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={handleScrapeAndPreview}
                            disabled={scrapeMutation.isPending}
                            className="h-9 px-3 flex-shrink-0"
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

                        {scrapeError && (
                          <div className="flex items-start gap-2 p-2.5 rounded-md bg-destructive/5 border border-destructive/20" data-testid="scrape-error">
                            <AlertCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs text-destructive font-medium">Couldn't analyze that URL</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{scrapeError}</p>
                            </div>
                            <Button type="button" size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={handleScrapeAndPreview} data-testid="button-retry-scrape">
                              Retry
                            </Button>
                          </div>
                        )}
                      </div>

                      {scrapeResult && (
                        <div className="space-y-2">
                          <Separator />
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-primary" />
                            <p className="text-xs font-medium" data-testid="text-event-name">{scrapeResult.eventName || "Website analyzed"}</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground">Extraction complete — continue to review details</p>
                          <Button
                            type="button"
                            className="w-full h-9"
                            onClick={handleCompleteStep1}
                            data-testid="button-step1-continue"
                          >
                            <Check className="h-4 w-4" />
                            Continue to Confirm
                          </Button>
                        </div>
                      )}

                      {!scrapeResult && !scrapeMutation.isPending && (
                        <div className="space-y-2">
                          <Separator />
                          <p className="text-[11px] text-muted-foreground">Or skip extraction and configure manually</p>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full h-8 text-xs"
                            onClick={() => { completeStep(1); setActiveStep(2); }}
                            data-testid="button-skip-extraction"
                          >
                            Skip — configure manually
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ====== STEP 2: CONFIRM EXTRACTION ====== */}
                <div className="border border-border rounded-lg overflow-hidden" data-testid="step-2">
                  <StepHeader
                    stepNum={2}
                    title="Confirm Extraction"
                    subtitle={step2Subtitle}
                    isComplete={completedSteps.has(2)}
                    isActive={activeStep === 2}
                    isLocked={!completedSteps.has(1) && activeStep !== 2}
                    onClick={() => goToStep(2)}
                  />
                  {activeStep === 2 && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                      {scrapeResult ? (
                        <>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold" data-testid="text-confirm-event-name">{scrapeResult.eventName}</p>
                            {scrapeResult.summary && (
                              <p className="text-[11px] text-muted-foreground">{scrapeResult.summary}</p>
                            )}
                            {scrapeResult.fontFamily && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Type className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground">Font detected: <span className="font-medium text-foreground">{scrapeResult.fontFamily}</span></span>
                              </div>
                            )}
                          </div>

                          <div>
                            <p className="text-xs font-semibold mb-2">Brand Colors</p>
                            {scrapeResult.allColors && scrapeResult.allColors.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[10px] text-muted-foreground mb-1.5">Detected colors — click a swatch to reassign</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {scrapeResult.allColors.map((c, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      className={cn(
                                        "w-7 h-7 rounded border-2 transition-all",
                                        assigningColor === c.hex
                                          ? "border-primary ring-2 ring-primary/40 scale-110"
                                          : "border-transparent hover:border-border hover:scale-105"
                                      )}
                                      style={{ backgroundColor: c.hex }}
                                      title={c.hex}
                                      data-testid={`detected-color-${i}`}
                                      onClick={() => setAssigningColor(assigningColor === c.hex ? null : c.hex)}
                                    />
                                  ))}
                                </div>
                                {assigningColor && (
                                  <div className="mt-2 flex items-center gap-2 px-2.5 py-2 rounded-md bg-muted/50 border border-border" data-testid="assign-color-bar">
                                    <div className="w-4 h-4 rounded flex-shrink-0 border border-border" style={{ backgroundColor: assigningColor }} />
                                    <span className="text-[10px] text-muted-foreground">Assign to:</span>
                                    {[
                                      { key: "primaryColor", label: "Primary" },
                                      { key: "secondaryColor", label: "Secondary" },
                                      { key: "accentColor", label: "Accent" },
                                    ].map(({ key, label }) => (
                                      <button
                                        key={key}
                                        type="button"
                                        data-testid={`assign-color-${key}`}
                                        onClick={() => { form.setValue(key as any, assigningColor); setAssigningColor(null); }}
                                        className="text-[10px] px-2 py-0.5 rounded border border-border hover:border-primary hover:bg-primary/10 text-muted-foreground hover:text-foreground transition-colors"
                                      >
                                        {label}
                                      </button>
                                    ))}
                                    <button type="button" onClick={() => setAssigningColor(null)} className="ml-auto text-muted-foreground hover:text-foreground" data-testid="button-close-color-assign">
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="space-y-2">
                              {colorFields.map((cf, index) => (
                                <div key={cf.role} className="flex items-center gap-2" data-testid={`color-row-${cf.role}`}>
                                  <div className="flex flex-col">
                                    <button type="button" disabled={index === 0} onClick={() => swapColors(index, "up")} className="p-0.5 rounded hover:bg-muted disabled:opacity-20" data-testid={`button-color-up-${cf.role}`}>
                                      <ArrowUp className="h-2.5 w-2.5" />
                                    </button>
                                    <button type="button" disabled={index === colorFields.length - 1} onClick={() => swapColors(index, "down")} className="p-0.5 rounded hover:bg-muted disabled:opacity-20" data-testid={`button-color-down-${cf.role}`}>
                                      <ArrowDown className="h-2.5 w-2.5" />
                                    </button>
                                  </div>
                                  <FormField
                                    control={form.control}
                                    name={cf.colorKey as any}
                                    render={({ field }) => (
                                      <FormItem className="flex-1 mb-0">
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="color"
                                            value={field.value as string || cf.defaultFallback}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            className="w-8 h-8 rounded cursor-pointer border border-border flex-shrink-0"
                                            data-testid={cf.testIdColor}
                                          />
                                          <div className="flex-1">
                                            <p className="text-[11px] font-medium">{cf.label}</p>
                                          </div>
                                          <Input
                                            value={field.value as string}
                                            onChange={(e) => field.onChange(e.target.value)}
                                            className="w-24 h-7 text-[10px] font-mono uppercase px-2"
                                            placeholder={cf.defaultFallback}
                                            data-testid={cf.testIdInput}
                                          />
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {scrapeResult.logo && logoSrc && (
                            <div>
                              <p className="text-xs font-semibold mb-2">Logo</p>
                              <div className="flex items-center gap-3">
                                <img
                                  src={logoSrc}
                                  alt="Detected logo"
                                  className="w-12 h-12 object-contain rounded border border-border bg-muted/20"
                                  data-testid="img-confirm-logo"
                                />
                                <p className="text-[11px] text-muted-foreground">Detected from website — will be placed as an overlay</p>
                              </div>
                            </div>
                          )}

                          <Separator />

                          <div>
                            <p className="text-xs font-semibold mb-2">Extracted Details</p>
                            <div className="space-y-2">
                              <FormField
                                control={form.control}
                                name="industry"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] font-medium">Industry</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger data-testid="select-industry" className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {INDUSTRIES.map((ind) => (
                                          <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="theme"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] font-medium">Theme</FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="e.g. AI & Machine Learning..." className="text-xs h-8" data-testid="input-theme" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="text-[11px] font-medium flex items-center gap-1">
                                      <MapPin className="h-3 w-3" /> City
                                    </FormLabel>
                                    <FormControl>
                                      <Input {...field} placeholder="e.g. San Francisco..." className="text-xs h-8" data-testid="input-city" />
                                    </FormControl>
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
                                      <Input {...field} placeholder="e.g. Moscone Center..." className="text-xs h-8" data-testid="input-venue" />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>

                          <Separator />

                          <div>
                            <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                              <Type className="h-3.5 w-3.5" /> Text Overlays
                            </p>
                            <div className="space-y-2">
                              {textOverlays.map((o) => (
                                <div key={o.id} className="flex items-center gap-2" data-testid={`overlay-row-${o.id}`}>
                                  <button
                                    type="button"
                                    onClick={() => updateOverlay(o.id, { visible: !o.visible })}
                                    className={cn(
                                      "text-[9px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 w-12 text-center",
                                      o.visible ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                                    )}
                                    data-testid={`button-toggle-overlay-${o.id}`}
                                  >
                                    {o.visible ? "On" : "Off"}
                                  </button>
                                  <Input
                                    value={o.text}
                                    onChange={(e) => updateOverlay(o.id, { text: e.target.value })}
                                    placeholder={o.id === "headline" ? "Headline…" : o.id === "details" ? "Dates · City…" : "CTA…"}
                                    className="text-xs h-7 flex-1"
                                    data-testid={`input-overlay-text-${o.id}`}
                                  />
                                  <input type="color" value={o.color} onChange={(e) => updateOverlay(o.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border flex-shrink-0" data-testid={`input-overlay-color-${o.id}`} />
                                </div>
                              ))}
                              <div>
                                <p className="text-[10px] text-muted-foreground mb-1">Font family</p>
                                <Input
                                  value={overlayFont}
                                  onChange={(e) => setOverlayFont(e.target.value)}
                                  placeholder="Inter, Roboto, Georgia…"
                                  className="text-xs h-7 font-mono"
                                  data-testid="input-overlay-font"
                                />
                              </div>
                            </div>
                          </div>

                          <Button
                            type="button"
                            className="w-full h-9"
                            onClick={handleCompleteStep2}
                            data-testid="button-step2-continue"
                          >
                            <Check className="h-4 w-4" />
                            Looks good, continue
                          </Button>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-xs text-muted-foreground">No extraction data — configure manually below.</p>

                          <div className="space-y-2">
                            <FormField
                              control={form.control}
                              name="industry"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] font-medium">Industry</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-industry-manual" className="h-8 text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {INDUSTRIES.map((ind) => (
                                        <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="theme"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] font-medium">Theme</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="e.g. AI & Machine Learning..." className="text-xs h-8" data-testid="input-theme-manual" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="city"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-[11px] font-medium flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> City
                                  </FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="e.g. San Francisco..." className="text-xs h-8" data-testid="input-city-manual" />
                                  </FormControl>
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
                                    <Input {...field} placeholder="e.g. Moscone Center..." className="text-xs h-8" data-testid="input-venue-manual" />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>

                          <div className="space-y-2">
                            {colorFields.map((cf) => (
                              <FormField
                                key={cf.role}
                                control={form.control}
                                name={cf.colorKey as any}
                                render={({ field }) => (
                                  <FormItem>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={field.value as string || cf.defaultFallback}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="w-8 h-8 rounded cursor-pointer border border-border flex-shrink-0"
                                        data-testid={`${cf.testIdColor}-manual`}
                                      />
                                      <div className="flex-1">
                                        <p className="text-[11px] font-medium">{cf.label}</p>
                                      </div>
                                      <Input
                                        value={field.value as string}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        className="w-24 h-7 text-[10px] font-mono uppercase px-2"
                                        placeholder={cf.defaultFallback}
                                        data-testid={`${cf.testIdInput}-manual`}
                                      />
                                    </div>
                                  </FormItem>
                                )}
                              />
                            ))}
                          </div>

                          <Separator />

                          <div>
                            <p className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                              <Type className="h-3.5 w-3.5" /> Text Overlays
                            </p>
                            <div className="space-y-2">
                              {textOverlays.map((o) => (
                                <div key={o.id} className="flex items-center gap-2" data-testid={`overlay-row-${o.id}-manual`}>
                                  <button
                                    type="button"
                                    onClick={() => updateOverlay(o.id, { visible: !o.visible })}
                                    className={cn(
                                      "text-[9px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 w-12 text-center",
                                      o.visible ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                                    )}
                                    data-testid={`button-toggle-overlay-${o.id}-manual`}
                                  >
                                    {o.visible ? "On" : "Off"}
                                  </button>
                                  <Input
                                    value={o.text}
                                    onChange={(e) => updateOverlay(o.id, { text: e.target.value })}
                                    placeholder={o.id === "headline" ? "Headline…" : o.id === "details" ? "Dates · City…" : "CTA…"}
                                    className="text-xs h-7 flex-1"
                                    data-testid={`input-overlay-text-${o.id}-manual`}
                                  />
                                  <input type="color" value={o.color} onChange={(e) => updateOverlay(o.id, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border border-border flex-shrink-0" data-testid={`input-overlay-color-${o.id}-manual`} />
                                </div>
                              ))}
                            </div>
                          </div>

                          <Button
                            type="button"
                            className="w-full h-9"
                            onClick={handleCompleteStep2}
                            data-testid="button-step2-continue-manual"
                          >
                            <Check className="h-4 w-4" />
                            Continue to Style & Generate
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ====== STEP 3: STYLE + GENERATE (COMBINED) ====== */}
                <div className="border border-border rounded-lg overflow-hidden" data-testid="step-3">
                  <StepHeader
                    stepNum={3}
                    title="Style & Generate"
                    subtitle={step3Subtitle}
                    isComplete={completedSteps.has(3)}
                    isActive={activeStep === 3}
                    isLocked={!completedSteps.has(2) && activeStep !== 3}
                    onClick={() => goToStep(3)}
                  />
                  {activeStep === 3 && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">

                      <FormField
                        control={form.control}
                        name="style"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold">Style</FormLabel>
                            <div className="grid grid-cols-2 gap-2">
                              {STYLES.map((s) => (
                                <button
                                  key={s.value}
                                  type="button"
                                  onClick={() => field.onChange(s.value)}
                                  className={cn(
                                    "relative rounded-lg border-2 overflow-hidden text-left transition-all",
                                    field.value === s.value
                                      ? "border-primary ring-2 ring-primary/30"
                                      : "border-border hover:border-muted-foreground/30"
                                  )}
                                  data-testid={`style-option-${s.value}`}
                                >
                                  <div className={cn("h-16 w-full bg-gradient-to-br", s.gradient, "relative flex items-center justify-center overflow-hidden")}>
                                    {s.value === "photorealistic" && (
                                      <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.35) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(0,0,0,0.3) 0%, transparent 50%)" }}>
                                        <div className="absolute bottom-0 left-0 right-0 h-[40%]" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }} />
                                        <div className="absolute w-3 h-4 rounded-sm bg-white/20 top-2 left-[45%]" />
                                        <div className="absolute w-5 h-3 rounded-sm bg-white/15 top-3 left-[55%]" />
                                      </div>
                                    )}
                                    {s.value === "illustration" && (
                                      <div className="absolute inset-0">
                                        <div className="absolute w-6 h-6 rounded-full border-2 border-white/25 top-1 left-2" />
                                        <div className="absolute w-4 h-4 rounded-full bg-white/15 top-3 right-4" />
                                        <div className="absolute bottom-1 left-4 right-4 h-[1px] bg-white/20" />
                                        <div className="absolute bottom-3 left-6 right-6 h-[1px] bg-white/15" />
                                        <svg className="absolute bottom-0 left-0 w-full h-8 opacity-20" viewBox="0 0 100 30"><path d="M0 25 Q 15 10 30 20 T 60 15 T 100 20 V30 H0Z" fill="white"/></svg>
                                      </div>
                                    )}
                                    {s.value === "abstract" && (
                                      <div className="absolute inset-0">
                                        <div className="absolute w-10 h-10 rounded-full bg-white/10 -top-2 -left-2" />
                                        <div className="absolute w-6 h-6 rotate-45 bg-white/15 top-1 right-3" />
                                        <div className="absolute w-14 h-[2px] bg-white/20 top-8 left-4 rotate-[-20deg]" />
                                        <div className="absolute w-4 h-4 rounded-full border border-white/20 bottom-2 left-[40%]" />
                                      </div>
                                    )}
                                    {s.value === "minimalist" && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-[60%] h-[1px] bg-white/25 absolute top-5" />
                                        <div className="w-5 h-5 border border-white/30 rounded-full" />
                                        <div className="absolute bottom-3 left-[20%] w-[30%] h-[1px] bg-white/15" />
                                      </div>
                                    )}
                                    {s.value === "gradient" && (
                                      <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 25% 40%, ${s.accent}aa, transparent 50%), radial-gradient(circle at 75% 60%, rgba(255,255,255,0.15), transparent 45%), linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)` }} />
                                    )}
                                    {s.value === "editorial" && (
                                      <div className="absolute inset-0">
                                        <div className="absolute left-2 top-2 bottom-2 w-[2px] rounded-full" style={{ backgroundColor: `${s.accent}cc` }} />
                                        <div className="absolute top-3 left-5 right-3 h-[2px] bg-white/25" />
                                        <div className="absolute top-6 left-5 w-[40%] h-[1.5px] bg-white/15" />
                                        <div className="absolute bottom-3 left-5 right-3 h-[2px] bg-white/20" />
                                      </div>
                                    )}
                                    {field.value === s.value && (
                                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
                                        <Check className="h-3 w-3 text-primary-foreground" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="px-2 py-1.5 bg-card">
                                    <p className="text-xs font-semibold">{s.label}</p>
                                    <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="colorProminence"
                        render={({ field }) => {
                          const pv = field.value as number;
                          const pLabel = pv <= 20 ? "Subtle tint" : pv <= 40 ? "Soft presence" : pv <= 60 ? "Balanced" : pv <= 80 ? "Bold" : "Color dominant";
                          const pc = form.getValues("primaryColor") || "#0A84FF";
                          const sc = form.getValues("secondaryColor") || "#0B1F3B";
                          const ac = form.getValues("accentColor") || "#64D2FF";
                          const pOpacity = Math.round(Math.max(10, Math.min(100, pv * 1.0)));
                          return (
                          <FormItem>
                            <div className="flex items-center justify-between mb-1">
                              <FormLabel className="text-xs font-semibold flex items-center gap-2">
                                <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                                Brand Color Prominence
                              </FormLabel>
                              <span className="text-[10px] font-medium text-muted-foreground">{pLabel}</span>
                            </div>
                            <div
                              className="h-6 rounded-md mb-2 border border-border overflow-hidden transition-all"
                              style={{
                                background: `linear-gradient(90deg, ${pc}${pOpacity.toString(16).padStart(2, "0")} 0%, ${sc}${pOpacity.toString(16).padStart(2, "0")} 50%, ${ac}${pOpacity.toString(16).padStart(2, "0")} 100%)`,
                              }}
                              data-testid="prominence-preview-bar"
                            />
                            <Slider min={0} max={100} step={5} value={[pv]} onValueChange={([v]) => field.onChange(v)} data-testid="slider-colorProminence" />
                            <p className="text-[10px] text-muted-foreground mt-1">{pv}% — {pLabel}</p>
                          </FormItem>
                          );
                        }}
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

                      <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-semibold">Model</FormLabel>
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
                          </FormItem>
                        )}
                      />

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-semibold">Focus Priority</p>
                        </div>
                        <div className="space-y-2" data-testid="focus-tier-selects">
                          {([
                            { tier: 1 as const, label: "Primary", desc: "Drives the scene (~60%)", value: focusLvl1, required: true },
                            { tier: 2 as const, label: "Supporting", desc: "Adds atmosphere (~25%)", value: focusLvl2, required: false },
                            { tier: 3 as const, label: "Subtle", desc: "Background texture (~15%)", value: focusLvl3, required: false },
                          ]).map(({ tier, label, desc, value, required }) => {
                            const otherVals = [focusLvl1, focusLvl2, focusLvl3].filter((_, i) => i + 1 !== tier);
                            const available = FOCUS_OPTIONS.filter((o) => !otherVals.includes(o.value));
                            return (
                              <div key={tier} className="flex items-center gap-2">
                                <div className="w-16 shrink-0">
                                  <p className="text-[11px] font-medium">{label}</p>
                                  <p className="text-[9px] text-muted-foreground">{desc}</p>
                                </div>
                                <Select
                                  value={value}
                                  onValueChange={(v) => setFocusTier(tier, v)}
                                >
                                  <SelectTrigger className="h-8 text-xs flex-1" data-testid={`focus-tier-${tier}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {!required && <SelectItem value="none">— None —</SelectItem>}
                                    {available.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <Separator />

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
                            {result ? "Regenerate" : "Generate Background"}
                          </>
                        )}
                      </Button>

                      <div>
                        <button
                          type="button"
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-1"
                          data-testid="button-toggle-advanced"
                        >
                          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          Advanced
                        </button>
                        {showAdvanced && (
                          <div className="mt-2 space-y-4">
                            <FormField
                              control={form.control}
                              name="customPrompt"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-xs font-semibold flex items-center gap-2">
                                    <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    Additional Instructions
                                  </FormLabel>
                                  <FormControl>
                                    <Textarea
                                      {...field}
                                      placeholder="e.g. rainy evening atmosphere, neon reflections..."
                                      className="text-xs resize-none"
                                      rows={2}
                                      data-testid="textarea-custom-prompt"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            <div>
                              <p className="text-[11px] text-muted-foreground mb-1.5">Quick palettes</p>
                              <div className="grid grid-cols-3 gap-1">
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
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </form>
            </Form>
          </div>
        </div>
      </div>

      {result && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full border border-border bg-background/80 backdrop-blur-md shadow-lg">
            <Button
              type="button"
              size="sm"
              className="h-9 px-5 text-sm font-semibold rounded-full"
              disabled={mutation.isPending}
              onClick={() => form.handleSubmit(onSubmit)()}
              data-testid="button-sticky-regenerate"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
