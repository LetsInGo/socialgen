import { useState, useCallback } from "react";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Wand2, Download, Copy, Loader2, Sparkles, ChevronDown, ChevronUp, Eye, EyeOff, Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const INDUSTRIES = [
  "Technology / SaaS",
  "Cybersecurity",
  "Finance / Fintech",
  "Healthcare / Biotech",
  "Fashion / Luxury",
  "Food & Beverage",
  "Education",
  "Real Estate",
  "Travel & Tourism",
  "Sports & Fitness",
  "Creative / Design",
  "Music & Entertainment",
  "Non-profit / Social",
  "Automotive",
  "E-commerce / Retail",
];

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 — Widescreen / YouTube / LinkedIn" },
  { value: "9:16", label: "9:16 — Story / Reel / TikTok" },
  { value: "1:1", label: "1:1 — Square / Instagram Post" },
  { value: "4:5", label: "4:5 — Portrait / Instagram" },
  { value: "3:2", label: "3:2 — Landscape / Twitter Banner" },
  { value: "2:3", label: "2:3 — Portrait / Pinterest" },
  { value: "21:9", label: "21:9 — Ultra-wide / Website Hero" },
];

const STYLES = [
  { value: "photorealistic", label: "Photorealistic" },
  { value: "illustration", label: "Illustration" },
  { value: "abstract", label: "Abstract Art" },
  { value: "minimalist", label: "Minimalist" },
  { value: "gradient", label: "Gradient" },
  { value: "editorial", label: "Editorial" },
];

const MODELS = [
  { value: "gemini-2.5-flash-image", label: "Nano Banana — Fast", badge: "Fast" },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro — High Fidelity", badge: "Pro" },
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

interface GeneratedResult {
  id: number;
  imageData: string;
  mimeType: string;
  prompt: string;
  createdAt: string;
}

interface ScrapeResult {
  eventName: string;
  industry: string;
  style: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  city: string;
  customPrompt: string;
  summary: string;
}

export default function GeneratorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [eventUrl, setEventUrl] = useState("");
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);

  const form = useForm<ImageGenerationConfig>({
    resolver: zodResolver(imageGenerationConfigSchema),
    defaultValues: {
      industry: "Technology / SaaS",
      aspectRatio: "16:9",
      style: "gradient",
      primaryColor: "#0A84FF",
      secondaryColor: "#0B1F3B",
      accentColor: "#64D2FF",
      city: "",
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
      if (!res.ok) {
        throw new Error(data.error || "Failed to analyze website");
      }
      return data as ScrapeResult;
    },
    onSuccess: (data) => {
      setScrapeResult(data);
      if (data.industry) form.setValue("industry", data.industry);
      if (data.style) form.setValue("style", data.style);
      if (data.primaryColor) form.setValue("primaryColor", data.primaryColor);
      if (data.secondaryColor) form.setValue("secondaryColor", data.secondaryColor);
      if (data.accentColor) form.setValue("accentColor", data.accentColor);
      if (data.city) form.setValue("city", data.city);
      if (data.customPrompt) form.setValue("customPrompt", data.customPrompt);
      if (data.city || data.customPrompt) setShowAdvanced(true);
      toast({
        title: "Website analyzed",
        description: data.eventName
          ? `Extracted details from "${data.eventName}"`
          : "Form auto-filled from website data",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Could not analyze website",
        description: error.message || "Check the URL and try again.",
        variant: "destructive",
      });
    },
  });

  const handleScrape = () => {
    if (!eventUrl.trim()) {
      toast({ title: "Enter a URL first", variant: "destructive" });
      return;
    }
    scrapeMutation.mutate(eventUrl.trim());
  };

  const mutation = useMutation({
    mutationFn: async (data: ImageGenerationConfig) => {
      const res = await apiRequest("POST", "/api/generate", data);
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      toast({
        title: "Image generated!",
        description: "Your social background is ready.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ImageGenerationConfig) => {
    mutation.mutate(data);
  };

  const applyPalette = (palette: typeof PRESET_PALETTES[0]) => {
    form.setValue("primaryColor", palette.primary);
    form.setValue("secondaryColor", palette.secondary);
    form.setValue("accentColor", palette.accent);
  };

  const downloadImage = useCallback(() => {
    if (!result) return;
    const link = document.createElement("a");
    link.href = `data:${result.mimeType};base64,${result.imageData}`;
    const ratio = form.getValues("aspectRatio").replace(":", "x");
    link.download = `nanabana-${ratio}-${result.id}.png`;
    link.click();
  }, [result, form]);

  const copyPrompt = useCallback(() => {
    if (!result?.prompt) return;
    navigator.clipboard.writeText(result.prompt);
    toast({ title: "Prompt copied to clipboard" });
  }, [result, toast]);

  const selectedRatio = form.watch("aspectRatio");

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Generate Background</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure your parameters and generate production-ready social media background images
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
          {/* Config Panel */}
          <div className="space-y-4">
            {/* Event URL Input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  Event / Brand URL
                </CardTitle>
                <CardDescription className="text-xs">
                  Paste a website URL to auto-fill colors, industry, location, and style
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2">
                  <Input
                    value={eventUrl}
                    onChange={(e) => setEventUrl(e.target.value)}
                    placeholder="e.g. https://io.google/2025"
                    className="text-sm flex-1"
                    data-testid="input-event-url"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleScrape();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleScrape}
                    disabled={scrapeMutation.isPending}
                    data-testid="button-scrape"
                  >
                    {scrapeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                    {scrapeMutation.isPending ? "Analyzing..." : "Analyze"}
                  </Button>
                </div>

                {scrapeResult && (
                  <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{scrapeResult.eventName}</p>
                        {scrapeResult.summary && (
                          <p className="text-xs text-muted-foreground mt-0.5">{scrapeResult.summary}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <Badge variant="secondary" className="text-xs">{scrapeResult.industry}</Badge>
                          {scrapeResult.city && (
                            <Badge variant="outline" className="text-xs">{scrapeResult.city}</Badge>
                          )}
                          <div className="flex gap-0.5 ml-1">
                            <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: scrapeResult.primaryColor }} />
                            <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: scrapeResult.secondaryColor }} />
                            <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: scrapeResult.accentColor }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Model Selection */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Model
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <FormField
                      control={form.control}
                      name="model"
                      render={({ field }) => (
                        <FormItem>
                          <div className="grid grid-cols-1 gap-2">
                            {MODELS.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                data-testid={`model-${m.value}`}
                                onClick={() => field.onChange(m.value)}
                                className={cn(
                                  "flex items-center justify-between px-3 py-2.5 rounded-md border text-left transition-colors",
                                  field.value === m.value
                                    ? "border-primary bg-primary/5 text-foreground"
                                    : "border-border text-muted-foreground"
                                )}
                              >
                                <span className="text-sm font-medium">{m.label}</span>
                                <Badge variant={field.value === m.value ? "default" : "secondary"} className="text-xs">
                                  {m.badge}
                                </Badge>
                              </button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Core Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Content</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Industry</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-industry">
                                <SelectValue placeholder="Select industry" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INDUSTRIES.map((ind) => (
                                <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="style"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-medium">Visual Style</FormLabel>
                          <div className="grid grid-cols-3 gap-1.5">
                            {STYLES.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                data-testid={`style-${s.value}`}
                                onClick={() => field.onChange(s.value)}
                                className={cn(
                                  "px-2 py-1.5 rounded-md border text-xs font-medium transition-colors",
                                  field.value === s.value
                                    ? "border-primary bg-primary/5 text-foreground"
                                    : "border-border text-muted-foreground"
                                )}
                              >
                                {s.label}
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
                          <FormLabel className="text-xs font-medium">Aspect Ratio</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-aspect-ratio">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ASPECT_RATIOS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Color Palette */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Color Palette</CardTitle>
                    <CardDescription className="text-xs">Choose preset or customize individual colors</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div>
                      <p className="text-xs font-medium mb-2 text-muted-foreground">Presets</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {PRESET_PALETTES.map((p) => (
                          <button
                            key={p.name}
                            type="button"
                            data-testid={`palette-${p.name.toLowerCase().replace(" ", "-")}`}
                            onClick={() => applyPalette(p)}
                            className="flex flex-col items-center gap-1.5 p-2 rounded-md border border-border text-xs text-muted-foreground hover-elevate transition-colors"
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

                    <Separator />

                    <div className="space-y-3">
                      <FormField
                        control={form.control}
                        name="primaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between gap-3">
                              <FormLabel className="text-xs font-medium whitespace-nowrap">Primary (~70%)</FormLabel>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={field.value}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="w-8 h-7 rounded cursor-pointer border border-border"
                                  data-testid="color-primary"
                                />
                                <Input
                                  {...field}
                                  className="w-24 h-7 text-xs font-mono uppercase"
                                  data-testid="input-primary-color"
                                />
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="secondaryColor"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between gap-3">
                              <FormLabel className="text-xs font-medium whitespace-nowrap">Secondary (~20%)</FormLabel>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={field.value || "#000000"}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="w-8 h-7 rounded cursor-pointer border border-border"
                                  data-testid="color-secondary"
                                />
                                <Input
                                  {...field}
                                  className="w-24 h-7 text-xs font-mono uppercase"
                                  placeholder="#000000"
                                  data-testid="input-secondary-color"
                                />
                              </div>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="accentColor"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between gap-3">
                              <FormLabel className="text-xs font-medium whitespace-nowrap">Accent (~10%)</FormLabel>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={field.value || "#ffffff"}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="w-8 h-7 rounded cursor-pointer border border-border"
                                  data-testid="color-accent"
                                />
                                <Input
                                  {...field}
                                  className="w-24 h-7 text-xs font-mono uppercase"
                                  placeholder="#ffffff"
                                  data-testid="input-accent-color"
                                />
                              </div>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Advanced Settings */}
                <Card>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
                    data-testid="button-toggle-advanced"
                  >
                    <span>Advanced Options</span>
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showAdvanced && (
                    <CardContent className="pt-0 space-y-4 border-t">
                      <div className="pt-3">
                        <FormField
                          control={form.control}
                          name="city"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">City / Location</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="e.g. Tokyo, New York, Paris..."
                                  className="text-sm"
                                  data-testid="input-city"
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">Incorporate city skyline or landmarks</p>
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="customPrompt"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">Additional Instructions</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="e.g. rainy evening atmosphere, neon reflections, warm bokeh..."
                                className="text-sm resize-none"
                                rows={3}
                                data-testid="textarea-custom-prompt"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  )}
                </Card>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={mutation.isPending}
                  data-testid="button-generate"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Generate Background
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </div>

          {/* Preview Panel */}
          <div className="space-y-4">
            <Card className="overflow-visible">
              <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm font-semibold">Preview</CardTitle>
                  <CardDescription className="text-xs">
                    {result ? "Your generated background" : "Generated image will appear here"}
                  </CardDescription>
                </div>
                {result && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowPrompt(!showPrompt)}
                      data-testid="button-toggle-prompt"
                    >
                      {showPrompt ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPrompt ? "Hide" : "Prompt"}
                    </Button>
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
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className={cn(
                    "w-full rounded-md border border-border overflow-hidden bg-muted/30",
                    ASPECT_RATIO_CSS[selectedRatio] || "aspect-video"
                  )}
                >
                  {mutation.isPending ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full border-4 border-muted animate-spin border-t-primary" />
                        <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">Generating your image...</p>
                        <p className="text-xs text-muted-foreground mt-1">This may take 15–30 seconds</p>
                      </div>
                    </div>
                  ) : result ? (
                    <img
                      src={`data:${result.mimeType};base64,${result.imageData}`}
                      alt="Generated social background"
                      className="w-full h-full object-cover"
                      data-testid="img-generated"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                        <Wand2 className="h-7 w-7 text-muted-foreground/50" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">Ready to generate</p>
                        <p className="text-xs mt-1 opacity-70">Configure settings and click Generate</p>
                      </div>
                    </div>
                  )}
                </div>

                {result && showPrompt && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Generated Prompt</p>
                      <Button size="sm" variant="ghost" onClick={copyPrompt} data-testid="button-copy-prompt">
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </Button>
                    </div>
                    <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground leading-relaxed font-mono max-h-48 overflow-y-auto">
                      {result.prompt}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tips Card */}
            {!result && !mutation.isPending && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Prompt Tips</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {[
                    "Leave generous negative space — your text overlay needs room",
                    "Use a tight palette (3 colors max) for professional results",
                    "Gradient style works best for clean text backgrounds",
                    "Add a city for unique localized imagery with cultural cues",
                    "Nano Banana Pro is best for precision layouts with text inside",
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
