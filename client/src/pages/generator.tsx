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

const RANK_LABELS = ["Primary", "Supporting", "Subtle"];

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
  fontFamily?: string | null;
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

  // Step state: 1=extraction, 2=style, 3=focus, 4=generate
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Preview & result
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [previewResult, setPreviewResult] = useState<GeneratedResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedWithModel, setGeneratedWithModel] = useState<string | null>(null);

  // Extraction
  const [eventUrl, setEventUrl] = useState("");
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  // Logo overlay
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [showLogo, setShowLogo] = useState(true);
  const [logoPos, setLogoPos] = useState({ x: 16, y: 16 });
  const [logoSize, setLogoSize] = useState(48);

  // Text overlay
  const [textOverlay, setTextOverlay] = useState("I'm Excited for [Event]");
  const [showTextOverlay, setShowTextOverlay] = useState(false);
  const [textPos, setTextPos] = useState({ x: 50, y: 50 });
  const [textFontSize, setTextFontSize] = useState(28);
  const [textColor, setTextColor] = useState("#ffffff");
  const [overlayFont, setOverlayFont] = useState<string>("");

  // Container size (tracked by ResizeObserver for ratio-aware scaling)
  const [containerWidth, setContainerWidth] = useState(0);
  const prevContainerWidth = useRef(0);

  // Step 4 Advanced panel
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Simplified focus ranking (click order = priority)
  const [rankedFocus, setRankedFocus] = useState<string[]>(["industry"]);
  const updateRankedFocus = (ranked: string[]) => {
    setRankedFocus(ranked);
    form.setValue("focusPrimary", ranked[0] ? [ranked[0]] : ["industry"]);
    form.setValue("focusSecondary", ranked[1] ? [ranked[1]] : []);
    form.setValue("focusTertiary", ranked[2] ? [ranked[2]] : []);
  };
  const toggleFocusItem = (value: string) => {
    setRankedFocus((prev) => {
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : prev.length < 3 ? [...prev, value] : prev;
      form.setValue("focusPrimary", next[0] ? [next[0]] : ["industry"]);
      form.setValue("focusSecondary", next[1] ? [next[1]] : []);
      form.setValue("focusTertiary", next[2] ? [next[2]] : []);
      return next;
    });
  };

  const previewRef = useRef<HTMLDivElement>(null);
  const logoDragging = useRef(false);
  const logoDragOffset = useRef({ x: 0, y: 0 });
  const logoResizing = useRef(false);
  const logoResizeStart = useRef({ x: 0, y: 0, size: 48 });
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
    if (step > 3 && !completedSteps.has(3)) return;
    setActiveStep(activeStep === step ? 0 : step);
  };

  // ResizeObserver: scale logo + font proportionally when ratio changes
  useEffect(() => {
    if (!previewRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        if (prevContainerWidth.current > 0 && newWidth > 0 && Math.abs(newWidth - prevContainerWidth.current) > 2) {
          const scale = newWidth / prevContainerWidth.current;
          setLogoSize((s) => Math.round(Math.max(16, Math.min(300, s * scale))));
          setTextFontSize((s) => Math.round(Math.max(8, Math.min(200, s * scale))));
        }
        if (newWidth > 0) {
          prevContainerWidth.current = newWidth;
          setContainerWidth(newWidth);
        }
      }
    });
    observer.observe(previewRef.current);
    return () => observer.disconnect();
  }, []);

  // Logo dragging
  const handleLogoDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    logoDragging.current = true;
    const rect = (e.target as HTMLElement).closest("[data-overlay]")!.getBoundingClientRect();
    logoDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const onMove = (me: MouseEvent) => {
      if (!logoDragging.current || !previewRef.current) return;
      const containerRect = previewRef.current.getBoundingClientRect();
      setLogoPos({
        x: Math.max(0, Math.min(me.clientX - containerRect.left - logoDragOffset.current.x, containerRect.width - logoSize)),
        y: Math.max(0, Math.min(me.clientY - containerRect.top - logoDragOffset.current.y, containerRect.height - logoSize)),
      });
    };
    const onUp = () => {
      logoDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [logoSize]);

  // Logo resize (corner handle)
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

  // Text dragging
  const handleTextDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    textDragging.current = true;
    const rect = (e.target as HTMLElement).closest("[data-overlay]")!.getBoundingClientRect();
    textDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const onMove = (me: MouseEvent) => {
      if (!textDragging.current || !previewRef.current) return;
      const containerRect = previewRef.current.getBoundingClientRect();
      setTextPos({
        x: Math.max(0, Math.min(me.clientX - containerRect.left - textDragOffset.current.x, containerRect.width - 100)),
        y: Math.max(0, Math.min(me.clientY - containerRect.top - textDragOffset.current.y, containerRect.height - 40)),
      });
    };
    const onUp = () => {
      textDragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

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
      const initRanked = ["industry", ...(data.theme ? ["theme"] : [])];
      updateRankedFocus(initRanked);

      const eventName = data.eventName || "Event";
      setTextOverlay(`I'm Excited for ${eventName}`);
      setShowTextOverlay(true);
      setOverlayFont(data.fontFamily || "");

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

  // Preview generation (Step 1 auto-generate using header graphic focus)
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
    scrapeMutation.mutate(eventUrl.trim());
  };

  // After scrape succeeds, auto-generate a quick preview
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

  const handleCompleteStep3 = () => {
    completeStep(3);
    setActiveStep(4);
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
      completeStep(4);
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
    const hasOverlays = (showLogo && logoSrc) || showTextOverlay;
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
        if (showTextOverlay && textOverlay) {
          const scaledSize = textFontSize * scaleX;
          const fontStack = overlayFont ? `"${overlayFont}", Inter, sans-serif` : "Inter, sans-serif";
          ctx.font = `bold ${scaledSize}px ${fontStack}`;
          ctx.fillStyle = textColor;
          ctx.strokeStyle = "rgba(0,0,0,0.6)";
          ctx.lineWidth = scaledSize * 0.08;
          const maxTextWidth = canvas.width * 0.5;
          canvasWrapText(textOverlay, textPos.x * scaleX, (textPos.y + textFontSize) * scaleY, maxTextWidth, scaledSize * 1.25);
        }
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
  }, [result, form, showLogo, logoSrc, logoPos, logoSize, showTextOverlay, textOverlay, textPos, textFontSize, textColor, overlayFont]);

  const copyPrompt = useCallback(() => {
    if (!result?.prompt) return;
    navigator.clipboard.writeText(result.prompt);
    toast({ title: "Prompt copied to clipboard" });
  }, [result, toast]);

  const displayResult = result || previewResult;

  // Step 1 completion subtitle
  const step1Subtitle = scrapeResult
    ? scrapeResult.eventName || "Website analyzed"
    : undefined;

  // Step 2 completion subtitle
  const currentStyle = form.watch("style");
  const styleObj = STYLES.find((s) => s.value === currentStyle);
  const step2Subtitle = completedSteps.has(2) ? styleObj?.label : undefined;

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6">

          {/* ===== PREVIEW PANEL (LEFT) ===== */}
          <div className="space-y-3 order-2 xl:order-1">
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
                    src={`data:${displayResult.mimeType};base64,${displayResult.imageData}`}
                    alt="Generated social background"
                    className="w-full h-full object-cover"
                    data-testid="img-generated"
                  />
                  {/* Logo overlay — draggable + resizable */}
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
                      {/* Resize handle */}
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
                  {/* Text overlay — draggable, wraps at 50% */}
                  {showTextOverlay && textOverlay && (
                    <div
                      data-overlay="text"
                      className="absolute cursor-grab active:cursor-grabbing group select-none"
                      style={{ left: textPos.x, top: textPos.y, maxWidth: containerWidth > 0 ? containerWidth * 0.5 : "50%" }}
                      onMouseDown={handleTextDragStart}
                      data-testid="text-overlay"
                    >
                      <p
                        style={{
                          fontSize: textFontSize,
                          color: textColor,
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
                        data-testid="text-overlay-content"
                      >
                        {textOverlay}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowTextOverlay(false); }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-background/80 border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        data-testid="button-remove-text"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {/* Preview badge */}
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

            {/* Overlay restore buttons */}
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
                {!showTextOverlay && (
                  <button
                    type="button"
                    onClick={() => setShowTextOverlay(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    data-testid="button-show-text"
                  >
                    <Type className="h-3.5 w-3.5" />
                    Show text overlay
                  </button>
                )}
              </div>
            )}

            {/* Pro Upsell */}
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

          {/* ===== STEPPER PANEL (RIGHT) ===== */}
          <div className="order-1 xl:order-2">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">

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

                      {/* URL Input */}
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
                        <>
                          <Separator />

                          {/* Event info summary */}
                          <div className="space-y-1">
                            <p className="text-xs font-semibold" data-testid="text-event-name">{scrapeResult.eventName}</p>
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

                          {/* Color Palette Selection */}
                          <div>
                            <p className="text-xs font-semibold mb-2">Brand Colors</p>
                            {/* All detected colors swatches */}
                            {scrapeResult.allColors && scrapeResult.allColors.length > 0 && (
                              <div className="mb-3">
                                <p className="text-[10px] text-muted-foreground mb-1.5">All detected colors — click to assign</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {scrapeResult.allColors.map((c, i) => (
                                    <div key={i} className="relative group">
                                      <button
                                        type="button"
                                        className="w-7 h-7 rounded border border-border hover:scale-110 transition-transform"
                                        style={{ backgroundColor: c.hex }}
                                        title={c.hex}
                                        data-testid={`detected-color-${i}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Color role pickers */}
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

                          <Separator />

                          {/* Editable extracted fields */}
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

                          {/* Text overlay editor */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold flex items-center gap-1.5">
                                <Type className="h-3.5 w-3.5" /> Text Overlay
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowTextOverlay(!showTextOverlay)}
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded border transition-colors",
                                  showTextOverlay
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-muted-foreground/30"
                                )}
                                data-testid="button-toggle-text-overlay"
                              >
                                {showTextOverlay ? "Visible" : "Hidden"}
                              </button>
                            </div>
                            <div className="space-y-2">
                              <Input
                                value={textOverlay}
                                onChange={(e) => setTextOverlay(e.target.value)}
                                placeholder="I'm Excited for [Event]"
                                className="text-xs h-8"
                                data-testid="input-text-overlay"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1">Font size</p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setTextFontSize((s) => Math.max(10, s - 2))}
                                      className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                                      data-testid="button-font-decrease"
                                    >
                                      <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="text-xs font-mono w-8 text-center" data-testid="text-font-size">{textFontSize}</span>
                                    <button
                                      type="button"
                                      onClick={() => setTextFontSize((s) => Math.min(96, s + 2))}
                                      className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                                      data-testid="button-font-increase"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground mb-1">Color</p>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      value={textColor}
                                      onChange={(e) => setTextColor(e.target.value)}
                                      className="w-6 h-6 rounded cursor-pointer border border-border"
                                      data-testid="input-text-color"
                                    />
                                    <Input
                                      value={textColor}
                                      onChange={(e) => setTextColor(e.target.value)}
                                      className="flex-1 h-6 text-[10px] font-mono uppercase px-1.5"
                                      data-testid="input-text-color-hex"
                                    />
                                  </div>
                                </div>
                              </div>
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
                            onClick={handleCompleteStep1}
                            data-testid="button-step1-continue"
                          >
                            <Check className="h-4 w-4" />
                            Continue to Style
                          </Button>
                        </>
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

                {/* ====== STEP 2: STYLE ====== */}
                <div className="border border-border rounded-lg overflow-hidden" data-testid="step-2">
                  <StepHeader
                    stepNum={2}
                    title="Choose Style"
                    subtitle={step2Subtitle}
                    isComplete={completedSteps.has(2)}
                    isActive={activeStep === 2}
                    isLocked={!completedSteps.has(1) && activeStep !== 2}
                    onClick={() => goToStep(2)}
                  />
                  {activeStep === 2 && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">
                      <FormField
                        control={form.control}
                        name="style"
                        render={({ field }) => (
                          <FormItem>
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
                                  {/* Visual preview swatch */}
                                  <div className={cn("h-14 w-full bg-gradient-to-br", s.gradient, "relative flex items-center justify-center")}>
                                    <div className="absolute inset-0 opacity-20">
                                      {s.value === "photorealistic" && (
                                        <div className="w-full h-full" style={{ backgroundImage: "radial-gradient(ellipse at 70% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)" }} />
                                      )}
                                      {s.value === "abstract" && (
                                        <div className="w-full h-full" style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.1) 5px, rgba(255,255,255,0.1) 10px)" }} />
                                      )}
                                      {s.value === "minimalist" && (
                                        <div className="absolute bottom-2 right-2 w-6 h-6 border-2 border-white/30 rounded-sm" />
                                      )}
                                      {s.value === "gradient" && (
                                        <div className="w-full h-full" style={{ backgroundImage: `radial-gradient(circle at 30% 70%, ${s.accent}88, transparent 60%)` }} />
                                      )}
                                      {s.value === "editorial" && (
                                        <div className="absolute left-2 top-1 w-1 h-12 rounded-full" style={{ backgroundColor: s.accent }} />
                                      )}
                                    </div>
                                    {field.value === s.value && (
                                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
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

                      <Button
                        type="button"
                        className="w-full h-9"
                        onClick={handleCompleteStep2}
                        data-testid="button-step2-continue"
                      >
                        <Check className="h-4 w-4" />
                        Continue to Focus
                      </Button>
                    </div>
                  )}
                </div>

                {/* ====== STEP 3: FOCUS & COLOR PROMINENCE ====== */}
                <div className="border border-border rounded-lg overflow-hidden" data-testid="step-3">
                  <StepHeader
                    stepNum={3}
                    title="Focus & Color Prominence"
                    subtitle={completedSteps.has(3) ? "Configured" : undefined}
                    isComplete={completedSteps.has(3)}
                    isActive={activeStep === 3}
                    isLocked={!completedSteps.has(2) && activeStep !== 3}
                    onClick={() => goToStep(3)}
                  />
                  {activeStep === 3 && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">

                      {/* Focus Priority — simplified ranked picker */}
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Crosshair className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-semibold">Focus Priority</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-3">Click to select up to 3. First selected = primary focus.</p>
                        <div className="flex flex-wrap gap-2" data-testid="focus-ranked-picker">
                          {FOCUS_OPTIONS.map((opt) => {
                            const rank = rankedFocus.indexOf(opt.value);
                            const selected = rank !== -1;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => toggleFocusItem(opt.value)}
                                data-testid={`focus-option-${opt.value}`}
                                className={cn(
                                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-medium transition-all select-none",
                                  selected
                                    ? "border-primary bg-primary/10 text-foreground"
                                    : rankedFocus.length >= 3
                                    ? "border-border text-muted-foreground/40 cursor-not-allowed"
                                    : "border-border text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground"
                                )}
                              >
                                {selected && (
                                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
                                    {rank + 1}
                                  </span>
                                )}
                                {opt.label}
                                {selected && (
                                  <span className="text-[9px] text-muted-foreground ml-0.5">{RANK_LABELS[rank]}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <Separator />

                      {/* Color Prominence */}
                      <div>
                        <FormField
                          control={form.control}
                          name="colorProminence"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center justify-between mb-2">
                                <FormLabel className="text-xs font-semibold flex items-center gap-2">
                                  <Palette className="h-3.5 w-3.5 text-muted-foreground" />
                                  Brand Color Prominence
                                </FormLabel>
                                <span className="text-[10px] text-muted-foreground">
                                  {(field.value as number) <= 20 ? "Subtle tint" :
                                   (field.value as number) <= 40 ? "Soft presence" :
                                   (field.value as number) <= 60 ? "Balanced" :
                                   (field.value as number) <= 80 ? "Bold" : "Color dominant"}
                                </span>
                              </div>
                              <Slider min={0} max={100} step={5} value={[field.value as number]} onValueChange={([v]) => field.onChange(v)} data-testid="slider-colorProminence" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      {/* Additional Instructions */}
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

                      <Button
                        type="button"
                        className="w-full h-9"
                        onClick={handleCompleteStep3}
                        data-testid="button-step3-continue"
                      >
                        <Check className="h-4 w-4" />
                        Continue to Generate
                      </Button>
                    </div>
                  )}
                </div>

                {/* ====== STEP 4: GENERATE ====== */}
                <div className="border border-border rounded-lg overflow-hidden" data-testid="step-4">
                  <StepHeader
                    stepNum={4}
                    title="Generate Image"
                    subtitle={result ? "Image generated" : undefined}
                    isComplete={completedSteps.has(4)}
                    isActive={activeStep === 4}
                    isLocked={!completedSteps.has(3) && activeStep !== 4}
                    onClick={() => goToStep(4)}
                  />
                  {activeStep === 4 && (
                    <div className="px-4 pb-4 border-t border-border pt-4 space-y-4">

                      {/* Model Selection */}
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

                      {/* Generate Button */}
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

                      {/* Advanced — palette presets */}
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
                          <div className="mt-2">
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

      {/* Sticky Regenerate bar — visible after first generation */}
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
