
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Download, Rss, Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { scrapeProthomaloArticles, type ArticleData } from "@/lib/server-actions";

function downloadFile(filename: string, content: string) {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

export default function BangladeshPage() {
  const [articles, setArticles] = useState<ArticleData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFetch = async () => {
    setIsLoading(true);
    setArticles([]);
    try {
      const result = await scrapeProthomaloArticles();
      if (result.success && result.data) {
        setArticles(result.data);
        toast({
          title: "Success",
          description: `Fetched ${result.data.length} articles.`,
        });
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to fetch articles.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "An unexpected error occurred",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (articles.length === 0) {
        toast({ title: "Nothing to export", description: "Fetch some articles first.", variant: "destructive" });
        return;
    }

    const titles = articles.map(a => a.title.replace(/(\r\n|\n|\r)/gm, " ")).join("\n");
    const descs = articles.map(a => a.description.replace(/(\r\n|\n|\r)/gm, " ")).join("\n");
    const contents = articles.map(a => a.content.replace(/(\r\n|\n|\r)/gm, " ")).join("\n");

    downloadFile("title.txt", titles);
    downloadFile("desc.txt", descs);
    downloadFile("content.txt", contents);
    
    toast({ title: "Exported successfully" });
  };
  
  const handleCopyAllContent = () => {
    if (articles.length === 0) {
      toast({ title: "Nothing to copy", description: "Fetch some articles first.", variant: "destructive" });
      return;
    }
    
    const allContent = articles.map(a => a.content.replace(/(\r\n|\n|\r)/gm," ")).join("\n");

    navigator.clipboard.writeText(allContent).then(() => {
      toast({ title: "Copied!", description: `All ${articles.length} article contents copied to clipboard.` });
    }, (err) => {
      toast({ title: "Copy Failed", description: "Could not copy content to clipboard.", variant: "destructive" });
      console.error('Could not copy text: ', err);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bangladesh Content Fetcher</CardTitle>
          <CardDescription>
            Fetch up to 50 of the latest articles from Prothom Alo news portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Alert>
              <Rss className="h-4 w-4" />
              <AlertTitle>How It Works</AlertTitle>
              <AlertDescription>
                This tool scrapes the homepage of Prothom Alo for recent articles, then visits each article page to extract its full content.
              </AlertDescription>
            </Alert>
        </CardContent>
        <CardFooter className="flex-wrap gap-4">
            <Button onClick={handleFetch} disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rss className="mr-2 h-4 w-4" />}
              {isLoading ? 'Fetching...' : 'Fetch Articles'}
            </Button>
             <Button onClick={handleExport} variant="outline" disabled={articles.length === 0 || isLoading}>
              <Download className="mr-2 h-4 w-4" />
              Export as TXT
            </Button>
            <Button onClick={handleCopyAllContent} variant="outline" disabled={articles.length === 0 || isLoading}>
              <Copy className="mr-2 h-4 w-4" />
              Copy All Content
            </Button>
        </CardFooter>
      </Card>
      
      {articles.length > 0 && (
         <Card>
            <CardHeader>
                <CardTitle>Fetched Articles ({articles.length})</CardTitle>
                <CardDescription>Click on an article to view its scraped content.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {articles.map((article) => (
                    <AccordionItem value={article.url} key={article.url}>
                        <AccordionTrigger>
                           <div className="text-left">
                                <p className="font-semibold">{article.title}</p>
                                {article.description && <p className="text-sm text-muted-foreground mt-1">{article.description}</p>}
                           </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div 
                                className="prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: article.content }}
                            />
                        </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
            </CardContent>
         </Card>
      )}
    </div>
  );
}
