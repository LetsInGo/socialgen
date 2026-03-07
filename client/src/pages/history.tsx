import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type GeneratedImage, type ImageGenerationConfig } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Trash2, History, Eye, Copy, Calendar, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const ASPECT_RATIO_CSS: Record<string, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  "9:16": "aspect-[9/16]",
  "4:5": "aspect-[4/5]",
  "3:2": "aspect-[3/2]",
  "2:3": "aspect-[2/3]",
  "21:9": "aspect-[21/9]",
};

function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function ImageCard({ image, onDelete, onPreview }: {
  image: GeneratedImage;
  onDelete: (id: number) => void;
  onPreview: (image: GeneratedImage) => void;
}) {
  const config = image.config as ImageGenerationConfig;
  const ratio = config?.aspectRatio || "16:9";
  const aspectClass = ASPECT_RATIO_CSS[ratio] || "aspect-video";

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = `data:${image.mimeType};base64,${image.imageData}`;
    const r = ratio.replace(":", "x");
    link.download = `nanabana-${r}-${image.id}.png`;
    link.click();
  };

  return (
    <div className="group rounded-lg border border-border overflow-hidden bg-card hover-elevate">
      <div className={cn("relative w-full overflow-hidden bg-muted", aspectClass)}>
        <img
          src={`data:${image.mimeType};base64,${image.imageData}`}
          alt={`Generated background ${image.id}`}
          className="w-full h-full object-cover"
          data-testid={`img-history-${image.id}`}
          loading="lazy"
        />
        <div
          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2"
          style={{ visibility: "visible" }}
        >
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
            <Button
              size="icon"
              variant="outline"
              className="bg-background/80 backdrop-blur-sm"
              onClick={() => onPreview(image)}
              data-testid={`button-preview-${image.id}`}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="bg-background/80 backdrop-blur-sm"
              onClick={downloadImage}
              data-testid={`button-download-${image.id}`}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="bg-background/80 backdrop-blur-sm"
              onClick={() => onDelete(image.id)}
              data-testid={`button-delete-${image.id}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="text-xs">
            {ratio}
          </Badge>
          {config?.model === "gemini-3-pro-image-preview" && (
            <Badge className="text-xs">Pro</Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Layers className="h-3 w-3" />
          <span className="truncate">{config?.industry || "Unknown"}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>{formatDate(image.createdAt)}</span>
        </div>
        {config?.primaryColor && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm border border-border flex-shrink-0" style={{ backgroundColor: config.primaryColor }} />
            {config?.secondaryColor && (
              <div className="w-3 h-3 rounded-sm border border-border flex-shrink-0" style={{ backgroundColor: config.secondaryColor }} />
            )}
            {config?.accentColor && (
              <div className="w-3 h-3 rounded-sm border border-border flex-shrink-0" style={{ backgroundColor: config.accentColor }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewDialog({ image, onClose }: { image: GeneratedImage | null; onClose: () => void }) {
  const { toast } = useToast();
  if (!image) return null;

  const config = image.config as ImageGenerationConfig;

  const downloadImage = () => {
    const link = document.createElement("a");
    link.href = `data:${image.mimeType};base64,${image.imageData}`;
    const ratio = (config?.aspectRatio || "16x9").replace(":", "x");
    link.download = `nanabana-${ratio}-${image.id}.png`;
    link.click();
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(image.prompt);
    toast({ title: "Prompt copied to clipboard" });
  };

  return (
    <Dialog open={!!image} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Image Preview — #{image.id}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <img
            src={`data:${image.mimeType};base64,${image.imageData}`}
            alt={`Generated background ${image.id}`}
            className="w-full rounded-md border border-border"
            data-testid="img-preview-dialog"
          />
          <div className="flex flex-wrap gap-2">
            {config?.aspectRatio && <Badge variant="secondary">{config.aspectRatio}</Badge>}
            {config?.industry && <Badge variant="outline">{config.industry}</Badge>}
            {config?.style && <Badge variant="outline">{config.style}</Badge>}
            {config?.city && <Badge variant="outline">{config.city}</Badge>}
          </div>
          <div className="flex gap-2">
            <Button variant="default" onClick={downloadImage} data-testid="button-dialog-download">
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" onClick={copyPrompt} data-testid="button-dialog-copy-prompt">
              <Copy className="h-4 w-4" />
              Copy Prompt
            </Button>
          </div>
          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground font-mono leading-relaxed max-h-40 overflow-y-auto">
            {image.prompt}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function HistoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [previewImage, setPreviewImage] = useState<GeneratedImage | null>(null);

  const { data: images, isLoading } = useQuery<GeneratedImage[]>({
    queryKey: ["/api/history"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/history/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/history"] });
      toast({ title: "Image deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete image", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              Generation History
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {images ? `${images.length} image${images.length !== 1 ? "s" : ""} generated` : "Your previous generations"}
            </p>
          </div>
          <Link href="/">
            <Button data-testid="button-go-generate">
              New Generation
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="w-full aspect-video rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : images && images.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                onDelete={(id) => deleteMutation.mutate(id)}
                onPreview={setPreviewImage}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <History className="h-9 w-9 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-lg font-semibold">No images yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Generate your first social background to see it here
              </p>
            </div>
            <Link href="/">
              <Button data-testid="button-go-generate-empty">
                Generate Now
              </Button>
            </Link>
          </div>
        )}
      </div>

      <PreviewDialog image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
