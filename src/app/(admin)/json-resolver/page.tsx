
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUp, Copy, Download, Loader2, Link, Combine, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { resolveRedirectsInJson, mergeJsonData } from '@/lib/server-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

function downloadJson(filename: string, jsonString: string, keysToExclude: string[] = []) {
    if (!jsonString) return;
    
    let dataToDownload = jsonString;

    if (keysToExclude.length > 0) {
        try {
            const data = JSON.parse(jsonString);
            if (Array.isArray(data)) {
                const processedData = data.map((item: any) => {
                    const newItem = {...item};
                    keysToExclude.forEach(key => {
                        delete newItem[key];
                    });
                    return newItem;
                });
                dataToDownload = JSON.stringify(processedData, null, 2);
            }
        } catch (error) {
            // If parsing fails, download the original string. The toast will inform the user.
            console.error("Error processing JSON for exclusion:", error);
        }
    }

    const blob = new Blob([dataToDownload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}


function UrlResolver() {
  const [jsonInput, setJsonInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableKeys, setAvailableKeys] = useState<string[]>([]);
  const [keysToExclude, setKeysToExclude] = useState<Set<string>>(new Set(['description']));
  const { toast } = useToast();
  
  const updateJsonOutput = (output: string) => {
    setJsonOutput(output);
    setKeysToExclude(new Set(['description'])); // Reset to default when output changes
    if (output) {
      try {
        const data = JSON.parse(output);
        if (Array.isArray(data) && data.length > 0) {
          setAvailableKeys(Object.keys(data[0]));
        } else {
          setAvailableKeys([]);
        }
      } catch (e) {
        setAvailableKeys([]);
      }
    } else {
      setAvailableKeys([]);
    }
  };


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setJsonInput(content);
        updateJsonOutput('');
      };
      reader.readAsText(file);
    }
  };

  const processFile = async () => {
    if (!jsonInput) {
      toast({ title: 'No JSON data', description: 'Please upload or paste JSON data first.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    updateJsonOutput('');

    try {
        const initialData = JSON.parse(jsonInput);
        const toResolveCount = initialData.filter((item: any) => typeof item.url === 'string' && item.url.includes('pdude.link')).length;
        
        toast({
            title: "Processing started...",
            description: `Found ${toResolveCount} URLs with "pdude.link" to resolve.`,
        });

        const result = await resolveRedirectsInJson(jsonInput);
        
        if (result.success && result.data) {
            updateJsonOutput(result.data);
            toast({
                title: 'Processing Complete',
                description: result.message,
            });
        } else {
            toast({
                title: 'Processing Failed',
                description: result.message,
                variant: 'destructive',
            });
            updateJsonOutput(jsonInput); // Show original content on failure
        }
    } catch (e: any) {
        toast({
            title: 'Invalid JSON',
            description: 'The provided content is not valid JSON.',
            variant: 'destructive',
        });
    }

    setIsLoading(false);
  };

  const handleCopy = () => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput);
    toast({ title: 'Copied to clipboard!' });
  };
  
  const handleToggleExcludeKey = (key: string) => {
    setKeysToExclude(prev => {
        const newSet = new Set(prev);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        return newSet;
    });
  }

  const handleDownload = () => {
    downloadJson('resolved_data.json', jsonOutput);
  };

  const handleDownloadWithExclusions = () => {
    if (!jsonOutput) return;
     try {
        JSON.parse(jsonOutput);
        downloadJson('resolved_data_custom.json', jsonOutput, Array.from(keysToExclude));
    } catch (error) {
        toast({ title: 'Error processing JSON', description: 'Cannot create custom export because the output is not valid JSON.', variant: 'destructive' });
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 h-full">
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>1. Input JSON</CardTitle>
          <CardDescription>Upload a JSON file or paste its content below.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4">
            <div className="relative">
                <Button asChild variant="outline" className="w-full">
                    <label htmlFor="file-upload">
                        <FileUp className="mr-2 h-4 w-4" />
                        Upload JSON File
                    </label>
                </Button>
                <input id="file-upload" type="file" accept=".json" onChange={handleFileChange} className="sr-only" />
            </div>
            <div className="flex-grow flex flex-col">
                <Label htmlFor="json-input" className="mb-2">Or paste content here:</Label>
                <Textarea
                    id="json-input"
                    placeholder='[{"url": "https://pdude.link/...", ...}]'
                    value={jsonInput}
                    onChange={(e) => {
                        setJsonInput(e.target.value);
                        updateJsonOutput('');
                    }}
                    className="flex-grow font-mono text-xs"
                    disabled={isLoading}
                />
            </div>
          <Button onClick={processFile} disabled={isLoading || !jsonInput}>
            {isLoading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                </>
            ) : "Process File"}
          </Button>
        </CardContent>
      </Card>

      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>2. Output</CardTitle>
          <CardDescription>The processed JSON with resolved URLs will appear here.</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-4">
          <div className="flex-grow relative">
            <Textarea
              id="json-output"
              value={jsonOutput}
              readOnly
              className="w-full h-full font-mono text-xs absolute"
              placeholder="Output will be shown here..."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopy} disabled={!jsonOutput} variant="secondary">
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
            <Button onClick={handleDownload} disabled={!jsonOutput} variant="secondary">
              <Download className="mr-2 h-4 w-4" /> Download Full
            </Button>
          </div>
          <div className="space-y-2 p-4 border rounded-lg bg-muted/50">
            <Label>Custom Export: Select columns to exclude</Label>
             {availableKeys.length > 0 ? (
                <>
                    <ScrollArea className="h-32">
                        <div className="grid grid-cols-2 gap-2 p-1">
                            {availableKeys.map(key => (
                                <div key={key} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`exclude-${key}`} 
                                        checked={keysToExclude.has(key)}
                                        onCheckedChange={() => handleToggleExcludeKey(key)}
                                    />
                                    <Label htmlFor={`exclude-${key}`} className="text-sm font-normal cursor-pointer">{key}</Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <Button onClick={handleDownloadWithExclusions} disabled={!jsonOutput} variant="outline" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" /> Download with Exclusions ({keysToExclude.size} selected)
                    </Button>
                </>
             ) : (
                <p className="text-xs text-muted-foreground pt-2">Process a file to see export options.</p>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function JsonMerger() {
  const [jsonWithDesc, setJsonWithDesc] = useState('');
  const [jsonWithCats, setJsonWithCats] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setter(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleMerge = async () => {
    if (!jsonWithDesc || !jsonWithCats) {
      toast({ title: 'Missing JSON data', description: 'Please provide both JSON files to merge.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    setJsonOutput('');

    const result = await mergeJsonData(jsonWithDesc, jsonWithCats);

    if (result.success && result.data) {
        setJsonOutput(result.data);
        toast({
            title: 'Merge Complete',
            description: result.message,
        });
    } else {
        toast({
            title: 'Merge Failed',
            description: result.message,
            variant: 'destructive',
        });
    }

    setIsLoading(false);
  };
  
  const handleCopy = () => {
    if (!jsonOutput) return;
    navigator.clipboard.writeText(jsonOutput);
    toast({ title: 'Copied to clipboard!' });
  };

  const handleDownload = () => {
    downloadJson('merged_data.json', jsonOutput);
  };

  return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
                <CardTitle>1. JSON gốc (chứa mô tả)</CardTitle>
                <CardDescription>Upload or paste the original JSON with descriptions (e.g., the output from the URL Resolver).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Button asChild variant="outline">
                    <label htmlFor="desc-file-upload">
                        <FileUp className="mr-2 h-4 w-4" /> Tải lên
                    </label>
                </Button>
                <input id="desc-file-upload" type="file" accept=".json" onChange={handleFileChange(setJsonWithDesc)} className="sr-only" />
                <Textarea
                    placeholder="Paste the original JSON here..."
                    value={jsonWithDesc}
                    onChange={(e) => setJsonWithDesc(e.target.value)}
                    className="h-48 font-mono text-xs"
                    disabled={isLoading}
                />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle>2. JSON Đã Phân Loại</CardTitle>
                <CardDescription>Upload or paste the JSON that you have added categories to (the one without descriptions).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <Button asChild variant="outline">
                    <label htmlFor="cat-file-upload">
                        <FileUp className="mr-2 h-4 w-4" /> Tải lên
                    </label>
                </Button>
                <input id="cat-file-upload" type="file" accept=".json" onChange={handleFileChange(setJsonWithCats)} className="sr-only" />
                <Textarea
                    placeholder="Paste the categorized JSON here..."
                    value={jsonWithCats}
                    onChange={(e) => setJsonWithCats(e.target.value)}
                    className="h-48 font-mono text-xs"
                    disabled={isLoading}
                />
            </CardContent>
          </Card>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>3. Hợp nhất và Xuất</CardTitle>
                <CardDescription>Merge the two JSON files based on the 'title' field to add the original descriptions back to your categorized data.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button onClick={handleMerge} disabled={isLoading || !jsonWithDesc || !jsonWithCats}>
                    {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <Combine className="mr-2" />}
                    Hợp nhất JSON
                </Button>
                {jsonOutput && (
                    <div className="mt-4 space-y-4">
                        <Label>Kết quả hợp nhất:</Label>
                         <div className="relative h-64">
                            <Textarea
                                value={jsonOutput}
                                readOnly
                                className="w-full h-full font-mono text-xs absolute"
                            />
                        </div>
                        <div className="flex gap-2">
                           <Button onClick={handleCopy} variant="secondary" className="flex-1">
                                <Copy className="mr-2 h-4 w-4" /> Copy
                            </Button>
                            <Button onClick={handleDownload} variant="secondary" className="flex-1">
                                <Download className="mr-2 h-4 w-4" /> Download
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
  )
}


export default function JsonToolsPage() {

  return (
    <Tabs defaultValue="resolver" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="resolver">
          <Link className="mr-2"/> URL Resolver
        </TabsTrigger>
        <TabsTrigger value="merger">
          <Combine className="mr-2"/> JSON Merger
        </TabsTrigger>
      </TabsList>
      <TabsContent value="resolver" className="mt-4">
        <UrlResolver />
      </TabsContent>
      <TabsContent value="merger" className="mt-4">
        <JsonMerger />
      </TabsContent>
    </Tabs>
  );
}
