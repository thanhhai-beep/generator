
'use client';

import { useState, useEffect } from 'react';
import type { Metadata } from 'next';
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
import { Pencil, Trash2, Save, KeyRound } from 'lucide-react';

type Account = {
  id: string;
  name: string;
  accountId: string;
  apiToken: string;
  globalApiKey: string;
  authEmail: string;
};

const emptyAccountForm: Account = { id: '', name: '', accountId: '', apiToken: '', globalApiKey: '', authEmail: '' };

export default function CloudflareAccountsPage() {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<Account>(emptyAccountForm);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedAccounts = localStorage.getItem('cloudflareAccounts');
      if (savedAccounts) {
        // Ensure new fields exist on old data
        const parsedAccounts = JSON.parse(savedAccounts).map((acc: any) => ({
            ...acc,
            globalApiKey: acc.globalApiKey || '',
            authEmail: acc.authEmail || '',
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
      localStorage.setItem('cloudflareAccounts', JSON.stringify(accounts));
    }
  }, [accounts, isClient]);

  const handleAccountFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveAccount = () => {
    if (!accountForm.name || !accountForm.accountId || !accountForm.apiToken) {
      toast({ title: "Missing fields", description: "Please fill in Account Name, Account ID, and API Token.", variant: "destructive" });
      return;
    }
    if (editingAccountId) {
      setAccounts(accounts.map(acc => acc.id === editingAccountId ? { ...accountForm, id: editingAccountId } : acc));
      toast({ title: "Account Updated" });
    } else {
      const newAccount = { ...accountForm, id: Date.now().toString() };
      setAccounts([...accounts, newAccount]);
      toast({ title: "Account Added" });
    }
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  const handleEditAccount = (account: Account) => {
    setEditingAccountId(account.id);
    setAccountForm(account);
  };

  const handleDeleteAccount = (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? This will not remove anything from Cloudflare, only from this application.')) return;
    setAccounts(accounts.filter(acc => acc.id !== accountId));
    const lastSelected = localStorage.getItem('lastSelectedAccountId');
    if (lastSelected === accountId) {
        localStorage.removeItem('lastSelectedAccountId');
    }
    toast({ title: "Account Deleted" });
  };

  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manage Cloudflare Accounts</CardTitle>
          <CardDescription>
            Add, edit, or delete Cloudflare accounts. These are stored securely in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <KeyRound className="h-5 w-5"/>
                    {editingAccountId ? 'Edit Account' : 'Add New Account'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="accountName">Account Name</Label>
                        <Input id="accountName" name="name" placeholder="e.g., My Personal Account" value={accountForm.name} onChange={handleAccountFormChange} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="accountId">Cloudflare Account ID</Label>
                        <Input id="accountId" name="accountId" placeholder="Your Cloudflare Account ID" value={accountForm.accountId} onChange={handleAccountFormChange} />
                    </div>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="apiToken">API Token (Scoped)</Label>
                        <Input id="apiToken" name="apiToken" type="password" placeholder="Your Cloudflare API Token" value={accountForm.apiToken} onChange={handleAccountFormChange} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="globalApiKey">Global API Key (Optional)</Label>
                        <Input id="globalApiKey" name="globalApiKey" type="password" placeholder="Your Global API Key" value={accountForm.globalApiKey} onChange={handleAccountFormChange} />
                    </div>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="authEmail">Email for Global Key (Required if using Global Key)</Label>
                    <Input id="authEmail" name="authEmail" type="email" placeholder="Your Cloudflare account email" value={accountForm.authEmail} onChange={handleAccountFormChange} />
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSaveAccount}>
                        <Save className="mr-2"/>{editingAccountId ? 'Save Changes' : 'Add Account'}
                    </Button>
                    {editingAccountId && <Button variant="ghost" onClick={handleCancelEdit}>Cancel</Button>}
                </div>
            </div>

            {accounts.length > 0 && (
                <div className="space-y-2">
                    <h3 className="font-semibold">Saved Accounts</h3>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Account ID</TableHead><TableHead>Email</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {accounts.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{acc.accountId}</TableCell>
                                        <TableCell>{acc.authEmail}</TableCell>
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
