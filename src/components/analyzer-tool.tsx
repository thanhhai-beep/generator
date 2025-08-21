
"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  XCircle,
  FileText,
  Play,
  RefreshCw,
  Square,
} from "lucide-react";

import type { AnalysisResult } from "@/app/actions";
import { analyzeDomains } from "@/lib/server-actions";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000; // 2 seconds

export function AnalyzerTool() {
  const [isProcessing, setIsProcessing] = useState(false); // For individual batch processing
  const [isAutoRunning, setIsAutoRunning] = useState(false); // For the overall automated process
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [domains, setDomains] = useState<string>("");
  const [progressText, setProgressText] = useState("");
  const [allDomainsToAnalyze, setAllDomainsToAnalyze] = useState<string[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [reanalysisCount, setReanalysisCount] = useState(0);

  const [filterText, setFilterText] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { toast } = useToast();

  const processBatch = useCallback(async () => {
    const batchStart = currentBatchIndex * BATCH_SIZE;
    const batchEnd = batchStart + BATCH_SIZE;
    const batch = allDomainsToAnalyze.slice(batchStart, batchEnd);

    if (batch.length === 0) {
      return;
    }

    setIsProcessing(true);
    
    try {
      const batchResults = await analyzeDomains(batch.join("\n"));
      setResults((prev) => [...prev, ...batchResults]);
    } catch (error: any) {
      toast({
        title: `Error processing batch ${currentBatchIndex + 1}`,
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
      const errorResults = batch.map((domain) => ({
        domain,
        status: 0,
        statusText: "Processing Error",
        title: `Failed to analyze: ${error.message || "Unknown error"}`,
      }));
      setResults((prev) => [...prev, ...errorResults]);
    }

    setCurrentBatchIndex(prev => prev + 1);
    setIsProcessing(false);
  }, [allDomainsToAnalyze, currentBatchIndex, toast]);

  const handleStartAnalysis = () => {
    const allDomains = domains.split("\n").map((d) => d.trim()).filter(Boolean);
    if (allDomains.length === 0) {
        toast({ title: 'No Domains', description: 'Please enter at least one domain.', variant: 'destructive' });
        return;
    }

    setAllDomainsToAnalyze(allDomains);
    setResults([]);
    setCurrentBatchIndex(0);
    setReanalysisCount(0);
    setIsAutoRunning(true);
  };
  
  const handleStopAnalysis = () => {
    setIsAutoRunning(false);
    setProgressText("Analysis stopped by user.");
  };

  const handleReanalyzeErrors = useCallback(() => {
    const errorDomains = results
      .filter(r => getStatusCategory(r.status) === 'error')
      .map(r => r.domain);
      
    if (errorDomains.length === 0) {
      toast({
        title: "No errors to re-analyze",
        description: "All domains were analyzed successfully or were redirects.",
      });
      setIsAutoRunning(false); // Stop if nothing to do
      return;
    }
    
    // Keep successful/redirect results, remove error results from view
    const successfulResults = results.filter(r => getStatusCategory(r.status) !== 'error');
    setResults(successfulResults);

    setAllDomainsToAnalyze(errorDomains);
    setCurrentBatchIndex(0);
    setReanalysisCount(prev => prev + 1);
    setIsAutoRunning(true); // Ensure it continues running
  }, [results, toast]);


  useEffect(() => {
    if (!isAutoRunning) {
      return;
    }

    const totalBatches = Math.ceil(allDomainsToAnalyze.length / BATCH_SIZE);
    const analysisComplete = currentBatchIndex >= totalBatches;

    if (!analysisComplete) {
       setProgressText(`Processing batch ${currentBatchIndex + 1}/${totalBatches}...`);
       const timer = setTimeout(() => {
         processBatch();
       }, BATCH_DELAY_MS);
       return () => clearTimeout(timer);
    } else {
        if (reanalysisCount < 1) {
            setProgressText("Initial analysis complete. Checking for errors to re-analyze...");
            const timer = setTimeout(() => {
                handleReanalyzeErrors();
            }, BATCH_DELAY_MS);
            return () => clearTimeout(timer);
        } else {
            setProgressText("Analysis complete. All retries finished.");
            setIsAutoRunning(false);
        }
    }
  }, [isAutoRunning, currentBatchIndex, allDomainsToAnalyze.length, processBatch, reanalysisCount, handleReanalyzeErrors]);


  const handleExport = () => {
    if (results.length === 0) return;
    const header = "Domain,Title,Status,StatusText\n";
    const csvContent = results
      .map(
        (row) =>
          `"${row.domain}","${row.title.replace(/"/g, '""')}","${
            row.status
          }","${row.statusText}"`
      )
      .join("\n");
    const csv = header + csvContent;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "web_insight_analysis.csv");
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getStatusCategory = (status: number) => {
      if (status >= 200 && status < 300) return 'success';
      if (status >= 300 && status < 400) return 'redirect';
      return 'error';
  };

  const filteredResults = useMemo(() => {
    return results.filter(result => {
        const matchesText = result.domain.toLowerCase().includes(filterText.toLowerCase());
        const matchesStatus = filterStatus === 'all' || getStatusCategory(result.status) === filterStatus;
        return matchesText && matchesStatus;
    });
  }, [results, filterText, filterStatus]);


  const getStatusBadge = (status: number) => {
    const category = getStatusCategory(status);
    if (category === 'success') {
      return (
        <Badge variant="secondary">
          <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
          Success
        </Badge>
      );
    }
    if (category === 'redirect') {
      return (
        <Badge variant="secondary">
          <AlertCircle className="mr-2 h-4 w-4 text-yellow-500" />
          Redirect
        </Badge>
      );
    }
    if (category === 'error') {
      return (
        <Badge variant="destructive">
          <XCircle className="mr-2 h-4 w-4" />
          Error
        </Badge>
      );
    }
    return <Badge variant="outline">Unknown</Badge>;
  };
  
  const isBusy = isAutoRunning;
  const totalDomains = allDomainsToAnalyze.length;
  const processedDomains = results.length;
  const progress = totalDomains > 0 ? (processedDomains / (totalDomains + (totalDomains - results.filter(r => getStatusCategory(r.status) !== 'error').length))) * 100 : 0;
  
  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Domain Analysis</CardTitle>
          <CardDescription>
            Enter domains manually. The tool will automatically analyze them in batches and retry any failures once.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                <Textarea
                  placeholder={"example.com\ngoogle.com\nnextjs.org"}
                  className="min-h-40 text-base"
                  value={domains}
                  onChange={(e) => {
                      setDomains(e.target.value);
                      if (isAutoRunning) handleStopAnalysis();
                      setAllDomainsToAnalyze([]);
                      setResults([]);
                      setProgressText("");
                  }}
                  disabled={isBusy}
                />
                <div className="flex items-center gap-4">
                  {!isAutoRunning ? (
                    <Button onClick={handleStartAnalysis} disabled={!domains.trim()}>
                      <Play className="mr-2 h-4 w-4" />
                      Start Analysis
                    </Button>
                  ) : (
                    <Button onClick={handleStopAnalysis} variant="destructive">
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  )}
                </div>
            </div>
        </CardContent>
      </Card>

      {(isAutoRunning || results.length > 0) && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Analysis Results</CardTitle>
                <CardDescription>
                   {isAutoRunning
                    ? `Analyzed ${results.length} of ${allDomainsToAnalyze.length} domains...`
                    : `Analysis complete. `}
                   {results.length > 0 && `Showing ${filteredResults.length} results.`}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                 <Button
                  onClick={handleReanalyzeErrors}
                  variant="outline"
                  size="sm"
                  disabled={isAutoRunning || !results.some(r => getStatusCategory(r.status) === 'error')}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Re-analyze Errors Manually
                </Button>
                <Button
                  onClick={handleExport}
                  variant="outline"
                  size="sm"
                  disabled={isAutoRunning || results.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isAutoRunning && (
              <div className="mb-4 space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressText}
                </p>
              </div>
            )}
            {results.length > 0 && (
              <>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                    placeholder="Filter domains..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="max-w-full sm:max-w-xs"
                    disabled={isAutoRunning}
                  />
                  <Select
                    value={filterStatus}
                    onValueChange={setFilterStatus}
                    disabled={isAutoRunning}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="redirect">Redirect</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="max-h-[500px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-[250px]">Domain</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="w-[150px]">Status Code</TableHead>
                        <TableHead className="w-[150px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredResults.map((result, index) => (
                        <TableRow key={`${result.domain}-${index}`}>
                          <TableCell className="font-medium">
                            {result.domain}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {result.title}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {result.status > 0 ? result.status : "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(result.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
