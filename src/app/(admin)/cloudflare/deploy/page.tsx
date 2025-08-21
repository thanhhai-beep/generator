
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
    Ban,
    CheckCircle2,
    Clock,
    CloudUpload,
    GitBranch,
    GitCommit,
    Loader2,
    MoreHorizontal,
    PlusCircle,
    RefreshCw,
    XCircle,
    KeyRound,
    ShieldAlert,
    ExternalLink
} from "lucide-react";
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormattedDate } from "@/components/formatted-date";
import {
    listPagesProjects,
    createPagesProject,
    getPagesProjectDeployments,
    createPagesDeployment,
    type PagesProject,
    type PagesDeployment,
} from '@/lib/server-actions';

type Account = {
  id: string;
  name: string;
  accountId: string;
  apiToken: string;
  globalApiKey: string;
  authEmail: string;
};

const StatusBadge = ({ stage }: { stage: string }) => {
  const statusLower = stage.toLowerCase();
  if (statusLower === "success") {
    return (
      <Badge variant="secondary" className="text-green-600">
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Success
      </Badge>
    );
  }
  if (["build", "initialize", "clone_repo", "queue"].includes(statusLower)) {
    return (
      <Badge variant="outline">
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
        {stage}
      </Badge>
    );
  }
  if (statusLower === "failure") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-2 h-4 w-4" />
        Failed
      </Badge>
    );
  }
  if (statusLower === "canceled") {
    return (
      <Badge variant="secondary">
        <Ban className="mr-2 h-4 w-4 text-muted-foreground" />
        Canceled
      </Badge>
    );
  }
  return <Badge variant="outline">{stage}</Badge>;
};


function CreateProjectDialog({ open, onOpenChange, onProjectCreated, account }: { open: boolean, onOpenChange: (open: boolean) => void, onProjectCreated: () => void, account: Account }) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [repoName, setRepoName] = useState(''); // e.g., "user/repo"
    const [productionBranch, setProductionBranch] = useState('main');

    const handleCreate = async () => {
        if (!projectName || !repoName) {
            toast({ title: "Missing fields", description: "Project Name and GitHub Repo are required.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        try {
            const result = await createPagesProject({ name: projectName, repo: repoName, production_branch: productionBranch }, account.accountId, account.apiToken, account.globalApiKey, account.authEmail);
            if (result.success) {
                toast({ title: "Project Created", description: `Project "${projectName}" has been successfully created.` });
                onProjectCreated();
                onOpenChange(false);
            } else {
                toast({ title: "Creation Failed", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
             toast({ title: "An unexpected error occurred", description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Cloudflare Pages Project</DialogTitle>
                    <DialogDescription>
                        Connect a GitHub repository to create a new project. This requires a Global API Key for initial setup.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1">
                        <Label htmlFor="project-name">Project Name</Label>
                        <Input id="project-name" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g., my-awesome-site"/>
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="repo-name">GitHub Repository</Label>
                        <Input id="repo-name" value={repoName} onChange={e => setRepoName(e.target.value)} placeholder="e.g., your-github-user/your-repo-name"/>
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="prod-branch">Production Branch</Label>
                        <Input id="prod-branch" value={productionBranch} onChange={e => setProductionBranch(e.target.value)} />
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={isLoading}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4"/>}
                        Create Project
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}


export default function CloudflareDeployPage() {
    const { toast } = useToast();
    const [isClient, setIsClient] = useState(false);
    
    // Account Management
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const activeAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);
    const isAccountSelected = !!activeAccount;

    // Pages Projects
    const [projects, setProjects] = useState<PagesProject[]>([]);
    const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
    const [isLoadingProjects, setIsLoadingProjects] = useState(false);
    const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false);

    // Deployments
    const [deployments, setDeployments] = useState<PagesDeployment[]>([]);
    const [isLoadingDeployments, setIsLoadingDeployments] = useState(false);
    const [branchToDeploy, setBranchToDeploy] = useState('main');
    const [isDeploying, setIsDeploying] = useState(false);

    const selectedProject = useMemo(() => projects.find(p => p.name === selectedProjectName), [projects, selectedProjectName]);

    const fetchProjects = useCallback(async () => {
        if (!activeAccount) return;
        setIsLoadingProjects(true);
        setProjects([]);
        setDeployments([]);
        setSelectedProjectName(null);
        try {
            const result = await listPagesProjects(activeAccount.accountId, activeAccount.apiToken, activeAccount.globalApiKey, activeAccount.authEmail);
            if (result.success && result.data) {
                const gitProjects = result.data.filter(p => p.source?.type === 'github');
                setProjects(gitProjects);
                if (gitProjects.length > 0) {
                    setSelectedProjectName(gitProjects[0].name);
                }
            } else {
                toast({ title: 'Failed to fetch projects', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: "An unexpected error occurred", description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingProjects(false);
        }
    }, [activeAccount, toast]);

    const fetchDeployments = useCallback(async () => {
        if (!activeAccount || !selectedProjectName) return;
        setIsLoadingDeployments(true);
        setDeployments([]);
        try {
            const result = await getPagesProjectDeployments(selectedProjectName, activeAccount.accountId, activeAccount.apiToken, activeAccount.globalApiKey, activeAccount.authEmail);
            if (result.success && result.data) {
                setDeployments(result.data);
            } else {
                toast({ title: 'Failed to fetch deployments', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: "An unexpected error occurred", description: error.message, variant: 'destructive' });
        } finally {
            setIsLoadingDeployments(false);
        }
    }, [activeAccount, selectedProjectName, toast]);

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
        } catch (error) {
            console.error("Failed to parse accounts from localStorage", error);
            toast({ title: "Could not load saved accounts", variant: "destructive" });
        }
    }, [toast]);

     useEffect(() => {
        if (isClient && selectedAccountId) {
            localStorage.setItem('lastSelectedAccountId', selectedAccountId);
            fetchProjects();
        }
    }, [selectedAccountId, isClient, fetchProjects]);

    useEffect(() => {
        if (selectedProjectName) {
            fetchDeployments();
            setBranchToDeploy(selectedProject?.production_branch || 'main');
        }
    }, [selectedProjectName, fetchDeployments, selectedProject]);
    
    const handleCreateDeployment = async () => {
        if (!selectedProjectName || !branchToDeploy || !activeAccount) return;
        
        setIsDeploying(true);
        try {
            const result = await createPagesDeployment(selectedProjectName, branchToDeploy, activeAccount.accountId, activeAccount.apiToken, activeAccount.globalApiKey, activeAccount.authEmail);
            if (result.success && result.data) {
                toast({ title: "Deployment Started", description: `New deployment created for branch "${branchToDeploy}".` });
                // Add new deployment to the top of the list
                setDeployments(prev => [result.data!, ...prev]);
            } else {
                toast({ title: "Deployment Failed", description: result.message, variant: "destructive" });
            }
        } catch (error: any) {
            toast({ title: "An unexpected error occurred", description: error.message, variant: 'destructive' });
        } finally {
            setIsDeploying(false);
        }
    }

    const isBusy = isLoadingProjects || isLoadingDeployments || isDeploying;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cloudflare Account</CardTitle>
                    <CardDescription>Select the account you want to manage Pages projects for.</CardDescription>
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
                            <AlertDescription>Please select or add a Cloudflare account to manage Pages projects.</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex flex-wrap justify-between items-center gap-2">
                        <div>
                            <CardTitle>Cloudflare Pages: Git Deployments</CardTitle>
                            <CardDescription>
                                Create a new deployment from a GitHub branch or view existing ones.
                            </CardDescription>
                        </div>
                         <div className="flex gap-2">
                            <Button onClick={fetchProjects} variant="outline" size="sm" disabled={!isAccountSelected || isLoadingProjects}>
                                {isLoadingProjects ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                                Refresh List
                            </Button>
                            <Button onClick={() => setIsCreateProjectDialogOpen(true)} variant="default" size="sm" disabled={!isAccountSelected || isBusy}>
                                <PlusCircle className="mr-2 h-4 w-4"/>
                                Create Project
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="project-select">Project</Label>
                            <Select value={selectedProjectName || ''} onValueChange={setSelectedProjectName} disabled={!isAccountSelected || isLoadingProjects}>
                                <SelectTrigger id="project-select">
                                    <SelectValue placeholder={isLoadingProjects ? "Loading projects..." : "Select a project"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {projects.map(proj => <SelectItem key={proj.name} value={proj.name}>{proj.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="branch-deploy">Branch to Deploy</Label>
                            <Input id="branch-deploy" value={branchToDeploy} onChange={e => setBranchToDeploy(e.target.value)} placeholder="e.g., main" disabled={!selectedProjectName || isDeploying}/>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={!selectedProjectName || isDeploying || !branchToDeploy}>
                                <CloudUpload className="mr-2 h-4 w-4" />
                                Create Deployment
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Deployment</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Are you sure you want to create a new deployment for project <strong>{selectedProjectName}</strong> from the <strong>{branchToDeploy}</strong> branch?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleCreateDeployment}>Deploy</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Deployment History</CardTitle>
                            <CardDescription>
                            Recent deployments for {'"'}<strong>{selectedProjectName || '...'}</strong>{'"'}.
                            </CardDescription>
                        </div>
                        <Button onClick={fetchDeployments} variant="ghost" size="icon" disabled={!selectedProjectName || isLoadingDeployments}>
                            <span className="sr-only">Refresh Deployments</span>
                            {isLoadingDeployments ? <Loader2 className="h-4 w-4 animate-spin"/> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                   <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>Deployment ID / Status</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Timestamp</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {isLoadingDeployments && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!isLoadingDeployments && deployments.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        No deployments found for this project.
                                    </TableCell>
                                </TableRow>
                            )}
                            {deployments.map((deployment) => (
                                <TableRow key={deployment.id}>
                                <TableCell>
                                    <div className="flex flex-col gap-1.5">
                                        <StatusBadge stage={deployment.latest_stage.name} />
                                        <span className="font-mono text-xs text-muted-foreground">{deployment.id}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                                            <span className="font-medium">{deployment.deployment_trigger.metadata.branch}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <GitCommit className="ml-0.5 mr-2.5 h-3 w-3" />
                                            <span className="font-mono text-xs">
                                            {deployment.deployment_trigger.metadata.commit_hash.slice(0, 7)}
                                            </span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Clock className="h-4 w-4" />
                                    <FormattedDate date={deployment.created_on} />
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                     <Button asChild variant="outline" size="sm">
                                        <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="mr-2 h-4 w-4"/>
                                            Visit
                                        </a>
                                     </Button>
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                   </div>
                </CardContent>
            </Card>
            {activeAccount && isCreateProjectDialogOpen && (
                <CreateProjectDialog
                    open={isCreateProjectDialogOpen}
                    onOpenChange={setIsCreateProjectDialogOpen}
                    onProjectCreated={fetchProjects}
                    account={activeAccount}
                />
            )}
        </div>
    );
}
