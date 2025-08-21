
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
    CheckCircle2,
    CloudUpload,
    ExternalLink,
    FileUp,
    KeyRound,
    Loader2,
    PlusCircle,
    ShieldAlert,
    Trash2,
    XCircle,
    FileText,
    Save,
    X
} from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { deployDirectUpload, type DirectUploadResult, type DeploymentPair } from '@/lib/server-actions';
import { ScrollArea } from '@/components/ui/scroll-area';

type Account = {
  id: string;
  name: string;
  accountId: string;
  apiToken: string;
  globalApiKey: string;
  authEmail: string;
};

type DeployedProject = {
    name: string;
    url: string;
    deployedAt: string;
}

type HtmlFile = {
    id: string;
    name: string;
    content: string;
}

const defaultHtmlFile: HtmlFile = { id: 'default-1', name: 'Default Page', content: '<!DOCTYPE html>\n<html>\n<head>\n  <title>Welcome</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>' };


export default function CloudflareDirectUploadPage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    
    // Account Management
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const activeAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);
    const isAccountSelected = !!activeAccount;

    // Input state
    const [deploymentPairs, setDeploymentPairs] = useState<DeploymentPair[]>([{ projectName: '', htmlFileId: '' }]);
    const [quantity, setQuantity] = useState(1);
    
    // HTML File Management
    const [htmlFiles, setHtmlFiles] = useState<HtmlFile[]>([defaultHtmlFile]);
    const [editingHtmlFile, setEditingHtmlFile] = useState<HtmlFile>(defaultHtmlFile);
    
    // Process state
    const [isDeploying, setIsDeploying] = useState(false);
    const [deploymentResults, setDeploymentResults] = useState<DirectUploadResult[]>([]);
    
    // History State
    const [deployedProjects, setDeployedProjects] = useState<DeployedProject[]>([]);

    // Load data from localStorage on component mount
    useEffect(() => {
        setIsClient(true);
        try {
            const savedAccounts = localStorage.getItem('cloudflareAccounts');
            if (savedAccounts) {
                const parsedAccounts = JSON.parse(savedAccounts) as Account[];
                setAccounts(parsedAccounts);
                if (parsedAccounts.length > 0) {
                    const lastSelected = localStorage.getItem('lastSelectedAccountId');
                    const accountExists = parsedAccounts.some(acc => acc.id === lastSelected);
                    setSelectedAccountId(lastSelected && accountExists ? lastSelected : parsedAccounts[0].id);
                }
            }
             const savedProjects = localStorage.getItem('cloudflareDirectUploadHistory');
            if (savedProjects) {
                setDeployedProjects(JSON.parse(savedProjects));
            }
            const savedHtmlFiles = localStorage.getItem('cloudflareHtmlFiles');
            if (savedHtmlFiles) {
                const parsedFiles = JSON.parse(savedHtmlFiles);
                if (parsedFiles.length > 0) {
                    setHtmlFiles(parsedFiles);
                    setEditingHtmlFile(parsedFiles[0]);
                     setDeploymentPairs([{ projectName: '', htmlFileId: parsedFiles[0].id }]);
                } else {
                     setDeploymentPairs([{ projectName: '', htmlFileId: defaultHtmlFile.id }]);
                }
            } else {
                 setDeploymentPairs([{ projectName: '', htmlFileId: defaultHtmlFile.id }]);
            }
        } catch (error) {
            console.error("Failed to parse from localStorage", error);
            toast({ title: "Could not load saved data", variant: "destructive" });
        }
    }, [toast]);

     // Save history and files to localStorage whenever they change
    useEffect(() => {
        if (isClient) {
            localStorage.setItem('cloudflareDirectUploadHistory', JSON.stringify(deployedProjects));
            localStorage.setItem('cloudflareHtmlFiles', JSON.stringify(htmlFiles.filter(f => f.id)));
        }
    }, [deployedProjects, htmlFiles, isClient]);

    // Update last selected account ID
     useEffect(() => {
        if (isClient && selectedAccountId) {
            localStorage.setItem('lastSelectedAccountId', selectedAccountId);
        }
    }, [selectedAccountId, isClient]);
    

    const handleDeploy = async () => {
        if (!activeAccount) {
            toast({ title: "No Account Selected", description: "Please select an active Cloudflare account.", variant: "destructive" });
            return;
        }
        
        const validPairs = deploymentPairs.filter(p => p.projectName.trim() && p.htmlFileId);
        if (validPairs.length === 0) {
            toast({ title: "No Valid Pairs", description: "Please configure at least one deployment pair with a name and a file.", variant: "destructive" });
            return;
        }

        const pairsWithContent = validPairs.map(pair => {
            const file = htmlFiles.find(f => f.id === pair.htmlFileId);
            return {
                projectName: pair.projectName,
                htmlContent: file?.content || ''
            };
        });

        setIsDeploying(true);
        setDeploymentResults([]);
        
        try {
            const results = await deployDirectUpload(pairsWithContent, quantity, activeAccount.accountId, activeAccount.apiToken, activeAccount.globalApiKey, activeAccount.authEmail);
            setDeploymentResults(results);

            const newSuccessfulProjects: DeployedProject[] = results
                .filter(r => r.success && r.url)
                .map(r => ({ name: r.projectName, url: r.url!, deployedAt: new Date().toISOString() }));
            
            setDeployedProjects(prev => {
                const existingNames = new Set(prev.map(p => p.name));
                const projectsToAdd = newSuccessfulProjects.filter(p => !existingNames.has(p.name));
                return [...prev, ...projectsToAdd];
            });

            const successCount = results.filter(r => r.success).length;
            toast({ title: "Deployment Complete", description: `Successfully processed ${successCount} of ${results.length} projects.` });

        } catch (error: any) {
            toast({ title: "An unexpected error occurred", description: error.message, variant: 'destructive' });
        } finally {
            setIsDeploying(false);
        }
    };
    
    const handleSaveHtmlFile = () => {
        if (!editingHtmlFile.name || !editingHtmlFile.content) {
            toast({ title: 'Missing fields', description: 'File name and content are required.', variant: 'destructive' });
            return;
        }
        if (editingHtmlFile.id && htmlFiles.some(f => f.id === editingHtmlFile.id)) { // Update existing
            setHtmlFiles(htmlFiles.map(f => f.id === editingHtmlFile.id ? editingHtmlFile : f));
            toast({ title: 'File Updated' });
        } else { // Create new
            const newFile = { ...editingHtmlFile, id: Date.now().toString() };
            setHtmlFiles([...htmlFiles, newFile]);
            setEditingHtmlFile(newFile);
            toast({ title: 'File Created' });
        }
    };

    const handleNewHtmlFile = () => {
        setEditingHtmlFile({ id: '', name: 'New HTML File', content: '' });
    };

    const handleDeleteHtmlFile = (id: string) => {
        if (htmlFiles.length <= 1) {
            toast({ title: 'Cannot delete last file', variant: 'destructive'});
            return;
        }
        if (confirm('Are you sure you want to delete this HTML file?')) {
            const newFiles = htmlFiles.filter(f => f.id !== id);
            setHtmlFiles(newFiles);
            
             if (editingHtmlFile.id === id) {
                setEditingHtmlFile(newFiles[0] || defaultHtmlFile);
            }
            toast({ title: 'File Deleted' });
        }
    }


    const clearHistory = () => {
        if (confirm('Are you sure you want to clear the entire deployment history? This cannot be undone.')) {
            setDeployedProjects([]);
            toast({ title: 'History Cleared' });
        }
    };
    
    const isBusy = isDeploying;
    
    const validHtmlFiles = useMemo(() => htmlFiles.filter(f => f.id && f.name), [htmlFiles]);
    
    const handlePairChange = (index: number, field: keyof DeploymentPair, value: string) => {
        const newPairs = [...deploymentPairs];
        newPairs[index] = { ...newPairs[index], [field]: value };
        setDeploymentPairs(newPairs);
    };

    const addPair = () => {
        setDeploymentPairs([...deploymentPairs, { projectName: '', htmlFileId: validHtmlFiles[0]?.id || '' }]);
    };

    const removePair = (index: number) => {
        if (deploymentPairs.length <= 1) return;
        const newPairs = deploymentPairs.filter((_, i) => i !== index);
        setDeploymentPairs(newPairs);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cloudflare Account</CardTitle>
                    <CardDescription>Select the account you want to deploy to.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                        <div className="space-y-2 flex-grow max-w-md">
                            <Label htmlFor="active-account-select">Active Account</Label>
                            <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId}>
                                <SelectTrigger id="active-account-select">
                                    <SelectValue placeholder="Select an account..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <Button asChild variant="outline">
                            <Link href="/cloudflare/accounts">
                                <KeyRound className="mr-2 h-4 w-4" />
                                Manage Accounts
                            </Link>
                        </Button>
                    </div>
                     {!isAccountSelected && isClient && (
                        <Alert variant="destructive" className="mt-4">
                            <ShieldAlert className="h-4 w-4" />
                            <AlertTitle>No Active Account</AlertTitle>
                            <AlertDescription>Please select or add a Cloudflare account to deploy projects.</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>HTML File Manager</CardTitle>
                    <CardDescription>Create, edit, and manage reusable HTML files for your deployments.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 space-y-4">
                        <Button onClick={handleNewHtmlFile} className="w-full"><PlusCircle className="mr-2"/> New File</Button>
                        <ScrollArea className="h-72 border rounded-md">
                           <div className="p-2 space-y-1">
                             {validHtmlFiles.map(file => (
                                <Button
                                    key={file.id}
                                    variant={editingHtmlFile.id === file.id ? 'secondary' : 'ghost'}
                                    className="w-full justify-start"
                                    onClick={() => setEditingHtmlFile(htmlFiles.find(f => f.id === file.id) || defaultHtmlFile)}
                                >
                                    {file.name}
                                </Button>
                             ))}
                           </div>
                        </ScrollArea>
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <div className="space-y-1">
                            <Label htmlFor="html-file-name">File Name</Label>
                            <Input id="html-file-name" value={editingHtmlFile.name} onChange={e => setEditingHtmlFile(prev => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="html-file-content">Content</Label>
                            <Textarea id="html-file-content" value={editingHtmlFile.content} onChange={e => setEditingHtmlFile(prev => ({ ...prev, content: e.target.value }))} className="h-48 font-mono text-xs"/>
                        </div>
                        <div className="flex gap-2">
                           <Button onClick={handleSaveHtmlFile}><Save className="mr-2" />Save File</Button>
                           {editingHtmlFile.id && (
                             <Button onClick={() => handleDeleteHtmlFile(editingHtmlFile.id)} variant="destructive" size="icon" disabled={htmlFiles.length <= 1}><Trash2 /></Button>
                           )}
                        </div>
                    </div>
                </CardContent>
            </Card>


            <Card>
                <CardHeader>
                    <CardTitle>Direct Upload to Cloudflare Pages</CardTitle>
                    <CardDescription>
                        Configure deployment pairs and set a quantity. The system will loop through pairs and add a random suffix to project names to ensure uniqueness.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label>Deployment Pairs (Project Name Base + HTML File)</Label>
                        <div className="space-y-2 p-2 border rounded-md max-h-72 overflow-y-auto">
                            {deploymentPairs.map((pair, index) => (
                                <div key={index} className="flex items-center gap-2">
                                    <Input 
                                        placeholder="my-project-base"
                                        value={pair.projectName}
                                        onChange={(e) => handlePairChange(index, 'projectName', e.target.value)}
                                        disabled={isBusy}
                                        className="font-mono text-sm"
                                    />
                                    <Select 
                                        value={pair.htmlFileId} 
                                        onValueChange={(value) => handlePairChange(index, 'htmlFileId', value)}
                                        disabled={isBusy}
                                    >
                                        <SelectTrigger className="w-[250px]">
                                            <SelectValue placeholder="Select a file..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {validHtmlFiles.map(file => <SelectItem key={file.id} value={file.id}>{file.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Button variant="ghost" size="icon" onClick={() => removePair(index)} disabled={isBusy || deploymentPairs.length <= 1}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center">
                            <Button variant="outline" size="sm" onClick={addPair} disabled={isBusy}><PlusCircle className="mr-2"/> Add Pair</Button>
                        </div>
                     </div>
                     <div className="space-y-2 max-w-xs">
                        <Label htmlFor="quantity">Quantity to Upload</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            disabled={isBusy}
                        />
                     </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleDeploy} disabled={isBusy || !isAccountSelected || deploymentPairs.some(p => !p.projectName || !p.htmlFileId)}>
                        {isBusy ? <Loader2 className="mr-2 animate-spin" /> : <CloudUpload className="mr-2" />}
                        {isBusy ? `Deploying ${quantity} projects...` : `Deploy ${quantity} Projects`}
                    </Button>
                </CardFooter>
            </Card>

            {deploymentResults.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Deployment Results</CardTitle>
                        <CardDescription>
                            Results from the most recent deployment operation.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead>Project Name</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Message / Link</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {deploymentResults.map((result, index) => (
                                    <TableRow key={`${result.projectName}-${index}`}>
                                        <TableCell className="font-medium">{result.projectName}</TableCell>
                                        <TableCell>
                                            {result.success ? 
                                                <Badge variant="secondary" className="text-green-600"><CheckCircle2 className="mr-2"/>Success</Badge> : 
                                                <Badge variant="destructive"><XCircle className="mr-2"/>Failed</Badge>
                                            }
                                        </TableCell>
                                        <TableCell>
                                            {result.success && result.url ? (
                                                <Button asChild variant="outline" size="sm">
                                                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="mr-2 h-4 w-4"/>
                                                        Visit ({result.url})
                                                    </a>
                                                </Button>
                                            ) : (
                                                <span className="text-sm text-destructive">{result.message}</span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                       </div>
                    </CardContent>
                </Card>
            )}

             {deployedProjects.length > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Deployment History</CardTitle>
                                <CardDescription>
                                    List of projects you've deployed via this tool. This is stored in your browser.
                                </CardDescription>
                            </div>
                            <Button onClick={clearHistory} variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4"/> Clear History
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                       <div className="border rounded-md max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Project Name</TableHead>
                                        <TableHead>URL</TableHead>
                                        <TableHead>Deployed At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                {deployedProjects.map((proj) => (
                                    <TableRow key={proj.name}>
                                        <TableCell className="font-medium">{proj.name}</TableCell>
                                        <TableCell>
                                             <a href={proj.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1.5">
                                                <ExternalLink className="h-4 w-4"/>
                                                {proj.url}
                                            </a>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{new Date(proj.deployedAt).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                       </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
