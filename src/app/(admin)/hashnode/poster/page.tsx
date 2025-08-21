
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ExternalLink, AlertTriangle, KeyRound, FilePenLine, CheckCircle2, XCircle } from 'lucide-react';
import { createHashnodePost, type HashnodePostResult, type HashnodePostInput } from '@/lib/server-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type HashnodeAccount = {
  id: string;
  name: string;
  token: string;
  publicationId: string;
};

export default function HashnodePosterPage() {
  const { toast } = useToast();
  
  const [accounts, setAccounts] = useState<HashnodeAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const activeAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);

  const [postInput, setPostInput] = useState<Omit<HashnodePostInput, 'token' | 'publicationId'>>({
    title: '',
    contentMarkdown: '',
    tags: [],
    hideFromHostFeed: false,
  });
  const [tagsInput, setTagsInput] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<HashnodePostResult | null>(null);

  useEffect(() => {
    try {
      const savedAccounts = localStorage.getItem('hashnodeAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts) as HashnodeAccount[];
        setAccounts(parsedAccounts);
        if (parsedAccounts.length > 0) {
            setSelectedAccountId(parsedAccounts[0].id);
        }
      }
    } catch (error) {
      console.error("Could not access or parse localStorage for Hashnode accounts", error);
    }
  }, []);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPostInput(prev => ({ ...prev, [name]: value }));
  };
  
  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTagsInput(e.target.value);
    setPostInput(prev => ({...prev, tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)}));
  };

  const handleSwitchChange = (checked: boolean) => {
    setPostInput(prev => ({...prev, hideFromHostFeed: checked}));
  }

  const handleSubmit = async () => {
    if (!activeAccount) {
        toast({ title: 'No account selected', description: 'Please select an active Hashnode account.', variant: 'destructive' });
        return;
    }
     if (!postInput.title || !postInput.contentMarkdown) {
        toast({ title: 'Missing required fields', description: 'Title and Content are required.', variant: 'destructive' });
        return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
        const fullPostInput: HashnodePostInput = {
            ...postInput,
            token: activeAccount.token,
            publicationId: activeAccount.publicationId,
        };

        const result = await createHashnodePost(fullPostInput);
        setLastResult(result);

        if (result.success && result.url) {
            toast({ title: 'Success!', description: 'Post created successfully on Hashnode.' });
            // Reset form on success
            setPostInput({ title: '', contentMarkdown: '', tags: [], hideFromHostFeed: false });
            setTagsInput('');
        } else {
            toast({ title: 'Operation Failed', description: result.message, variant: 'destructive' });
        }
    } catch (error: any) {
        toast({ title: 'An unexpected error occurred', description: error.message, variant: 'destructive' });
        setLastResult({ success: false, message: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  const isAccountAvailable = accounts.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FilePenLine/> Hashnode Poster</CardTitle>
          <CardDescription>
            Select an account, write your content in Markdown, and publish it to your Hashnode blog.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAccountAvailable && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>No Hashnode Account Found</AlertTitle>
                <AlertDescription>
                    Please go to the "Hashnode Accounts" page to add at least one account before using this tool.
                </AlertDescription>
             </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-1 md:col-span-2">
                <Label htmlFor="active-account-select">Active Hashnode Account</Label>
                <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId} disabled={!isAccountAvailable || isLoading}>
                    <SelectTrigger id="active-account-select">
                        <SelectValue placeholder="Select an account..." />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map(acc => 
                            <SelectItem key={acc.id} value={acc.id}>
                                {acc.name}
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-1">
                <Label>&nbsp;</Label>
                 <Button asChild variant="outline" className="w-full">
                    <Link href="/hashnode/accounts">
                        <KeyRound className="mr-2 h-4 w-4" />
                        Manage Accounts
                    </Link>
                </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" value={postInput.title} onChange={handleChange} placeholder="Your amazing blog post title" required disabled={isLoading || !isAccountAvailable}/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="contentMarkdown">Content (Markdown)</Label>
            <Textarea id="contentMarkdown" name="contentMarkdown" value={postInput.contentMarkdown} onChange={handleChange} placeholder="Write your content here... # Heading" className="min-h-72 font-mono text-sm" required disabled={isLoading || !isAccountAvailable}/>
          </div>
           <div className="space-y-1">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input id="tags" name="tags" value={tagsInput} onChange={handleTagsChange} placeholder="e.g., programming, javascript, nextjs" disabled={isLoading || !isAccountAvailable}/>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="hide-switch" checked={postInput.hideFromHostFeed} onCheckedChange={handleSwitchChange} disabled={isLoading || !isAccountAvailable}/>
            <Label htmlFor="hide-switch">Hide post from my blog's homepage</Label>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={isLoading || !isAccountAvailable || !selectedAccountId}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FilePenLine className="mr-2"/>}
            Publish to Hashnode
          </Button>
        </CardFooter>
      </Card>

      {lastResult && (
        <Card>
            <CardHeader>
                <CardTitle>Last Operation Result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                 {lastResult.success ? (
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5"/>
                        <p className="text-sm font-medium">{lastResult.message}</p>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-5 w-5"/>
                        <p className="text-sm font-medium">{lastResult.message}</p>
                    </div>
                )}
                {lastResult.url && (
                    <Button asChild variant="outline">
                        <a href={lastResult.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4"/>
                            View Post on Hashnode
                        </a>
                    </Button>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
