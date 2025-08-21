
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
} from "@/components/ui/alert-dialog"
import { Pencil, Trash2, Save, KeyRound, HelpCircle } from 'lucide-react';

type GitLabAccount = {
  id: string;
  name: string;
  token: string;
};

const emptyAccountForm: Omit<GitLabAccount, 'id'> = { name: '', token: '' };

const GitLabLogo = () => (
    <svg role="img" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><title>GitLab</title><path d="M23.955 13.587l-1.34-4.124L18.488.54l-3.35 10.28H8.854L5.503.54 1.378 9.462.025 13.587A.813.813 0 0 0 .81 14.83l11.183 8.625a.8.8 0 0 0 .992 0L23.18 14.83a.813.813 0 0 0 .774-1.243z"/></svg>
);


export default function GitLabAccountsManagerPage() {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [accounts, setAccounts] = useState<GitLabAccount[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedAccounts = localStorage.getItem('gitlabApiAccounts');
      if (savedAccounts) {
        setAccounts(JSON.parse(savedAccounts));
      }
    } catch (error) {
      console.error("Failed to parse accounts from localStorage", error);
      toast({ title: "Could not load saved accounts", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('gitlabApiAccounts', JSON.stringify(accounts));
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
      setAccounts(accounts.map(acc => acc.id === editingAccountId ? { ...accountForm, id: editingAccountId } : acc));
      toast({ title: "Tài khoản đã được cập nhật" });
    } else {
      const newAccount = { ...accountForm, id: Date.now().toString() };
      setAccounts([...accounts, newAccount]);
      toast({ title: "Tài khoản đã được thêm" });
    }
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  const handleEditAccount = (account: GitLabAccount) => {
    setEditingAccountId(account.id);
    setAccountForm({ name: account.name, token: account.token });
  };
  
  const handleDeleteAccount = (accountId: string) => {
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
            <CardTitle className="flex items-center gap-2">
                <GitLabLogo />
                Quản lý Tài khoản GitLab
            </CardTitle>
            <CardDescription>
            Thêm và quản lý nhiều GitLab Personal Access Tokens (PATs). Chúng được lưu trữ trong trình duyệt của bạn và có thể được chọn trong các công cụ như Trình tạo Kho lưu trữ GitLab.
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
                        <Input id="accountName" name="name" placeholder="ví dụ: Tài khoản GitLab chính" value={accountForm.name} onChange={handleAccountFormChange} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="token">Personal Access Token (PAT)</Label>
                        <Input id="token" name="token" type="password" placeholder="glpat-..." value={accountForm.token} onChange={handleAccountFormChange} />
                         <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                            <HelpCircle className="h-3.5 w-3.5" />
                           Token phải có quyền <strong>`api`</strong>. 
                           <Link href="https://gitlab.com/-/profile/personal_access_tokens?scopes=api" target="_blank" className="text-primary underline">
                                Nhấp vào đây để tạo một token.
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
                            <TableHeader><TableRow><TableHead>Tên</TableHead><TableHead>Token</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {accounts.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell className="font-mono text-xs">...{acc.token.slice(-8)}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditAccount(acc)}><Pencil className="h-4 w-4"/></Button>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Bạn có chắc chắn không?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                           Hành động này không thể hoàn tác. Thao tác này sẽ xóa vĩnh viễn tài khoản khỏi bộ nhớ cục bộ.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Hủy bỏ</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteAccount(acc.id)} className="bg-destructive hover:bg-destructive/90">
                                                            Có, xóa
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
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
