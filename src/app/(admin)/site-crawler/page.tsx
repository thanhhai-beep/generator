
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Webhook, Link as LinkIcon, Download, Copy, Cpu, Bot, CircleHelp, ChevronLeft, ChevronRight, List, Search } from "lucide-react";
import { crawlSite, processCrawledData, categorizeCrawledDataLocally, type CrawlResultChild } from '@/lib/server-actions';
import { ALL_CATEGORIES } from '@/lib/categories';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const ITEMS_PER_PAGE = 20;
const PROCESSING_BATCH_SIZE = 5;

export default function SiteCrawlerPage() {
  const [targetUrl, setTargetUrl] = useState('https://theporndude.com/zh');
  const [maxCards, setMaxCards] = useState(10);
  
  const [isCrawling, setIsCrawling] = useState(false);
  const [isProcessingMeta, setIsProcessingMeta] = useState(false);
  const [isCategorizing, setIsCategorizing] = useState(false);
  
  const [results, setResults] = useState<CrawlResultChild[]>([]);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();

  const handleCrawl = async () => {
    if (!targetUrl) {
      toast({ title: "URL is missing", description: "Please enter a URL to crawl.", variant: "destructive" });
      return;
    }
    if (maxCards <= 0) {
      toast({ title: "Invalid number", description: "Please enter a number of cards greater than 0.", variant: "destructive" });
      return;
    }

    setIsCrawling(true);
    setResults([]);
    setCurrentPage(1);
    setProgress(50);
    setProgressText('Crawling... Please wait.');

    try {
      const result = await crawlSite(targetUrl, maxCards);

      if (result.success && result.data) {
        const flattenedResults = result.data.flatMap(cat => cat.children.map(child => ({ ...child, categoryInfo: { name: cat.cate_name, url: cat.cate_url }})));
        setResults(flattenedResults);
        toast({ title: "Crawl Complete", description: `Found ${flattenedResults.length} total items.` });
      } else {
        toast({ title: "Crawl Failed", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "An unexpected error occurred", description: error.message, variant: 'destructive' });
    } finally {
      setIsCrawling(false);
      setProgress(0);
      setProgressText('');
    }
  };

  const processInBatches = async (
    itemsToProcess: CrawlResultChild[],
    processingFn: (batch: CrawlResultChild[]) => Promise<{ success: boolean; data?: CrawlResultChild[]; message: string }>,
    setStateFn: React.Dispatch<React.SetStateAction<boolean>>,
    progressTextPrefix: string
  ) => {
    setStateFn(true);
    setProgress(0);
    
    const totalItems = itemsToProcess.length;
    let processedItemsCount = 0;
    
    const resultsMap = new Map(results.map(r => [`${r.url}-${r.title}`, r]));

    for (let i = 0; i < totalItems; i += PROCESSING_BATCH_SIZE) {
        const batch = itemsToProcess.slice(i, i + PROCESSING_BATCH_SIZE);
        const currentBatchNumber = Math.ceil((i + 1) / PROCESSING_BATCH_SIZE);
        const totalBatches = Math.ceil(totalItems / PROCESSING_BATCH_SIZE);
        setProgressText(`${progressTextPrefix} - Processing batch ${currentBatchNumber} of ${totalBatches}...`);

        try {
            const result = await processingFn(batch);
            
            if (result.success && result.data) {
                result.data.forEach(processedChild => {
                    const key = `${processedChild.url}-${processedChild.title}`;
                    if (resultsMap.has(key)) {
                       const existingChild = resultsMap.get(key)!;
                       const updatedChild = { ...existingChild, ...processedChild };
                       resultsMap.set(key, updatedChild);
                    } else {
                       resultsMap.set(key, processedChild);
                    }
                });
            } else {
                 toast({ title: `Batch ${currentBatchNumber} Error`, description: result.message, variant: 'destructive' });
            }

        } catch (error: any) {
             toast({ title: `An unexpected error occurred during batch ${currentBatchNumber}`, description: error.message, variant: 'destructive' });
        }
        
        processedItemsCount += batch.length;
        setProgress((processedItemsCount / totalItems) * 100);
        setResults(Array.from(resultsMap.values()));
    }

    setProgressText(`${progressTextPrefix} - Finished.`);
    toast({ title: "Processing Complete", description: `All ${totalItems} have been processed.` });
    setStateFn(false);
  };


  const handleProcessMeta = async () => {
      const itemsToProcess = results.filter(child => !child.processedSteps.includes('metadata'));
      if (itemsToProcess.length === 0) {
          toast({ title: "Nothing to process", description: "All items have already been processed for metadata." });
          return;
      }
      await processInBatches(itemsToProcess, processCrawledData, setIsProcessingMeta, 'Step 2: Metadata');
  };

  const handleCategorize = async () => {
      const itemsToProcess = results.filter(child => child.processedSteps.includes('metadata') && !child.processedSteps.includes('categorized'));
      if (itemsToProcess.length === 0) {
          toast({ title: "Nothing to categorize", description: "All items have already been categorized or are missing metadata." });
          return;
      }
      await processInBatches(itemsToProcess, categorizeCrawledDataLocally, setIsCategorizing, 'Step 3: Categorize Locally');
  };


  const handleExportJson = () => {
    const itemsToExport = results.filter(child => child.suggestedCategories && child.suggestedCategories.length > 0);
    
    if (itemsToExport.length === 0) {
        toast({ title: "Nothing to export", description: "No items have been successfully categorized yet.", variant: "destructive" });
        return;
    }

    const flattenedResults = itemsToExport.map(child => {
        return {
            url: child.url_site || child.url,
            title: child.title,
            src_img: child.faviconUrl || "",
            img_alt: child.img_alt || "",
            description: child.description || "",
            keywords: child.keywords || "",
            categories: child.suggestedCategories?.map(cat => cat.id) || []
        }
    });

    const jsonString = JSON.stringify(flattenedResults, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "crawled_data_final.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleCopyJson = () => {
    const itemsToCopy = results.filter(child => child.suggestedCategories && child.suggestedCategories.length > 0);

    if (itemsToCopy.length === 0) {
        toast({ title: "Nothing to copy", description: "No items have been successfully categorized yet.", variant: "destructive" });
        return;
    }
    
    const flattenedResults = itemsToCopy.map(child => {
        return {
            url: child.url_site || child.url,
            title: child.title,
            src_img: child.faviconUrl || "",
            img_alt: child.img_alt || "",
            description: child.description || "",
            keywords: child.keywords || "",
            categories: child.suggestedCategories?.map(cat => cat.id) || []
        }
    });

    const jsonString = JSON.stringify(flattenedResults, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
        toast({ title: "Copied!", description: "Final JSON data copied to clipboard." });
    }, () => {
        toast({ title: "Copy Failed", variant: "destructive" });
    });
  };

  const { canProcessMeta, canCategorize } = useMemo(() => {
    if (results.length === 0) return { canProcessMeta: false, canCategorize: false };
    const canProcessMeta = results.some(child => !child.processedSteps.includes('metadata'));
    const canCategorize = results.some(child => child.processedSteps.includes('metadata') && !child.processedSteps.includes('categorized'));
    return { canProcessMeta, canCategorize };
  }, [results]);

  const filteredResults = useMemo(() => {
    const lowercasedQuery = searchQuery.toLowerCase();
    if (!lowercasedQuery) {
      return results;
    }
    return results.filter(child => 
      child.title.toLowerCase().includes(lowercasedQuery) || 
      child.url.toLowerCase().includes(lowercasedQuery)
    );
  }, [results, searchQuery]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredResults.slice(startIndex, endIndex);
  }, [filteredResults, currentPage]);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);


  const isBusy = isCrawling || isProcessingMeta || isCategorizing;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site Crawler &amp; Local Categorizer</CardTitle>
          <CardDescription>
            A 3-step tool to crawl, enrich, and automatically categorize websites using a local keyword dictionary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="target-url">Target URL</Label>
              <Input id="target-url" type="url" placeholder="https://example.com/category/..." value={targetUrl} onChange={e => setTargetUrl(e.target.value)} disabled={isBusy} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-cards">Max Categories</Label>
              <Input id="max-cards" type="number" min="1" value={maxCards} onChange={e => setMaxCards(parseInt(e.target.value, 10))} disabled={isBusy}/>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-4">
          <Button onClick={handleCrawl} disabled={isBusy}>
            {isCrawling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Webhook className="mr-2 h-4 w-4" />}
            {isCrawling ? 'Crawling...' : 'Step 1: Start Crawl'}
          </Button>
          <Button onClick={handleProcessMeta} disabled={isBusy || !canProcessMeta} variant="secondary">
            {isProcessingMeta ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
            {isProcessingMeta ? 'Processing...' : 'Step 2: Process Metadata'}
          </Button>
           <Button onClick={handleCategorize} disabled={isBusy || !canCategorize} variant="secondary">
            {isCategorizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cpu className="mr-2 h-4 w-4" />}
            {isCategorizing ? 'Categorizing...' : 'Step 3: Categorize Locally'}
          </Button>
        </CardFooter>
      </Card>
      
      {(isBusy) && (
        <Card>
            <CardHeader>
                <CardTitle>
                  {isCrawling && 'Crawl in Progress...'}
                  {isProcessingMeta && 'Processing Metadata...'}
                  {isCategorizing && 'Local Categorization in Progress...'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-muted-foreground">{progressText}</p>
                </div>
            </CardContent>
        </Card>
      )}


      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <CardTitle>Crawl Results</CardTitle>
                <CardDescription>Found {results.length} total items. Showing {filteredResults.length} matching results.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsCategoryDialogOpen(true)} variant="outline" size="sm">
                  <List className="mr-2 h-4 w-4" /> View Categories
                </Button>
                <Button onClick={handleCopyJson} variant="outline" size="sm" disabled={isBusy}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Final JSON
                </Button>
                <Button onClick={handleExportJson} variant="outline" size="sm" disabled={isBusy}>
                  <Download className="mr-2 h-4 w-4" /> Export Final JSON
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by title or URL..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        disabled={isBusy}
                    />
                </div>
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Site Info</TableHead>
                            <TableHead>Processing Status</TableHead>
                            <TableHead>Matched Categories</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedResults.map((child, index) => (
                             <TableRow key={`${child.url}-${index}`}>
                                <TableCell>
                                    {child.faviconUrl ? <img src={child.faviconUrl} alt="favicon" className="h-4 w-4 object-contain" /> : <Webhook className="h-4 w-4 text-muted-foreground"/>}
                                </TableCell>
                                <TableCell>
                                    <div className="font-medium">{child.title}</div>
                                    <div className="text-xs text-muted-foreground">
                                        <a href={child.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1.5">
                                            <LinkIcon className="h-3 w-3" />
                                            <span>{child.url}</span>
                                        </a>
                                    </div>
                                    {child.url_site && child.url_site !== child.url && (
                                         <div className="text-xs text-muted-foreground/70">Original: {child.url_site}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap items-center gap-1">
                                        {child.processedSteps.includes('crawled') && <Badge variant="outline"><Webhook className="mr-1.5 h-3 w-3" />Crawled</Badge>}
                                        {child.processedSteps.includes('metadata') && <Badge variant="outline"><Bot className="mr-1.5 h-3 w-3" />Metadata</Badge>}
                                        {child.processedSteps.includes('categorized') && <Badge variant="outline" className="text-primary border-primary/50"><Cpu className="mr-1.5 h-3 w-3" />Categorized</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {child.suggestedCategories && child.suggestedCategories.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {child.suggestedCategories.map(cat => (
                                                <Badge key={cat.id} variant="secondary">{cat.name}</Badge>
                                            ))}
                                        </div>
                                    ) : child.error && child.processedSteps.includes('categorized') ? (
                                        <div className="text-xs text-destructive flex items-center gap-1.5">
                                            <CircleHelp className="h-3 w-3" />
                                            <span>{child.error}</span>
                                        </div>
                                    ) : null}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || isBusy}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || isBusy}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Available Categories</DialogTitle>
            <DialogDescription>
              This is the list of all categories used for local keyword classification.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="space-y-2 pr-4">
              {ALL_CATEGORIES.map(cat => (
                <div key={cat.term_id} className="flex justify-between items-center text-sm p-2 rounded-md border">
                  <span className="font-medium">{cat.name}</span>
                  <Badge variant="outline">ID: {cat.term_id}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

    </div>
  );
}
