
'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FilePen, Link as LinkIcon, CheckCircle2, XCircle, Square, Server } from 'lucide-react';
import { createSingleWriteAsPost, type WriteAsResult, type WriteAsPostInput } from '@/lib/server-actions';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ProxyAccount = {
  id: string;
  name: string;
  proxy: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
};

export default function WriteAsPosterPage() {
  const [title, setTitle] = useState('My Post {n}');
  const [content, setContent] = useState('This is the content for my post.');
  const [quantity, setQuantity] = useState(5);
  const [delay, setDelay] = useState(1000);

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<WriteAsResult[]>([]);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  const isRunningRef = useRef(isRunning);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // Proxy Management
  const [proxyAccounts, setProxyAccounts] = useState<ProxyAccount[]>([]);
  const [selectedProxyId, setSelectedProxyId] = useState<string>('none');

  useEffect(() => {
    try {
      const savedProxies = localStorage.getItem('proxyAccounts');
      if (savedProxies) {
        setProxyAccounts(JSON.parse(savedProxies));
      }
    } catch (error) {
        console.error("Could not load proxy accounts from localStorage", error);
        toast({ title: "Failed to load proxies", variant: "destructive" });
    }
  }, [toast]);


  const handleStop = () => {
    setIsRunning(false);
    toast({ title: 'Process Stopped', description: 'The bulk posting process has been stopped by the user.' });
  };

  const handleCreatePosts = async () => {
    if (!title || !content || quantity <= 0) {
      toast({
        title: 'Missing Information',
        description: 'Please provide a title, content, and a valid quantity.',
        variant: 'destructive',
      });
      return;
    }

    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const contentParts = content.split('---').map(c => c.trim()).filter(Boolean);
     if (contentParts.length === 0) {
        toast({ title: 'Content is empty', variant: 'destructive' });
        setIsRunning(false);
        return;
    }
    
    const selectedProxyAccount = proxyAccounts.find(p => p.id === selectedProxyId);

    for (let i = 0; i < quantity; i++) {
      if (!isRunningRef.current) {
        break;
      }

      const postIndex = i + 1;
      const currentContent = contentParts[i % contentParts.length];
      const currentTitle = title.replace('{n}', postIndex.toString());

      const postInput: WriteAsPostInput = {
        title: currentTitle,
        content: currentContent,
        proxy: selectedProxyAccount?.proxy,
        protocol: selectedProxyAccount?.protocol,
      };
      
      try {
        const result = await createSingleWriteAsPost(postInput);
        setResults(prev => [...prev, result]);

      } catch (error: any) {
        const errorResult: WriteAsResult = {
            title: currentTitle,
            success: false,
            message: error.message || 'An unknown network error occurred.',
        };
        setResults(prev => [...prev, errorResult]);
      }
      
      setProgress(((postIndex) / quantity) * 100);

      if (i < quantity - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (isRunningRef.current) {
      toast({ title: 'Process Complete', description: `Finished processing all ${quantity} posts.` });
    }
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Write.as Bulk Poster</CardTitle>
          <CardDescription>
            Create multiple posts on Write.as anonymously. Use `---` in the content box to separate different post bodies. Optionally, use a proxy for requests.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Use {n} for post number"
                disabled={isRunning}
              />
              <p className="text-xs text-muted-foreground">
                Example: `My Post {'{n}'}` will become `My Post 1`, `My Post 2`, etc.
              </p>
            </div>
             <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={isRunning}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-32 font-mono"
              placeholder="Content for post 1.\n---\nContent for post 2."
              disabled={isRunning}
            />
             <p className="text-xs text-muted-foreground">
                Separate content for different posts using `---` on a new line. The tool will cycle through them.
            </p>
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-1.5">
                  <Label htmlFor="delay">Delay Between Posts (ms)</Label>
                  <Input
                    id="delay"
                    type="number"
                    min="0"
                    step="100"
                    value={delay}
                    onChange={(e) => setDelay(Number(e.target.value))}
                    disabled={isRunning}
                  />
                   <p className="text-xs text-muted-foreground">
                    Time to wait between each API call. 1000ms = 1 second.
                </p>
                </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="proxy-select">Proxy</Label>
                     <Select value={selectedProxyId} onValueChange={setSelectedProxyId} disabled={isRunning}>
                        <SelectTrigger id="proxy-select">
                            <SelectValue placeholder="Select a proxy..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">
                                <div className="flex items-center gap-2">
                                    <Server className="h-4 w-4 text-muted-foreground" />
                                    <span>Don't Use Proxy</span>
                                </div>
                            </SelectItem>
                            {proxyAccounts.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                     <div className="flex items-center gap-2">
                                        <Server className="h-4 w-4" />
                                        <span>{p.name} ({p.protocol})</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <p className="text-xs text-muted-foreground">
                        Proxies can be managed on the Proxy Manager page.
                    </p>
                </div>
            </div>
        </CardContent>
        <CardFooter>
          {!isRunning ? (
            <Button onClick={handleCreatePosts} disabled={isRunning}>
              <FilePen className="mr-2 h-4 w-4" />
              {`Create ${quantity} Posts`}
            </Button>
          ) : (
            <Button onClick={handleStop} variant="destructive" disabled={!isRunning}>
              <Square className="mr-2 h-4 w-4" />
               Stop Process
            </Button>
          )}
        </CardFooter>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>
              {isRunning 
                ? `Processing post ${results.length + 1} of ${quantity}...` 
                : `Process finished. Here are the ${results.length} results.`}
            </CardDescription>
            {isRunning && <Progress value={progress} className="mt-2"/>}
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {results.map((result, index) => (
                <li key={index} className="flex items-center gap-4 p-2 border rounded-md">
                    {result.success ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                        <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                  <div className="flex-grow">
                    <p className="font-medium">{result.title}</p>
                    {result.success && result.url ? (
                        <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1.5">
                           <LinkIcon className="h-4 w-4"/>
                           {result.url}
                        </a>
                    ) : (
                        <p className="text-sm text-destructive">{result.message}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
