
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
import { Pencil, Trash2, Save, KeyRound, HelpCircle, FilePenLine } from 'lucide-react';

type HashnodeAccount = {
  id: string;
  name: string;
  token: string;
  publicationId: string;
};

const emptyAccountForm: Omit<HashnodeAccount, 'id'> = { name: '', token: '', publicationId: '' };

export default function HashnodeAccountsManagerPage() {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [accounts, setAccounts] = useState<HashnodeAccount[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedAccounts = localStorage.getItem('hashnodeAccounts');
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
      localStorage.setItem('hashnodeAccounts', JSON.stringify(accounts));
    }
  }, [accounts, isClient]);
  
  const handleAccountFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveAccount = () => {
    if (!accountForm.name || !accountForm.token || !accountForm.publicationId) {
      toast({ title: "Missing required fields", description: "All fields are required.", variant: "destructive" });
      return;
    }
    if (editingAccountId) {
      setAccounts(accounts.map(acc => acc.id === editingAccountId ? { ...accountForm, id: editingAccountId } : acc));
      toast({ title: "Account updated" });
    } else {
      const newAccount = { ...accountForm, id: Date.now().toString() };
      setAccounts([...accounts, newAccount]);
      toast({ title: "Account added" });
    }
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  const handleEditAccount = (account: HashnodeAccount) => {
    setEditingAccountId(account.id);
    setAccountForm({ name: account.name, token: account.token, publicationId: account.publicationId });
  };
  
  const handleDeleteAccount = (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;
    setAccounts(accounts.filter(acc => acc.id !== accountId));
    toast({ title: "Account deleted" });
  };
  
  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><FilePenLine /> Manage Hashnode Accounts</CardTitle>
            <CardDescription>
            Add and manage your Hashnode Personal Access Tokens (PATs) and Publication IDs. These are stored in your browser.
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
                        <Input id="accountName" name="name" placeholder="e.g., My Tech Blog" value={accountForm.name} onChange={handleAccountFormChange} />
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="token">Personal Access Token (PAT)</Label>
                        <Input id="token" name="token" type="password" placeholder="Your Hashnode PAT" value={accountForm.token} onChange={handleAccountFormChange} />
                    </div>
                 </div>
                 <div className="space-y-1">
                    <Label htmlFor="publicationId">Publication ID</Label>
                    <Input id="publicationId" name="publicationId" placeholder="The ID of the publication to post to" value={accountForm.publicationId} onChange={handleAccountFormChange} />
                </div>
                 <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    You can find your PAT in your Hashnode account settings under 'Developer'. The Publication ID is in your blog's dashboard URL.
                 </p>
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
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Publication ID</TableHead><TableHead>Token</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {accounts.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{acc.publicationId}</TableCell>
                                        <TableCell className="font-mono text-xs">...{acc.token.slice(-8)}</TableCell>
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
