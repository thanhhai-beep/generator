
'use client';

import { useState, useEffect } from 'react';
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
import { Pencil, Trash2, Save, KeyRound, Server, TestTube, CheckCircle2, XCircle, Loader2, HelpCircle } from 'lucide-react';
import { testProxy, type TestProxyResult } from '@/app/actions';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ProxyAccount = {
  id: string;
  name: string;
  proxy: string;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
};

type TestStatus = 'idle' | 'testing' | 'success' | 'failed';

const emptyAccountForm: Omit<ProxyAccount, 'id'> = { name: '', proxy: '', protocol: 'http' };

function TestStatusBadge({ status }: { status: TestStatus }) {
    if (status === 'testing') {
        return <Badge variant="outline"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Testing</Badge>
    }
    if (status === 'success') {
        return <Badge variant="secondary" className="text-green-600"><CheckCircle2 className="mr-2 h-4 w-4"/>Success</Badge>
    }
    if (status === 'failed') {
        return <Badge variant="destructive"><XCircle className="mr-2 h-4 w-4"/>Failed</Badge>
    }
    return null;
}

export default function ProxyManagerPage() {
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [accounts, setAccounts] = useState<ProxyAccount[]>([]);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm);

  const [testResults, setTestResults] = useState<Record<string, { status: TestStatus; message?: string }>>({});

  useEffect(() => {
    setIsClient(true);
    try {
      const savedAccounts = localStorage.getItem('proxyAccounts');
      if (savedAccounts) {
        const parsed = JSON.parse(savedAccounts).map((acc: any) => ({
            ...acc,
            protocol: acc.protocol || 'http' // Add default protocol for old data
        }));
        setAccounts(parsed);
      }
    } catch (error) {
      console.error("Failed to parse accounts from localStorage", error);
      toast({ title: "Could not load saved accounts", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('proxyAccounts', JSON.stringify(accounts));
    }
  }, [accounts, isClient]);
  
  const handleAccountFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountForm(prev => ({ ...prev, [name]: value }));
  };

  const handleProtocolChange = (value: ProxyAccount['protocol']) => {
    setAccountForm(prev => ({...prev, protocol: value}));
  };

  const handleSaveAccount = () => {
    if (!accountForm.name || !accountForm.proxy) {
      toast({ title: "Missing fields", description: "Account Name and Proxy String are required.", variant: "destructive" });
      return;
    }
    if (editingAccountId) {
      setAccounts(accounts.map(acc => acc.id === editingAccountId ? { ...accountForm, id: editingAccountId } : acc));
      toast({ title: "Proxy account updated" });
    } else {
      const newAccount = { ...accountForm, id: Date.now().toString() };
      setAccounts([...accounts, newAccount]);
      toast({ title: "Proxy account added" });
    }
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  const handleEditAccount = (account: ProxyAccount) => {
    setEditingAccountId(account.id);
    setAccountForm({ name: account.name, proxy: account.proxy, protocol: account.protocol || 'http' });
  };
  
  const handleDeleteAccount = (accountId: string) => {
    if (!confirm('Are you sure you want to delete this proxy account?')) return;
    setAccounts(accounts.filter(acc => acc.id !== accountId));
    toast({ title: "Proxy account deleted" });
  };
  
  const handleCancelEdit = () => {
    setEditingAccountId(null);
    setAccountForm(emptyAccountForm);
  };

  const handleTestProxy = async (account: ProxyAccount) => {
    setTestResults(prev => ({ ...prev, [account.id]: { status: 'testing' } }));

    const result = await testProxy(account.proxy, account.protocol);
    
    setTestResults(prev => ({ 
        ...prev, 
        [account.id]: { 
            status: result.success ? 'success' : 'failed',
            message: result.message,
        }
    }));
    
    toast({
        title: `Test for "${account.name}"`,
        description: result.message,
        variant: result.success ? "default" : "destructive"
    });
  };

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
            <CardTitle>Manage Proxy Accounts</CardTitle>
            <CardDescription>
            Add and manage proxy connection strings or dynamic provider URLs. These are stored in your browser's local storage.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                 <h3 className="font-semibold text-lg flex items-center gap-2">
                    <KeyRound className="h-5 w-5"/>
                    {editingAccountId ? 'Edit Proxy Account' : 'Add New Proxy Account'}
                </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <Label htmlFor="accountName">Account Name</Label>
                        <Input id="accountName" name="name" placeholder="e.g., My Residential Proxy" value={accountForm.name} onChange={handleAccountFormChange} />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="protocol">Protocol</Label>
                        <Select value={accountForm.protocol} onValueChange={handleProtocolChange}>
                            <SelectTrigger id="protocol">
                                <SelectValue placeholder="Select protocol"/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="http">http</SelectItem>
                                <SelectItem value="https">https</SelectItem>
                                <SelectItem value="socks4">socks4</SelectItem>
                                <SelectItem value="socks5">socks5</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1">
                        <Label htmlFor="proxy">Proxy String or Provider URL</Label>
                        <Input id="proxy" name="proxy" type="text" placeholder="http://user:pass@host:port" value={accountForm.proxy} onChange={handleAccountFormChange} />
                    </div>
                 </div>
                  <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" />
                    For dynamic URLs (e.g., from ip2world), select the correct protocol that the URL provides (e.g., socks5).
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
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Protocol</TableHead><TableHead>Proxy String or URL</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {accounts.map(acc => (
                                    <TableRow key={acc.id}>
                                        <TableCell className="font-medium">{acc.name}</TableCell>
                                        <TableCell><Badge variant="outline">{acc.protocol}</Badge></TableCell>
                                        <TableCell className="font-mono text-xs">{acc.proxy}</TableCell>
                                        <TableCell className="text-right space-x-1">
                                             <div className="flex items-center justify-end space-x-1">
                                                <TestStatusBadge status={testResults[acc.id]?.status || 'idle'} />
                                                <Button variant="outline" size="sm" className="h-7" onClick={() => handleTestProxy(acc)} disabled={testResults[acc.id]?.status === 'testing'}>
                                                    <TestTube className="h-4 w-4"/>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditAccount(acc)} disabled={testResults[acc.id]?.status === 'testing'}>
                                                    <Pencil className="h-4 w-4"/>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteAccount(acc.id)} disabled={testResults[acc.id]?.status === 'testing'}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                            </div>
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

    