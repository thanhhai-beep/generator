
'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Github, Loader2, Copy } from "lucide-react";
import { resolveGistLinks, type GistResult } from '@/lib/server-actions';

export default function GistResolverPage() {
    const [gistLinks, setGistLinks] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState('');
    const { toast } = useToast();

    const handleResolve = async () => {
        if (!gistLinks.trim()) {
            toast({ title: 'No URLs provided', description: 'Please paste at least one Gist URL.', variant: 'destructive' });
            return;
        }

        setIsLoading(true);
        setResults('');

        try {
            const response = await resolveGistLinks(gistLinks);
            if (response.success && response.data) {
                const allGistUrls = response.data.flatMap(res => res.rawUrls);
                const formattedResults = allGistUrls.join('\n');
                
                setResults(formattedResults);
                toast({ title: 'Success', description: `Found ${allGistUrls.length} total Gist URLs.` });
            } else {
                toast({ title: 'Error', description: response.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'An unexpected error occurred', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopy = () => {
        if (!results) return;
        navigator.clipboard.writeText(results);
        toast({ title: 'Copied!', description: 'All Gist URLs have been copied to the clipboard.' });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Gist Link Resolver</CardTitle>
                    <CardDescription>
                        Paste one or more GitHub Gist URLs below to extract the raw file links from them. It can handle both individual Gist links and user profile links (with pagination).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-2">
                        <Label htmlFor="gist-links">Gist URLs (one per line)</Label>
                        <Textarea
                            id="gist-links"
                            placeholder="https://gist.github.com/username/gist_id_1\nhttps://gist.github.com/username"
                            value={gistLinks}
                            onChange={(e) => setGistLinks(e.target.value)}
                            className="min-h-32 font-mono text-sm"
                            disabled={isLoading}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleResolve} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Github className="mr-2 h-4 w-4" />}
                        Resolve Gists
                    </Button>
                </CardFooter>
            </Card>

            {results && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Results</CardTitle>
                        <CardDescription>
                            All found Gist URLs are listed below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Textarea
                            readOnly
                            value={results}
                            className="min-h-64 font-mono text-xs"
                        />
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleCopy} variant="outline">
                            <Copy className="mr-2 h-4 w-4" />
                            Copy All URLs
                        </Button>
                    </CardFooter>
                 </Card>
            )}
        </div>
    );
}
