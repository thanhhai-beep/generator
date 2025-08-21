
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2, Save, KeyRound, Server, ExternalLink, HelpCircle } from 'lucide-react';

type GitHubAccount = {
  id: string;
  name: string;
  token: string;
  postCount: number;
};

const emptyAccountForm: Omit<GitHubAccount, 'id'> = { name: '', token: '', postCount: 0 };

export default function GitHubAccountsManagerPage() {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [accounts, setAccounts] = useState<GitHubAccount[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedAccounts = localStorage.getItem('githubApiAccounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts).map((acc: any) => ({
            ...acc,
            postCount: acc.postCount || 0, // Ensure postCount exists
        }));
        setAccounts(parsedAccounts);
      }
    } catch (error) {
      console.error("Failed to parse accounts from localStorage", error);
      toast({ title: "Could not load saved accounts", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('githubApiAccounts', JSON.stringify(accounts));
    }
  }, [accounts, isClient]);
  
  const handleAccountFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveAccount = () => {
    if (!accountForm.name || !accountForm.token) {
      toast({ title: "Thiếu trường bắt buộc", description: "Vui lòng điền cả Tên tài khoản và Token.", variant: "destructive" });
      return;
    }
    if (editingAccountId) {
       // Find the original account to preserve its post count
      const originalAccount = accounts.find(acc => acc.id === editingAccountId);
      const postCount = originalAccount ? originalAccount.postCount : 0;

      setAccounts(accounts.map(acc => 
        acc.id === editingAccountId 
          ? { ...accountForm, id: editingAccountId, postCount: postCount } 
          : acc
      ));
      toast({ title: "Tài khoản đã được cập nhật" });
    } else {
      const newAccount = { ...accountForm, id: Date.now().toString(), postCount: 0 };
      setAccounts([...accounts, newAccount]);
      toast({ title: "Tài khoản đã được thêm" });
    }
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  const handleEditAccount = (account: GitHubAccount) => {
    setEditingAccountId(account.id);
    setAccountForm({ name: account.name, token: account.token, postCount: account.postCount });
  };
  
  const handleDeleteAccount = (accountId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này không?')) return;
    setAccounts(accounts.filter(acc => acc.id !== accountId));
    toast({ title: "Tài khoản đã bị xóa" });
  };
  
  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };


  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
            <CardTitle>Quản lý Tài khoản GitHub</CardTitle>
            <CardDescription>
            Thêm và quản lý nhiều GitHub Personal Access Tokens (PATs). Chúng được lưu trữ trong trình duyệt của bạn và có thể được chọn trong các công cụ như Trình quản lý Gist.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                 <h3 className="font-semibold text-lg flex items-center gap-2">
                    <KeyRound className="h-5 w-5"/>
                    {editingAccountId ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
                </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="accountName">Tên tài khoản</Label>
                        <Input id="accountName" name="name" placeholder="ví dụ: Tài khoản chính của tôi" value={accountForm.name} onChange={handleAccountFormChange} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="token">Personal Access Token (PAT)</Label>
                        <Input id="token" name="token" type="password" placeholder="ghp_..." value={accountForm.token} onChange={handleAccountFormChange} />
                         <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                            <HelpCircle className="h-3.5 w-3.5" />
                           Token phải có quyền <strong>`gist`</strong>. 
                           <Link href="https://github.com/settings/tokens/new?scopes=gist&description=Gist%20Manager%20Token" target="_blank" className="text-primary underline">
                                Nhấp vào đây để tạo một token đúng.
                           </Link>
                        </p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                    <Button onClick={handleSaveAccount}>
                        <Save className="mr-2"/>{editingAccountId ? 'Lưu thay đổi' : 'Thêm tài khoản'}
                    </Button>
                    {editingAccountId && <Button variant="ghost" onClick={handleCancelEdit}>Hủy bỏ</Button>}
                </div>
            </div>
            
            {accounts.length > 0 && (
                <div className="space-y-2">
                    <h3 className="font-semibold">Tài khoản đã lưu</h3>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Token</TableHead><TableHead>Bài đăng</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {accounts.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell className="font-mono text-xs">...{acc.token.slice(-8)}</TableCell>
                                        <TableCell className="text-center font-medium">{acc.postCount || 0}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditAccount(acc)}><Pencil className="h-4 w-4"/></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteAccount(acc.id)}><Trash2 className="h-4 w-4"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </CardContent>
        </Card>
    </div>
  );
}
