
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, ExternalLink, AlertTriangle, KeyRound, PlusCircle, Globe, Lock, Users, FolderGit, RefreshCw, Save, Trash2, CheckCircle2, XCircle, HelpCircle, Copy, Upload, UserSearch, FileCode2, ChevronDown, FileText, Globe2 } from 'lucide-react';
import { createGitlabProjectsBulk, listGitlabGroups, type GitLabBulkProjectResult, type GitLabBulkProjectInput, type GitLabGroup } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


type GitLabAccount = {
  id: string;
  name: string;
  token: string;
};

type ReadmeTemplate = {
  id: string;
  name: string;
  content: string;
};

const emptyAccountForm: Omit<GitLabAccount, 'id'> = { name: '', token: '' };

const defaultReadme: ReadmeTemplate = { id: 'default-1', name: 'Default README', content: '# Welcome\n\nThis is a new project.' };

const GitLabLogo = () => (
    <svg role="img" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><title>GitLab</title><path d="M23.955 13.587l-1.34-4.124L18.488.54l-3.35 10.28H8.854L5.503.54 1.378 9.462.025 13.587A.813.813 0 0 0 .81 14.83l11.183 8.625a.8.8 0 0 0 .992 0L23.18 14.83a.813.813 0 0 0 .774-1.243z"/></svg>
);

function generateRandomString(length: number): string {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function AddGitLabAccountDialog({ open, onOpenChange, onAccountAdded }: { open: boolean, onOpenChange: (open: boolean) => void, onAccountAdded: () => void }) {
    const { toast } = useToast();
    const [accountForm, setAccountForm] = useState(emptyAccountForm);
    const [isLoading, setIsLoading] = useState(false);

    const handleSave = () => {
        if (!accountForm.name || !accountForm.token) {
            toast({ title: "Thiếu trường bắt buộc", description: "Vui lòng điền cả Tên tài khoản và Token.", variant: "destructive" });
            return;
        }
        
        setIsLoading(true);
        try {
            const savedAccounts = localStorage.getItem('gitlabApiAccounts');
            const accounts = savedAccounts ? JSON.parse(savedAccounts) : [];
            const newAccount = { ...accountForm, id: Date.now().toString() };
            accounts.push(newAccount);
            localStorage.setItem('gitlabApiAccounts', JSON.stringify(accounts));
            toast({ title: "Tài khoản đã được thêm" });
            onAccountAdded();
            onOpenChange(false);
            setAccountForm(emptyAccountForm);
        } catch (error) {
            console.error("Error saving to localStorage", error);
            toast({ title: "Lỗi", description: "Không thể lưu tài khoản.", variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Thêm Tài khoản GitLab Mới</DialogTitle>
                    <DialogDescription>
                        Thêm một GitLab Personal Access Token (PAT) mới để sử dụng trong các công cụ.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1">
                        <Label htmlFor="new-account-name">Tên tài khoản</Label>
                        <Input id="new-account-name" value={accountForm.name} onChange={e => setAccountForm(prev => ({...prev, name: e.target.value}))} placeholder="ví dụ: Tài khoản GitLab chính" />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="new-token">Personal Access Token (PAT)</Label>
                        <Input id="new-token" type="password" value={accountForm.token} onChange={e => setAccountForm(prev => ({...prev, token: e.target.value}))} placeholder="glpat-..." />
                        <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                            <HelpCircle className="h-3.5 w-3.5" />
                           Token phải có quyền <strong>`api`</strong>. 
                           <Link href="https://gitlab.com/-/profile/personal_access_tokens?scopes=api" target="_blank" className="text-primary underline">
                                Nhấp vào đây để tạo một token.
                           </Link>
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>Hủy bỏ</Button>
                    <Button onClick={handleSave} disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2"/>}
                        Lưu Tài khoản
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


export default function GitlabRepoBulkCreatorPage() {
  const { toast } = useToast();
  
  const [accounts, setAccounts] = useState<GitLabAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const activeToken = useMemo(() => accounts.find(acc => acc.id === selectedAccountId)?.token, [accounts, selectedAccountId]);
  const [isAddAccountDialogOpen, setIsAddAccountDialogOpen] = useState(false);
  
  const [readmeTemplates, setReadmeTemplates] = useState<ReadmeTemplate[]>([defaultReadme]);
  const [editingReadme, setEditingReadme] = useState<ReadmeTemplate>(defaultReadme);
  const readmeFileInputRef = useRef<HTMLInputElement>(null);

  const [projectNames, setProjectNames] = useState('黑料网最新回家线路官网\n黑料正能量51官网\n黑料正能量index 首页\n黑料门今日黑料免费');
  const [slugBase, setSlugBase] = useState('');
  const [quantity, setQuantity] = useState(5);
  const [visibility, setVisibility] = useState<'public' | 'internal' | 'private'>('private');
  const [createPages, setCreatePages] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [lastResults, setLastResults] = useState<GitLabBulkProjectResult[]>([]);

  // Group management state
  const [groups, setGroups] = useState<GitLabGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('user-scope');
  const [groupUsername, setGroupUsername] = useState('');

  const fetchAccounts = useCallback(() => {
    try {
        const savedAccounts = localStorage.getItem('gitlabApiAccounts');
        if (savedAccounts) {
          const parsedAccounts = JSON.parse(savedAccounts).reverse(); // Show newest first
          setAccounts(parsedAccounts);
        }
    } catch (error) {
        console.error("Could not parse GitLab accounts from localStorage", error);
        toast({ title: "Lỗi", description: "Không thể tải các tài khoản GitLab đã lưu." });
    }
  }, [toast]);
  
  const fetchGroups = useCallback(async () => {
    if (!activeToken) return;
    setIsLoadingGroups(true);
    setGroups([]);
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

  useEffect(() => {
    fetchAccounts();
    try {
      const savedTemplates = localStorage.getItem('gitlabReadmeTemplates');
      if (savedTemplates) {
          const parsed = JSON.parse(savedTemplates);
          if(parsed.length > 0) {
            setReadmeTemplates(parsed);
            setEditingReadme(parsed[0]);
          }
      }
    } catch (error) {
      console.error("Could not access or parse localStorage", error);
    }
  }, [fetchAccounts]);
  
  useEffect(() => {
    localStorage.setItem('gitlabReadmeTemplates', JSON.stringify(readmeTemplates));
  }, [readmeTemplates]);

  useEffect(() => {
    if (activeToken && !groupUsername) {
        fetchGroups();
    }
  }, [activeToken, groupUsername, fetchGroups]);


  const handleSubmit = async () => {
    if (!selectedAccountId || !activeToken) {
        toast({ title: 'Chưa chọn tài khoản', description: 'Vui lòng chọn một tài khoản GitLab đang hoạt động.', variant: 'destructive' });
        return;
    }
    const nameList = projectNames.split('\n').map(n => n.trim()).filter(Boolean);
     if (nameList.length === 0) {
        toast({ title: 'Thiếu Tên Kho Lưu Trữ', description: 'Vui lòng cung cấp ít nhất một tên kho lưu trữ.', variant: 'destructive' });
        return;
    }
    if (readmeTemplates.length === 0) {
        toast({ title: 'Thiếu Mẫu README', description: 'Vui lòng tạo ít nhất một mẫu README.', variant: 'destructive' });
        return;
    }

    setIsLoading(true);
    setLastResults([]);
    
    const dateSuffix = format(new Date(), 'ddMM') + 'TH';

    const projectsToCreate: GitLabBulkProjectInput[] = [];
    const namespaceId = selectedGroupId && selectedGroupId !== 'user-scope' ? parseInt(selectedGroupId, 10) : undefined;


    for (let i = 0; i < quantity; i++) {
        const randomName = nameList[Math.floor(Math.random() * nameList.length)];
        const randomReadme = readmeTemplates[Math.floor(Math.random() * readmeTemplates.length)];
        
        const slugBaseSanitized = slugBase.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
        const slugPrefix = slugBaseSanitized ? slugBaseSanitized : 'proj';
        
        const pathRandomString = generateRandomString(5);
        const nameRandomString = generateRandomString(5);

        projectsToCreate.push({
            name: `${randomName} - ${dateSuffix}-${nameRandomString}`,
            path: `${slugPrefix}-${pathRandomString}`,
            description: '',
            visibility: visibility,
            namespace_id: namespaceId,
            initialize_with_readme: true,
            readme_content: randomReadme.content,
            create_pages: createPages,
        });
    }

    try {
        const results = await createGitlabProjectsBulk(projectsToCreate, activeToken);
        setLastResults(results);
        const successCount = results.filter(r => r.success).length;
        toast({ title: 'Hoàn tất!', description: `Tạo thành công ${successCount} trên ${quantity} kho lưu trữ.` });
    } catch (error: any) {
        toast({ title: 'Đã xảy ra lỗi không mong muốn', description: error.message, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleSaveReadme = () => {
      if (!editingReadme.name || !editingReadme.content) {
          toast({ title: 'Thiếu trường', description: 'Tên và nội dung của mẫu là bắt buộc.', variant: 'destructive' });
          return;
      }
      if (editingReadme.id && readmeTemplates.some(t => t.id === editingReadme.id)) { // Update
          setReadmeTemplates(readmeTemplates.map(t => t.id === editingReadme.id ? editingReadme : t));
          toast({ title: 'Đã cập nhật mẫu' });
      } else { // Create
          const newTemplate = { ...editingReadme, id: Date.now().toString() };
          setReadmeTemplates([...readmeTemplates, newTemplate]);
          setEditingReadme(newTemplate);
          toast({ title: 'Đã tạo mẫu' });
      }
  };

  const handleNewReadme = () => {
      setEditingReadme({ id: '', name: 'Mẫu Mới', content: '' });
  };
  
  const handleDeleteReadme = (id: string) => {
      if (readmeTemplates.length <= 1) {
          toast({ title: 'Không thể xóa mẫu cuối cùng', variant: 'destructive' });
          return;
      }
      if (confirm('Bạn có chắc chắn muốn xóa mẫu README này không?')) {
          const newTemplates = readmeTemplates.filter(t => t.id !== id);
          setReadmeTemplates(newTemplates);
          if (editingReadme.id === id) {
              setEditingReadme(newTemplates[0]);
          }
          toast({ title: 'Đã xóa mẫu' });
      }
  };
  
  const handleReadmeFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileReadPromises: Promise<ReadmeTemplate>[] = Array.from(files).map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve({
            id: `${Date.now()}-${Math.random()}`,
            name: file.name.replace(/\.(md|txt)$/i, ''),
            content: content,
          });
        };
        reader.onerror = (e) => reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
        reader.readAsText(file);
      });
    });

    Promise.all(fileReadPromises)
      .then(newTemplates => {
        setReadmeTemplates(prev => [...prev, ...newTemplates]);
        toast({ title: 'Tải lên hoàn tất!', description: `Đã thêm ${newTemplates.length} mẫu mới.` });
      })
      .catch(error => {
        console.error("Error reading files:", error);
        toast({ title: `Lỗi khi đọc tệp`, description: error.message, variant: 'destructive' });
      });

    // Reset file input to allow re-uploading the same file(s)
    if(readmeFileInputRef.current) {
        readmeFileInputRef.current.value = "";
    }
  };


  const handleCopyUrls = (type: 'project' | 'pages' | 'all') => {
    if (lastResults.length === 0) return;

    const successfulResults = lastResults.filter(result => result.success);

    let urls: (string | undefined)[] = [];
    if (type === 'project') {
      urls = successfulResults.map(r => r.url);
    } else if (type === 'pages') {
      urls = successfulResults.map(r => r.pagesUrl);
    } else { // all
      urls = successfulResults.flatMap(r => [r.url, r.pagesUrl]);
    }
    
    const urlsToCopy = urls.filter(Boolean).join('\n');
    
    if (!urlsToCopy) {
      toast({
        title: "Không có URL nào để sao chép",
        description: `Không có URL loại '${type}' nào được tìm thấy trong kết quả thành công.`,
        variant: "destructive"
      });
      return;
    }

    navigator.clipboard.writeText(urlsToCopy).then(() => {
      toast({ title: 'Đã sao chép!', description: `URL loại '${type}' đã được sao chép vào clipboard.` });
    }, (err) => {
      toast({ title: 'Sao chép thất bại', description: 'Không thể sao chép URL vào clipboard.', variant: 'destructive' });
      console.error('Không thể sao chép văn bản: ', err);
    });
  };

  const isAccountAvailable = accounts.length > 0;
  const isBusy = isLoading;
  const accountOptions = accounts.map(acc => ({ value: acc.id, label: acc.name }));


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitLabLogo />
            Trình tạo Kho lưu trữ GitLab Hàng loạt
          </CardTitle>
          <CardDescription>
            Tạo hàng loạt kho lưu trữ trên GitLab với tên và nội dung README được ngẫu nhiên hóa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAccountAvailable && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Không tìm thấy tài khoản GitLab nào</AlertTitle>
                <AlertDescription>
                    Vui lòng vào trang "Tài khoản GitLab" để thêm ít nhất một tài khoản trước khi sử dụng công cụ này.
                </AlertDescription>
             </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-1 md:col-span-2">
                <Label htmlFor="active-account-select">Tài khoản GitLab đang hoạt động</Label>
                <div className="flex items-center gap-2">
                    <Combobox
                        options={accountOptions}
                        value={selectedAccountId}
                        onValueChange={setSelectedAccountId}
                        placeholder="Chọn một tài khoản..."
                        searchPlaceholder="Tìm kiếm tài khoản..."
                        notFoundMessage="Không tìm thấy tài khoản."
                        disabled={!isAccountAvailable || isLoading}
                    />
                    <Button onClick={() => setIsAddAccountDialogOpen(true)} variant="outline" size="sm">
                        <PlusCircle className="mr-2 h-4 w-4"/> Thêm
                    </Button>
                </div>
            </div>
             <div className="space-y-1">
                <Label>&nbsp;</Label>
                 <Button asChild variant="outline" className="w-full">
                    <Link href="/api-proxy/gitlab">
                        <KeyRound className="mr-2 h-4 w-4" />
                        Quản lý tất cả tài khoản
                    </Link>
                </Button>
            </div>
          </div>
          
           <div className="space-y-4 pt-2">
                <div className="space-y-1">
                    <Label htmlFor="selected_group_id">Chọn Group (Tùy chọn)</Label>
                    <Select value={selectedGroupId} onValueChange={setSelectedGroupId} disabled={isLoadingGroups || !activeToken || isBusy}>
                        <SelectTrigger id="selected_group_id">
                            <SelectValue placeholder="Tạo trong namespace cá nhân..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user-scope">Tạo trong namespace cá nhân</SelectItem>
                            {isLoadingGroups && <SelectItem value="loading" disabled>Đang tải...</SelectItem>}
                            {groups.map(group => <SelectItem key={group.id} value={group.id.toString()}>{group.full_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground pt-1">Nếu không chọn group, các kho lưu trữ sẽ được tạo ở cấp cao nhất của tài khoản.</p>
                </div>
                 <div className="space-y-1.5">
                    <Label htmlFor="group_username">Hoặc lấy group từ tên người dùng</Label>
                    <div className="flex items-center gap-2">
                        <Input 
                            id="group_username" 
                            placeholder="ví dụ: vongtoantoant267zxl" 
                            value={groupUsername} 
                            onChange={(e) => setGroupUsername(e.target.value)} 
                            disabled={!activeToken || isBusy} 
                        />
                        <Button variant="outline" size="sm" onClick={fetchGroups} disabled={!activeToken || isLoadingGroups || isBusy}>
                            {isLoadingGroups ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserSearch className="h-4 w-4" />}
                            Get
                        </Button>
                    </div>
                </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-1">
                    <Label htmlFor="name-list">Danh sách Tên Kho Lưu Trữ (mỗi tên một dòng)</Label>
                    <Textarea 
                        id="name-list"
                        value={projectNames}
                        onChange={(e) => setProjectNames(e.target.value)}
                        placeholder="Tên dự án 1\nTên dự án 2\nTên dự án 3"
                        required
                        disabled={isBusy || !isAccountAvailable}
                        className="h-40"
                    />
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <Label htmlFor="quantity">Số Lượng</Label>
                          <Input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required disabled={isBusy || !isAccountAvailable}/>
                      </div>
                      <div className="space-y-1">
                          <Label htmlFor="slug-base">Slug Cơ Sở (Tùy chọn)</Label>
                          <Input id="slug-base" value={slugBase} onChange={(e) => setSlugBase(e.target.value)} placeholder="ví dụ: my-prefix" disabled={isBusy || !isAccountAvailable}/>
                      </div>
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="visibility">Mức độ hiển thị</Label>
                        <Select value={visibility} onValueChange={(value: 'public' | 'internal' | 'private') => setVisibility(value)} disabled={isBusy || !isAccountAvailable}>
                            <SelectTrigger id="visibility">
                                <SelectValue placeholder="Chọn mức độ hiển thị..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="private"><div className="flex items-center gap-2"><Lock className="h-4 w-4"/><span>Riêng tư</span></div></SelectItem>
                                <SelectItem value="internal"><div className="flex items-center gap-2"><Users className="h-4 w-4"/><span>Nội bộ</span></div></SelectItem>
                                <SelectItem value="public"><div className="flex items-center gap-2"><Globe className="h-4 w-4"/><span>Công khai</span></div></SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 pt-2">
                       <div className="flex items-center space-x-2">
                         <Switch id="create-pages-switch" checked={createPages} onCheckedChange={setCreatePages} disabled={isBusy || !isAccountAvailable}/>
                         <Label htmlFor="create-pages-switch" className="flex items-center gap-2 cursor-pointer">
                            <FileCode2 className="h-4 w-4"/>
                            Tự động tạo GitLab Pages
                         </Label>
                       </div>
                       <p className="text-xs text-muted-foreground pl-8">Tạo tệp `.gitlab-ci.yml` và `public/index.html`.</p>
                    </div>
                </div>
           </div>

        </CardContent>
      </Card>
      
      <Card>
           <CardHeader>
              <CardTitle>Quản lý Mẫu README</CardTitle>
              <CardDescription>Tạo, chỉnh sửa và quản lý các mẫu nội dung README để sử dụng khi tạo kho lưu trữ hàng loạt.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                  <div className='flex items-center gap-2'>
                    <Button onClick={handleNewReadme} className="flex-1"><PlusCircle className="mr-2"/> Mẫu Mới</Button>
                    <Button variant="outline" size="sm" onClick={() => readmeFileInputRef.current?.click()} className="flex-1">
                        <Upload className="mr-2 h-4 w-4" />
                        Tải lên Mẫu mới
                    </Button>
                    <input
                        type="file"
                        ref={readmeFileInputRef}
                        onChange={handleReadmeFileUpload}
                        className="hidden"
                        accept=".md,.txt"
                        multiple
                    />
                  </div>
                  <ScrollArea className="h-72 border rounded-md">
                     <div className="p-2 space-y-1">
                       {readmeTemplates.map(template => (
                          <Button
                              key={template.id}
                              variant={editingReadme.id === template.id ? 'secondary' : 'ghost'}
                              className="w-full justify-start"
                              onClick={() => setEditingReadme(readmeTemplates.find(t => t.id === template.id) || defaultReadme)}
                          >
                              {template.name}
                          </Button>
                       ))}
                     </div>
                  </ScrollArea>
              </div>
              <div className="md:col-span-2 space-y-4">
                  <div className="space-y-1">
                      <Label htmlFor="readme-name">Tên Mẫu</Label>
                      <Input id="readme-name" value={editingReadme.name} onChange={e => setEditingReadme(prev => ({ ...prev, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                       <Label htmlFor="readme-content">Nội dung</Label>
                      <Textarea id="readme-content" value={editingReadme.content} onChange={e => setEditingReadme(prev => ({ ...prev, content: e.target.value }))} className="h-48 font-mono text-xs"/>
                  </div>
                  <div className="flex gap-2">
                     <Button onClick={handleSaveReadme}><Save className="mr-2" />Lưu Mẫu</Button>
                     {editingReadme.id && (
                       <Button onClick={() => handleDeleteReadme(editingReadme.id)} variant="destructive" size="icon" disabled={readmeTemplates.length <= 1}><Trash2 /></Button>
                     )}
                  </div>
              </div>
          </CardContent>
           <CardFooter>
            <Button onClick={handleSubmit} disabled={isBusy || !isAccountAvailable || !selectedAccountId}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2"/>}
              Tạo {quantity} Kho Lưu Trữ
            </Button>
          </CardFooter>
      </Card>

      <AddGitLabAccountDialog
        open={isAddAccountDialogOpen}
        onOpenChange={setIsAddAccountDialogOpen}
        onAccountAdded={fetchAccounts}
      />

      {lastResults.length > 0 && (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <CardTitle>Kết quả ({lastResults.length})</CardTitle>
                        <CardDescription>Kết quả từ lần tạo hàng loạt gần nhất.</CardDescription>
                    </div>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Copy className="mr-2 h-4 w-4"/> Sao chép URL <ChevronDown className="ml-2 h-4 w-4"/>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleCopyUrls('project')}>
                                <FileText className="mr-2 h-4 w-4"/> Sao chép URL Dự án
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyUrls('pages')}>
                                <Globe2 className="mr-2 h-4 w-4"/> Sao chép URL Pages
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleCopyUrls('all')}>
                                <Copy className="mr-2 h-4 w-4"/> Sao chép Tất cả
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-96">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tên Kho Lưu Trữ</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Liên kết</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {lastResults.map((result, index) => (
                        <TableRow key={index}>
                            <TableCell className="font-medium">{result.projectName}</TableCell>
                            <TableCell>
                                {result.success ? 
                                    <CheckCircle2 className="h-5 w-5 text-green-500"/> : 
                                    <XCircle className="h-5 w-5 text-destructive"/>
                                }
                            </TableCell>
                            <TableCell>
                               {result.success ? (
                                    <div className="flex flex-col gap-1.5">
                                        {result.url && (
                                            <Button asChild variant="link" className="p-0 h-auto justify-start">
                                                <a href={result.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                    <ExternalLink className="h-4 w-4"/>
                                                    Dự án trên GitLab
                                                </a>
                                            </Button>
                                        )}
                                        {result.pagesUrl && (
                                             <Button asChild variant="link" className="p-0 h-auto justify-start text-green-600">
                                                <a href={result.pagesUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                                    <Globe2 className="h-4 w-4"/>
                                                    Trang GitLab Pages
                                                </a>
                                            </Button>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-sm text-destructive">{result.message}</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </ScrollArea>
            </CardContent>
        </Card>
      )}
    </div>
  );
}

