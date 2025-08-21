
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import { Github, Loader2, ExternalLink, AlertTriangle, KeyRound, ShieldAlert, Clock } from 'lucide-react';
import { createGist, updateGist, getGistsForUser, type GistInput, type GistInfo } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FormattedDate } from '@/components/formatted-date';

type GitHubAccount = {
  id: string;
  name: string;
  token: string;
  postCount: number;
};


export default function GistManagerPage() {
  const { toast } = useToast();
  
  // Account Management
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const activeToken = useMemo(() => accounts.find(acc => acc.id === selectedAccountId)?.token, [accounts, selectedAccountId]);

  // Gist Input
  const [gistInput, setGistInput] = useState<GistInput>({
    description: '',
    filename: '',
    content: '',
    public: true,
    gistId: '',
  });

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingGists, setIsFetchingGists] = useState(false);
  const [lastResult, setLastResult] = useState<{ url: string, message: string } | null>(null);
  const [recentGists, setRecentGists] = useState<GistInfo[]>([]);

  useEffect(() => {
    try {
      const savedAccounts = localStorage.getItem('githubApiAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts) as GitHubAccount[];
        setAccounts(parsedAccounts);
        if (parsedAccounts.length > 0) {
            setSelectedAccountId(parsedAccounts[0].id);
        }
      }
    } catch (error) {
      console.error("Could not access or parse localStorage", error);
    }
  }, []);

  const fetchGists = useCallback(async () => {
    if (!activeToken) {
      setRecentGists([]);
      return;
    }
    setIsFetchingGists(true);
    try {
      const result = await getGistsForUser(activeToken, 5);
      if (result.success && result.data) {
        setRecentGists(result.data);
      } else {
        setRecentGists([]);
        toast({ title: "Failed to fetch gists", description: result.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error fetching gists", description: error.message, variant: "destructive" });
    } finally {
      setIsFetchingGists(false);
    }
  }, [activeToken, toast]);
  
  useEffect(() => {
    fetchGists();
  }, [fetchGists]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGistInput(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSwitchChange = (checked: boolean) => {
    setGistInput(prev => ({...prev, public: checked}));
  }

  const handleSubmit = async () => {
    if (!selectedAccountId || !activeToken) {
        toast({ title: 'Chưa chọn tài khoản', description: 'Vui lòng chọn một tài khoản GitHub đang hoạt động từ danh sách thả xuống.', variant: 'destructive' });
        return;
    }
     if (!gistInput.filename || !gistInput.content) {
        toast({ title: 'Thiếu trường bắt buộc', description: 'Tên tệp và nội dung là bắt buộc.', variant: 'destructive' });
        return;
    }

    setIsLoading(true);
    setLastResult(null);

    try {
        const isUpdate = !!gistInput.gistId;
        const action = isUpdate ? updateGist : createGist;
        const result = await action(gistInput, activeToken);

        if (result.success && result.url) {
            toast({ title: 'Thành công!', description: result.message });
            setLastResult({ url: result.url, message: result.message });
            
            fetchGists(); // Refresh gists after action

            // Increment post count for the selected account only on creation
            if (!isUpdate) {
                const updatedAccounts = accounts.map(acc => {
                    if (acc.id === selectedAccountId) {
                        return { ...acc, postCount: (acc.postCount || 0) + 1 };
                    }
                    return acc;
                });
                setAccounts(updatedAccounts);
                localStorage.setItem('githubApiAccounts', JSON.stringify(updatedAccounts));
            }
            // Reset form on successful creation
            if (!isUpdate) {
                setGistInput({
                    description: '',
                    filename: '',
                    content: '',
                    public: true,
                    gistId: '',
                });
            }
        } else {
            toast({ title: 'Thao tác thất bại', description: result.message, variant: 'destructive' });
        }
    } catch (error: any) {
        toast({ title: 'Đã xảy ra lỗi không mong muốn', description: error.message, variant: 'destructive' });
    } finally {
        setIsLoading(false);
    }
  };

  const isAccountAvailable = accounts.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Trình quản lý Gist của GitHub</CardTitle>
          <CardDescription>
            Chọn một tài khoản, sau đó tạo hoặc cập nhật một Gist của GitHub. Để cập nhật, hãy cung cấp Gist ID chính xác.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isAccountAvailable && (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Không tìm thấy tài khoản GitHub nào</AlertTitle>
                <AlertDescription>
                    Vui lòng vào trang "Tài khoản GitHub" để thêm ít nhất một tài khoản trước khi sử dụng công cụ này.
                </AlertDescription>
             </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-1 md:col-span-2">
                <Label htmlFor="active-account-select">Tài khoản GitHub đang hoạt động</Label>
                <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId} disabled={!isAccountAvailable || isLoading}>
                    <SelectTrigger id="active-account-select">
                        <SelectValue placeholder="Chọn một tài khoản..." />
                    </SelectTrigger>
                    <SelectContent>
                        {accounts.map(acc => 
                            <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} ({isFetchingGists && acc.id === selectedAccountId ? '...' : (recentGists.length > 0 && acc.id === selectedAccountId ? recentGists.length : acc.postCount)} posts)
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-1">
                <Label>&nbsp;</Label>
                 <Button asChild variant="outline" className="w-full">
                    <Link href="/api-proxy/github">
                        <KeyRound className="mr-2 h-4 w-4" />
                        Quản lý tài khoản
                    </Link>
                </Button>
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
                <Label htmlFor="gistId">Gist ID (Để trống nếu tạo mới)</Label>
                <Input 
                  id="gistId" 
                  name="gistId" 
                  value={gistInput.gistId} 
                  onChange={handleChange} 
                  placeholder="Điền ID để cập nhật Gist đã có" 
                  disabled={isLoading || !isAccountAvailable}
                />
                 <p className="text-xs text-muted-foreground pt-1">
                    Lấy ID từ URL của Gist, ví dụ: https://gist.github.com/user/<b>123abcde...</b>
                </p>
            </div>
             <div className="space-y-1">
                <Label htmlFor="filename">Tên tệp</Label>
                <Input id="filename" name="filename" value={gistInput.filename} onChange={handleChange} placeholder="ví dụ: hello_world.txt" required disabled={isLoading || !isAccountAvailable}/>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Mô tả</Label>
            <Input id="description" name="description" value={gistInput.description} onChange={handleChange} placeholder="Một mô tả cho Gist của bạn" disabled={isLoading || !isAccountAvailable}/>
          </div>
           <div className="space-y-1">
            <Label htmlFor="content">Nội dung</Label>
            <Textarea id="content" name="content" value={gistInput.content} onChange={handleChange} placeholder="Nội dung Gist ở đây..." className="min-h-48 font-mono text-sm" required disabled={isLoading || !isAccountAvailable}/>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="public-switch" checked={gistInput.public} onCheckedChange={handleSwitchChange} disabled={isLoading || !isAccountAvailable}/>
            <Label htmlFor="public-switch">Đặt Gist ở chế độ công khai</Label>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSubmit} disabled={isLoading || !isAccountAvailable || !selectedAccountId}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Github className="mr-2"/>}
            {gistInput.gistId ? 'Cập nhật Gist' : 'Tạo Gist'}
          </Button>
        </CardFooter>
      </Card>

      {lastResult && (
        <Card>
            <CardHeader>
                <CardTitle>Kết quả thao tác cuối cùng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-sm text-green-600">{lastResult.message}</p>
                <Button asChild variant="outline">
                    <a href={lastResult.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4"/>
                        Xem trên GitHub
                    </a>
                </Button>
            </CardContent>
        </Card>
      )}

      {isAccountAvailable && (
        <Card>
            <CardHeader>
                <CardTitle>5 Gists Gần đây Nhất</CardTitle>
                <CardDescription>Các Gist gần đây nhất từ tài khoản đã chọn.</CardDescription>
            </CardHeader>
            <CardContent>
                {isFetchingGists ? (
                    <div className="flex items-center justify-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : recentGists.length > 0 ? (
                    <ul className="space-y-3">
                        {recentGists.map(gist => (
                            <li key={gist.id} className="border-b pb-3 last:border-b-0">
                                <a href={gist.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{gist.description || `Gist ID: ${gist.id}`}</a>
                                <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                                    <Clock className="h-4 w-4" />
                                    <span>Tạo vào <FormattedDate date={gist.createdAt} /></span>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground text-center">Không tìm thấy Gist nào hoặc không thể lấy dữ liệu.</p>
                )}
            </CardContent>
        </Card>
      )}
    </div>
  );
}
