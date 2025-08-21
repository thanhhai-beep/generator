
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { Loader2, ExternalLink, AlertTriangle, KeyRound, PlusCircle, FolderGit2, RefreshCw, CheckCircle2, XCircle, Wand2, Shuffle, ArrowRight, Check, List, UserSearch } from 'lucide-react';
import { listGitlabGroups, listGitlabProjects, updateGitlabReadme, type GitLabGroup, type GitLabProject, type UpdateReadmeResult } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';


type GitLabAccount = {
  id: string;
  name: string;
  token: string;
};

type ReadmeTemplate = {
  id: string;
  name:string;
  content: string;
};

const GitLabLogo = () => (
    <svg role="img" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><title>GitLab</title><path d="M23.955 13.587l-1.34-4.124L18.488.54l-3.35 10.28H8.854L5.503.54 1.378 9.462.025 13.587A.813.813 0 0 0 .81 14.83l11.183 8.625a.8.8 0 0 0 .992 0L23.18 14.83a.813.813 0 0 0 .774-1.243z"/></svg>
);


export default function GitlabRepoManagerPage() {
  const { toast } = useToast();
  
  const [accounts, setAccounts] = useState<GitLabAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const activeToken = useMemo(() => accounts.find(acc => acc.id === selectedAccountId)?.token, [accounts, selectedAccountId]);

  const [groups, setGroups] = useState<GitLabGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('user-scope');
  const [groupUsername, setGroupUsername] = useState('');
  
  const [projects, setProjects] = useState<GitLabProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  
  const [readmeTemplates, setReadmeTemplates] = useState<ReadmeTemplate[]>([]);
  const [updateMode, setUpdateMode] = useState<'sequential' | 'random'>('sequential');
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateResults, setUpdateResults] = useState<UpdateReadmeResult[]>([]);
  
  const isUpdatingRef = useRef(isUpdating);
  useEffect(() => {
    isUpdatingRef.current = isUpdating;
  }, [isUpdating]);

  const fetchAccountsAndTemplates = useCallback(() => {
    try {
        const savedAccounts = localStorage.getItem('gitlabApiAccounts');
        if (savedAccounts) {
          const parsedAccounts = JSON.parse(savedAccounts).reverse(); // Show newest first
          setAccounts(parsedAccounts);
          if (parsedAccounts.length > 0) {
              setSelectedAccountId(parsedAccounts[0].id);
          }
        }
        
        const savedTemplates = localStorage.getItem('gitlabReadmeTemplates');
        if(savedTemplates) setReadmeTemplates(JSON.parse(savedTemplates));

    } catch (error) {
        console.error("Could not parse data from localStorage", error);
        toast({ title: "Lỗi", description: "Không thể tải dữ liệu đã lưu." });
    }
  }, [toast]);

  const fetchGroups = useCallback(async () => {
    if (!activeToken) return;
    setIsLoadingGroups(true);
    setGroups([]);
    setSelectedGroupId('user-scope');
    setProjects([]);
    try {
        const result = await listGitlabGroups(activeToken, groupUsername.trim());
        if (result.success && result.data) {
            setGroups(result.data);
        } else {
            toast({ title: "Failed to fetch groups", description: result.message, variant: "destructive"});
        }
    } catch (error: any) {
        toast({ title: "An error occurred fetching groups", description: error.message, variant: "destructive"});
    } finally {
        setIsLoadingGroups(false);
    }
  }, [activeToken, groupUsername, toast]);
  
  const fetchProjects = useCallback(async () => {
    if (!activeToken) return;
    setIsLoadingProjects(true);
    setProjects([]);
    setSelectedProjects(new Set());
    try {
        const groupIdNumber = selectedGroupId && selectedGroupId !== 'user-scope' ? parseInt(selectedGroupId, 10) : undefined;
        const result = await listGitlabProjects(activeToken, groupIdNumber);
         if (result.success && result.data) {
            setProjects(result.data);
            toast({ title: "Thành công", description: `Đã tìm thấy ${result.data.length} kho lưu trữ.`});
        } else {
            toast({ title: "Failed to fetch projects", description: result.message, variant: "destructive"});
        }
    } catch (error: any) {
         toast({ title: "An error occurred fetching projects", description: error.message, variant: "destructive"});
    } finally {
        setIsLoadingProjects(false);
    }
  }, [activeToken, selectedGroupId, toast]);

  useEffect(() => {
    fetchAccountsAndTemplates();
  }, [fetchAccountsAndTemplates]);

  useEffect(() => {
    if (activeToken) {
        if (!groupUsername) {
            fetchGroups();
        }
    } else {
        setGroups([]);
        setProjects([]);
        setSelectedGroupId('user-scope');
    }
  }, [activeToken, groupUsername, fetchGroups]);
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        const allIds = projects.map(p => p.id);
        setSelectedProjects(new Set(allIds));
    } else {
        setSelectedProjects(new Set());
    }
  };

  const handleRowSelect = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedProjects);
    if (checked) {
        newSelected.add(id);
    } else {
        newSelected.delete(id);
    }
    setSelectedProjects(newSelected);
  };
  
  const handleStopUpdate = () => {
    setIsUpdating(false);
    toast({ title: "Đã dừng", description: "Quá trình cập nhật đã được dừng bởi người dùng." });
  };

  const handleUpdate = async () => {
    if (!activeToken) return;

    const projectsToUpdate = projects.filter(p => selectedProjects.has(p.id));
    if (projectsToUpdate.length === 0) {
        toast({ title: "Chưa chọn kho lưu trữ", variant: "destructive" });
        return;
    }
     if (readmeTemplates.length === 0) {
        toast({ title: "Chưa có mẫu README", description: "Vui lòng tạo ít nhất một mẫu README trong trang Bulk Creator.", variant: "destructive" });
        return;
    }

    setIsUpdating(true);
    setUpdateResults([]);
    setUpdateProgress(0);

    for (let i = 0; i < projectsToUpdate.length; i++) {
        if (!isUpdatingRef.current) break;
        
        const project = projectsToUpdate[i];
        let readmeContent = '';

        if (updateMode === 'sequential') {
            readmeContent = readmeTemplates[i % readmeTemplates.length].content;
        } else {
            readmeContent = readmeTemplates[Math.floor(Math.random() * readmeTemplates.length)].content;
        }
        
        const result = await updateGitlabReadme(project.id, readmeContent, activeToken);
        setUpdateResults(prev => [...prev, result]);
        setUpdateProgress(((i + 1) / projectsToUpdate.length) * 100);
    }

    setIsUpdating(false);
    toast({ title: "Hoàn tất!", description: `Đã xử lý xong ${projectsToUpdate.length} kho lưu trữ.` });
  };
  
  const isAccountAvailable = accounts.length > 0;
  const allRowsSelected = projects.length > 0 && selectedProjects.size === projects.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitLabLogo />
            GitLab Repo Manager
          </CardTitle>
          <CardDescription>
            Lấy danh sách các kho lưu trữ từ một tài khoản hoặc group và cập nhật hàng loạt tệp README.md của chúng.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
                <Label htmlFor="active-account-select">Tài khoản GitLab đang hoạt động</Label>
                <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId} disabled={!isAccountAvailable || isUpdating}>
                    <SelectTrigger id="active-account-select">
                        <SelectValue placeholder="Chọn một tài khoản..." />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-1">
                <Label htmlFor="selected_group_id">Chọn Group (Tùy chọn)</Label>
               <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={isLoadingGroups || !activeToken || isUpdating}>
                   <SelectTrigger id="selected_group_id">
                       <SelectValue placeholder="Tất cả kho lưu trữ của tài khoản" />
                   </SelectTrigger>
                   <SelectContent>
                        <SelectItem value="user-scope">Tất cả kho lưu trữ của tài khoản</SelectItem>
                       {isLoadingGroups && <SelectItem value="loading" disabled>Đang tải...</SelectItem>}
                       {groups.map(group => <SelectItem key={group.id} value={group.id.toString()}>{group.full_name}</SelectItem>)}
                   </SelectContent>
               </Select>
            </div>
          </div>
           <div className="space-y-1.5">
                <Label htmlFor="group_username">Hoặc lấy group từ tên người dùng</Label>
                <div className="flex items-center gap-2">
                    <Input 
                        id="group_username" 
                        placeholder="ví dụ: vongtoantoant267zxl" 
                        value={groupUsername} 
                        onChange={(e) => setGroupUsername(e.target.value)} 
                        disabled={!activeToken || isUpdating} 
                    />
                    <Button variant="outline" size="sm" onClick={fetchGroups} disabled={!activeToken || isLoadingGroups || isUpdating}>
                        {isLoadingGroups ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserSearch className="h-4 w-4" />}
                        Get
                    </Button>
                </div>
            </div>
        </CardContent>
        <CardFooter>
            <Button onClick={fetchProjects} disabled={!activeToken || isLoadingProjects || isUpdating}>
                {isLoadingProjects ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FolderGit2 className="mr-2"/>}
                Lấy danh sách Kho lưu trữ
            </Button>
        </CardFooter>
      </Card>
      
      {projects.length > 0 && (
          <Card>
              <CardHeader>
                  <CardTitle>Cập nhật hàng loạt README.md</CardTitle>
                   <CardDescription>Chọn các kho lưu trữ từ danh sách bên dưới, sau đó chọn chế độ cập nhật và bắt đầu.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div className="space-y-1">
                      <Label htmlFor="update-mode">Chế độ cập nhật</Label>
                       <Select value={updateMode} onValueChange={(v: 'sequential' | 'random') => setUpdateMode(v)} disabled={isUpdating}>
                          <SelectTrigger id="update-mode">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="sequential"><div className="flex items-center gap-2"><ArrowRight className="h-4 w-4"/><span>Tuần tự</span></div></SelectItem>
                              <SelectItem value="random"><div className="flex items-center gap-2"><Shuffle className="h-4 w-4"/><span>Ngẫu nhiên</span></div></SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  {!isUpdating ? (
                    <Button onClick={handleUpdate} disabled={selectedProjects.size === 0 || isUpdating}>
                      <Wand2 className="mr-2"/>
                      Cập nhật README cho {selectedProjects.size} kho lưu trữ
                    </Button>
                  ) : (
                    <Button onClick={handleStopUpdate} variant="destructive">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin"/> Dừng cập nhật
                    </Button>
                  )}
                </div>
                {isUpdating && (
                  <div className="space-y-2">
                      <Progress value={updateProgress} />
                      <p className="text-sm text-muted-foreground text-center">Đang xử lý {updateResults.length} / {selectedProjects.size}...</p>
                  </div>
                )}
                 <div className="border rounded-md">
                    <ScrollArea className="h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox onCheckedChange={handleSelectAll} checked={allRowsSelected} aria-label="Chọn tất cả" disabled={isUpdating}/></TableHead>
                                    <TableHead>Tên Kho Lưu Trữ</TableHead>
                                    <TableHead>Trạng thái cập nhật</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {projects.map(project => {
                                    const result = updateResults.find(r => r.projectId === project.id);
                                    return (
                                        <TableRow key={project.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedProjects.has(project.id)}
                                                    onCheckedChange={(checked) => handleRowSelect(project.id, !!checked)}
                                                    disabled={isUpdating}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <a href={project.web_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{project.name}</a>
                                                <p className="text-xs text-muted-foreground">{project.path_with_namespace}</p>
                                            </TableCell>
                                            <TableCell>
                                                {result && (
                                                    result.success ?
                                                    <CheckCircle2 className="h-5 w-5 text-green-500"/> :
                                                    <div className="flex items-center gap-2 text-destructive">
                                                        <XCircle className="h-5 w-5"/>
                                                        <span className="text-xs">{result.message}</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                 </div>
              </CardContent>
          </Card>
      )}

      {readmeTemplates.length === 0 && (
          <Alert>
              <List className="h-4 w-4" />
              <AlertTitle>Không tìm thấy mẫu README</AlertTitle>
              <AlertDescription>
                  Không có mẫu README nào được tìm thấy trong bộ nhớ cục bộ của bạn. Vui lòng vào trang 
                  <Button variant="link" asChild className="p-0 h-auto mx-1"><Link href="/api-proxy/gitlab-repo">Bulk Creator</Link></Button> 
                  để tạo ít nhất một mẫu trước khi sử dụng công cụ này.
              </AlertDescription>
          </Alert>
      )}
    </div>
  );
}
