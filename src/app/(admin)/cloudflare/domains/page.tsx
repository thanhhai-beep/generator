
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { addMultipleCloudflareDomains, deleteMultipleCloudflareDomains, checkCloudflareDomainsStatus, listDnsRecords, addDnsRecord, updateDnsRecord, deleteDnsRecord, type CloudflareDomainInput, type DnsRecord, type DnsRecordInput, bulkAddDnsRecord, bulkDeleteDnsRecords, type BulkDnsActionResult } from '@/app/actions';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Info,
  Loader2,
  Server,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Trash2,
  Send,
  Copy,
  ListX,
  ShieldAlert,
  Clock,
  RefreshCw,
  Settings,
  Pencil,
  Save,
  BanIcon,
  KeyRound,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_IP = "38.55.214.220";
const IP_OPTIONS = ["38.55.214.220", "38.55.214.188", "146.190.85.47", "154.217.246.94", "8.218.223.86", "154.38.114.152"];
const DNS_RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS'];

type OperationStatus = 'pending' | 'success' | 'failed' | 'processing' | 'deleting' | 'delete_failed' | 'checking' | 'check_failed';

type DomainEntry = {
  id: number;
  name: string;
  ip: string;
  status: OperationStatus;
  message?: string;
  nameservers?: string[];
  cloudflareStatus?: string;
};

type Account = {
  id: string;
  name: string;
  accountId: string;
  apiToken: string;
  globalApiKey: string;
  authEmail: string;
};

const OperationStatusBadge = ({ status }: { status: OperationStatus }) => {
    switch(status) {
        case 'success':
            return <Badge variant="secondary" className="text-green-600"><CheckCircle2 className="mr-2 h-4 w-4"/>Success</Badge>;
        case 'failed':
            return <Badge variant="destructive"><XCircle className="mr-2 h-4 w-4"/>Failed</Badge>;
        case 'processing':
            return <Badge variant="secondary"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Processing</Badge>;
        case 'deleting':
            return <Badge variant="destructive"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Deleting</Badge>;
        case 'delete_failed':
            return <Badge variant="destructive"><ShieldAlert className="mr-2 h-4 w-4"/>Delete Failed</Badge>;
        case 'checking':
            return <Badge variant="secondary"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Checking</Badge>;
        case 'check_failed':
            return <Badge variant="destructive"><XCircle className="mr-2 h-4 w-4"/>Check Failed</Badge>;
        case 'pending':
            return <Badge variant="outline">Pending</Badge>;
        default:
            return <Badge variant="outline">{status}</Badge>;
    }
}

const CloudflareStatusBadge = ({ status }: { status?: string }) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;

    if (status === 'active') {
        return (
            <Badge variant="secondary" className="text-green-600">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Active
            </Badge>
        );
    }
    if (status === 'pending') {
        return (
            <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                <Clock className="mr-2 h-4 w-4" />
                Pending
            </Badge>
        );
    }
    return <Badge variant="outline">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
};

const DnsRecordFormSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  name: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Content is required'),
  proxied: z.boolean(),
  ttl: z.coerce.number().int().min(1, 'TTL must be at least 1 (auto)'),
});

function DnsRecordForm({ domainName, record, onSave, onCancel, apiToken, authEmail, globalApiKey }: {
  domainName: string;
  record: DnsRecord | null;
  onSave: () => void;
  onCancel: () => void;
  apiToken: string;
  authEmail?: string;
  globalApiKey?: string;
}) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const { register, handleSubmit, control, formState: { errors } } = useForm<DnsRecordInput>({
    resolver: zodResolver(DnsRecordFormSchema),
    defaultValues: {
      type: record?.type || 'A',
      name: record?.name || '',
      content: record?.content || '',
      proxied: record?.proxied ?? true,
      ttl: record?.ttl || 1,
    }
  });

  const onSubmit = async (data: DnsRecordInput) => {
    setIsSaving(true);
    const action = record
      ? updateDnsRecord(domainName, record.id, data, apiToken, authEmail, globalApiKey)
      : addDnsRecord(domainName, data, apiToken, authEmail, globalApiKey);
    
    const result = await action;

    if (result.success) {
      toast({ title: 'Success', description: result.message });
      onSave();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4 border bg-muted/50 rounded-lg">
      <h3 className="font-semibold text-lg">{record ? 'Edit' : 'Add'} DNS Record</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="type">Type</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DNS_RECORD_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" {...register('name')} placeholder={`e.g., www, @, *`} />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="content">Content</Label>
        <Input id="content" {...register('content')} placeholder="e.g., IP address or another domain" />
        {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="ttl">TTL</Label>
          <Input id="ttl" type="number" {...register('ttl')} />
          {errors.ttl && <p className="text-xs text-destructive">{errors.ttl.message}</p>}
        </div>
        <div className="space-y-1 flex items-center pt-6 gap-2">
          <Controller
            name="proxied"
            control={control}
            render={({ field }) => <Switch id="proxied" checked={field.value} onCheckedChange={field.onChange} />}
          />
          <Label htmlFor="proxied">Proxied (Orange Cloud)</Label>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2"/>}
          Save Record
        </Button>
      </div>
    </form>
  )
}


function DnsManagerDialog({ domain, onOpenChange, apiToken, authEmail, globalApiKey }: { domain: DomainEntry, onOpenChange: () => void, apiToken: string, authEmail?: string, globalApiKey?: string }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'list' | 'edit' | 'add'>('list');
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRecord, setCurrentRecord] = useState<DnsRecord | null>(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    const result = await listDnsRecords(domain.name, apiToken, authEmail, globalApiKey);
    if (result.success && result.records) {
      setRecords(result.records);
    } else {
      toast({ title: 'Error fetching records', description: result.message, variant: 'destructive' });
    }
    setIsLoading(false);
  }, [domain.name, apiToken, authEmail, globalApiKey, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleAddClick = () => {
    setCurrentRecord(null);
    setMode('add');
  };

  const handleEditClick = (record: DnsRecord) => {
    setCurrentRecord(record);
    setMode('edit');
  };

  const handleDeleteClick = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this DNS record? This action cannot be undone.')) return;
    
    const result = await deleteDnsRecord(domain.name, recordId, apiToken, authEmail, globalApiKey);
    if (result.success) {
      toast({ title: 'Success', description: result.message });
      fetchRecords();
    } else {
      toast({ title: 'Error', description: result.message, variant: 'destructive' });
    }
  };

  const handleFormSave = () => {
    setMode('list');
    setCurrentRecord(null);
    fetchRecords();
  };

  const handleFormCancel = () => {
    setMode('list');
    setCurrentRecord(null);
  };
  
  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage DNS Records for <span className="font-mono">{domain.name}</span></DialogTitle>
          <DialogDescription>
            View, add, edit, or delete DNS records for this domain.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : mode === 'list' ? (
            <div className="space-y-4">
               <Button onClick={handleAddClick}><PlusCircle className="mr-2"/>Add Record</Button>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Proxied</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map(rec => (
                    <TableRow key={rec.id}>
                      <TableCell><Badge variant="outline">{rec.type}</Badge></TableCell>
                      <TableCell className="font-mono">{rec.name}</TableCell>
                      <TableCell className="font-mono max-w-xs truncate">{rec.content}</TableCell>
                      <TableCell>{rec.proxied ? <CheckCircle2 className="text-green-500"/> : <BanIcon className="text-muted-foreground"/>}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(rec)}><Pencil className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(rec.id)}><Trash2 className="h-4 w-4"/></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
               </Table>
            </div>
          ) : (
            <DnsRecordForm
              domainName={domain.name}
              record={currentRecord}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
              apiToken={apiToken}
              authEmail={authEmail}
              globalApiKey={globalApiKey}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const BulkDnsDeleteSchema = z.object({
  type: z.string().min(1, 'Type is required'),
  name: z.string().min(1, 'Name is required'),
});

function BulkDnsDialog({ domains, open, onOpenChange, apiToken, authEmail, globalApiKey }: { domains: DomainEntry[], open: boolean, onOpenChange: (open: boolean) => void, apiToken: string, authEmail?: string, globalApiKey?: string }) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BulkDnsActionResult[]>([]);

  const { register: registerAdd, handleSubmit: handleSubmitAdd, control: controlAdd, formState: { errors: errorsAdd } } = useForm<DnsRecordInput>({
    resolver: zodResolver(DnsRecordFormSchema),
    defaultValues: { type: 'A', name: '', content: '', proxied: true, ttl: 1 }
  });

  const { register: registerDelete, handleSubmit: handleSubmitDelete, control: controlDelete, formState: { errors: errorsDelete } } = useForm<{type: string, name: string}>({
    resolver: zodResolver(BulkDnsDeleteSchema),
    defaultValues: { type: 'A', name: '' }
  });

  const onBulkAdd = async (data: DnsRecordInput) => {
    setIsProcessing(true);
    setResults([]);
    const domainNames = domains.map(d => d.name);
    const res = await bulkAddDnsRecord(domainNames, data, apiToken, authEmail, globalApiKey);
    setResults(res);
    toast({ title: 'Bulk Add Complete', description: `Processed ${res.length} domains.` });
    setIsProcessing(false);
  }

  const onBulkDelete = async (data: {type: string, name: string}) => {
    setIsProcessing(true);
    setResults([]);
    const domainNames = domains.map(d => d.name);
    const res = await bulkDeleteDnsRecords(domainNames, data, apiToken, authEmail, globalApiKey);
    setResults(res);
    toast({ title: 'Bulk Delete Complete', description: `Processed ${res.length} domains.` });
    setIsProcessing(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk DNS Actions for {domains.length} Domains</DialogTitle>
          <DialogDescription>
            Apply DNS changes to all selected domains. Actions performed here are irreversible.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto pr-2">
            <Tabs defaultValue="add">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="add">Bulk Add Record</TabsTrigger>
                    <TabsTrigger value="delete" className="text-destructive">Bulk Delete Records</TabsTrigger>
                </TabsList>
                <TabsContent value="add" className="pt-4">
                    <form onSubmit={handleSubmitAdd(onBulkAdd)} className="space-y-4 p-4 border bg-muted/50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="add-type">Type</Label>
                                <Controller name="type" control={controlAdd} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger id="add-type"><SelectValue /></SelectTrigger>
                                        <SelectContent>{DNS_RECORD_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}/>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="add-name">Name</Label>
                                <Input id="add-name" {...registerAdd('name')} placeholder="e.g., www, @, *" />
                                {errorsAdd.name && <p className="text-xs text-destructive">{errorsAdd.name.message}</p>}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="add-content">Content</Label>
                            <Input id="add-content" {...registerAdd('content')} placeholder="e.g., IP address or another domain" />
                            {errorsAdd.content && <p className="text-xs text-destructive">{errorsAdd.content.message}</p>}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="add-ttl">TTL</Label>
                                <Input id="add-ttl" type="number" {...registerAdd('ttl')} />
                                {errorsAdd.ttl && <p className="text-xs text-destructive">{errorsAdd.ttl.message}</p>}
                            </div>
                            <div className="space-y-1 flex items-center pt-6 gap-2">
                                <Controller name="proxied" control={controlAdd} render={({ field }) => <Switch id="add-proxied" checked={field.value} onCheckedChange={field.onChange} />} />
                                <Label htmlFor="add-proxied">Proxied</Label>
                            </div>
                        </div>
                        <Button type="submit" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <PlusCircle className="mr-2"/>}
                            Add Record to {domains.length} Domains
                        </Button>
                    </form>
                </TabsContent>
                <TabsContent value="delete" className="pt-4">
                    <form onSubmit={handleSubmitDelete(onBulkDelete)} className="space-y-4 p-4 border border-destructive/50 bg-muted/50 rounded-lg">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label htmlFor="delete-type">Type</Label>
                                <Controller name="type" control={controlDelete} render={({ field }) => (
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <SelectTrigger id="delete-type"><SelectValue /></SelectTrigger>
                                        <SelectContent>{DNS_RECORD_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                    </Select>
                                )}/>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="delete-name">Name</Label>
                                <Input id="delete-name" {...registerDelete('name')} placeholder="e.g., www, @, *" />
                                {errorsDelete.name && <p className="text-xs text-destructive">{errorsDelete.name.message}</p>}
                            </div>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button type="button" variant="destructive" disabled={isProcessing}>
                                    {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <Trash2 className="mr-2"/>}
                                    Delete Records from {domains.length} Domains
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete all DNS records matching this Type and Name from the selected {domains.length} domains. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleSubmitDelete(onBulkDelete)} className="bg-destructive hover:bg-destructive/90">Yes, delete records</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </form>
                </TabsContent>
            </Tabs>

            {results.length > 0 && (
                <div className="mt-4 space-y-2">
                    <h3 className="font-semibold">Bulk Operation Results</h3>
                    <ScrollArea className="h-64 border rounded-md p-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Domain</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Message</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map(res => (
                                    <TableRow key={res.domain}>
                                        <TableCell className="font-medium">{res.domain}</TableCell>
                                        <TableCell>{res.success ? <CheckCircle2 className="text-green-500" /> : <XCircle className="text-destructive" />}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{res.message}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CloudflareDomainsPage() {
  const [allDomains, setAllDomains] = useState<{ [key: string]: DomainEntry[] }>({});
  const [isClient, setIsClient] = useState(false);
  const [selectedIp, setSelectedIp] = useState(DEFAULT_IP);
  const [domainInput, setDomainInput] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [managingDomain, setManagingDomain] = useState<DomainEntry | null>(null);
  const [isBulkDnsDialogOpen, setIsBulkDnsDialogOpen] = useState(false);
  
  const [recordsToCreate, setRecordsToCreate] = useState({
    root: true,
    www: true,
    m: false,
    wildcard: false,
  });
  const [customRecords, setCustomRecords] = useState('');
  const [sslMode, setSslMode] = useState<'full' | 'flexible'>('full');

  // Account Management State
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  const activeAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);
  const isAccountSelected = !!activeAccount;
  const domains = useMemo(() => (selectedAccountId ? allDomains[selectedAccountId] : []) || [], [allDomains, selectedAccountId]);
  
  useEffect(() => {
    setIsClient(true);
    try {
      const savedDomains = localStorage.getItem('cloudflareDomainsByAccount');
      if (savedDomains) {
        setAllDomains(JSON.parse(savedDomains));
      }
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
      console.error("Failed to parse from localStorage", error);
      toast({ title: "Could not load saved data", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('cloudflareDomainsByAccount', JSON.stringify(allDomains));
    }
  }, [allDomains, isClient]);

  useEffect(() => {
    if (isClient && selectedAccountId) {
        localStorage.setItem('lastSelectedAccountId', selectedAccountId);
    }
  }, [selectedAccountId, isClient]);


  const handleAddDomain = () => {
    if (!selectedAccountId) return;
    const newDomains = domainInput
      .split(/[\n\s,]+/)
      .map(d => d.trim())
      .filter(Boolean);

    if (newDomains.length > 0) {
      const newEntries: DomainEntry[] = newDomains.map(name => ({
        id: Date.now() + Math.random(),
        name,
        ip: selectedIp,
        status: 'pending',
      }));
      setAllDomains(prev => ({
        ...prev,
        [selectedAccountId]: [...(prev[selectedAccountId] || []), ...newEntries]
      }));
      setDomainInput('');
    }
  };
  
  const selectedDomainObjects = useMemo(() => {
    const selectedIds = Array.from(selectedRows);
    return domains.filter(d => selectedIds.includes(d.id));
  }, [selectedRows, domains]);


  const handleManageDns = () => {
    if (selectedRows.size !== 1) return;
    const selectedId = selectedRows.values().next().value;
    const domainToManage = domains.find(d => d.id === selectedId);
    if (domainToManage) {
        setManagingDomain(domainToManage);
    }
  };

  const handleProcessSelected = async () => {
    if (!activeAccount) {
      toast({ title: 'No account selected', description: 'Please select an active Cloudflare account first.', variant: 'destructive' });
      return;
    }

    const getSelectedRecords = () => {
        const selected = [];
        if (recordsToCreate.root) selected.push('@');
        if (recordsToCreate.www) selected.push('www');
        if (recordsToCreate.m) selected.push('m');
        if (recordsToCreate.wildcard) selected.push('*');
        const custom = customRecords.split(/[\s,]+/).map(r => r.trim()).filter(Boolean);
        return [...selected, ...custom];
    };
    
    const records = getSelectedRecords();
    if (records.length === 0) {
      toast({
        title: 'No DNS Records Selected',
        description: 'Please select at least one record type to create (e.g., @ or www).',
        variant: 'destructive',
      });
      return;
    }

    const rowsToProcess = domains.filter(d => selectedRows.has(d.id));
    if (rowsToProcess.length === 0) {
      toast({ title: 'No domains selected', description: 'Please select domains to process.' });
      return;
    }

    setIsProcessing(true);

    const domainsToSubmit: CloudflareDomainInput[] = rowsToProcess.map(d => ({ 
        domain: d.name, 
        ipAddress: d.ip,
        records: records,
        sslMode: sslMode,
    }));

    setAllDomains(prev => ({
      ...prev,
      [activeAccount.id]: prev[activeAccount.id].map(d =>
        selectedRows.has(d.id) ? { ...d, status: 'processing' } : d
      )
    }));

    try {
      const results = await addMultipleCloudflareDomains(domainsToSubmit, activeAccount.accountId, activeAccount.apiToken, activeAccount.globalApiKey, activeAccount.authEmail);
      
      setAllDomains(prev => ({
        ...prev,
        [activeAccount.id]: prev[activeAccount.id].map(d => {
          const result = results.find(r => r.domain === d.name);
          if (result) {
            return {
              ...d,
              status: result.success ? 'success' : 'failed',
              message: result.message,
              nameservers: result.name_servers,
              cloudflareStatus: result.cloudflare_status,
            };
          }
          return d;
        })
      }));

      const successCount = results.filter(r => r.success).length;
      toast({
        title: 'Processing Complete',
        description: `${successCount} of ${results.length} domains processed successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'An unexpected error occurred',
        description: error.message || 'Failed to process the request.',
        variant: 'destructive',
      });
      setAllDomains(prev => ({
        ...prev,
        [activeAccount.id]: prev[activeAccount.id].map(d =>
          selectedRows.has(d.id) ? { ...d, status: 'failed', message: error.message } : d
        )
      }));
    } finally {
      setIsProcessing(false);
      setSelectedRows(new Set());
    }
  };

  const handleCheckStatus = async () => {
    if (!activeAccount) {
      toast({ title: 'No account selected', description: 'Please select an active Cloudflare account first.', variant: 'destructive' });
      return;
    }

    const rowsToCheck = domains.filter(d => selectedRows.has(d.id));
    if (rowsToCheck.length === 0) {
        toast({ title: 'No domains selected', description: 'Please select domains to check.' });
        return;
    }

    setIsProcessing(true);
    setAllDomains(prev => ({
      ...prev,
      [activeAccount.id]: prev[activeAccount.id].map(d =>
        selectedRows.has(d.id) ? { ...d, status: 'checking' } : d
      )
    }));

    const domainNames = rowsToCheck.map(d => d.name);
    
    try {
        const results = await checkCloudflareDomainsStatus(domainNames, activeAccount.apiToken, activeAccount.globalApiKey, activeAccount.authEmail);

        setAllDomains(prev => ({
          ...prev,
          [activeAccount.id]: prev[activeAccount.id].map(d => {
            const result = results.find(r => r.domain === d.name);
            if (result) {
                return {
                    ...d,
                    status: result.success ? 'success' : 'check_failed',
                    message: result.message,
                    cloudflareStatus: result.cloudflare_status,
                };
            }
            return d;
          })
        }));
        
        toast({ title: "Status check complete." });

    } catch (error: any) {
        toast({ title: 'Error checking status', description: error.message, variant: 'destructive' });
        setAllDomains(prev => ({
          ...prev,
          [activeAccount.id]: prev[activeAccount.id].map(d =>
            selectedRows.has(d.id) ? { ...d, status: 'check_failed', message: 'Client-side error.' } : d
          )
        }));
    } finally {
        setIsProcessing(false);
        setSelectedRows(new Set());
    }
  }

  const handleDeleteFromCloudflare = async () => {
    if (!activeAccount) {
      toast({ title: 'No account selected', description: 'Please select an active Cloudflare account first.', variant: 'destructive' });
      return;
    }

    const rowsToDelete = domains.filter(d => selectedRows.has(d.id));
    if (rowsToDelete.length === 0) {
      toast({ title: 'No domains selected', description: 'Please select domains to delete from Cloudflare.' });
      return;
    }
    
    setIsProcessing(true);
    setAllDomains(prev => ({
      ...prev,
      [activeAccount.id]: prev[activeAccount.id].map(d =>
        selectedRows.has(d.id) ? { ...d, status: 'deleting' } : d
      )
    }));

    const domainsToDeleteNames = rowsToDelete.map(d => d.name);

    try {
        const results = await deleteMultipleCloudflareDomains(domainsToDeleteNames, activeAccount.apiToken, activeAccount.globalApiKey, activeAccount.authEmail);
        
        const successfulDeletes = new Set(results.filter(r => r.success).map(r => r.domain));

        setAllDomains(prevAll => {
          const currentDomains = prevAll[activeAccount.id] || [];
          const remainingDomains = currentDomains.filter(d => !successfulDeletes.has(d.name));
          // For failed deletions, we need to update their status, not remove them.
          const updatedWithFailures = (prevAll[activeAccount.id] || []).map(d => {
             if (successfulDeletes.has(d.name)) return null; // will be filtered out
             const result = results.find(r => r.domain === d.name && !r.success);
             if (result) {
                return { ...d, status: 'delete_failed', message: result.message };
             }
             return d;
          }).filter((d): d is DomainEntry => d !== null);


          return { ...prevAll, [activeAccount.id]: updatedWithFailures };
        });

        toast({
            title: 'Deletion Complete',
            description: `${successfulDeletes.size} of ${results.length} domains deleted successfully.`,
        });

    } catch (error: any) {
         toast({
            title: 'An unexpected error occurred during deletion',
            description: error.message || 'Failed to process the request.',
            variant: 'destructive',
        });
        setAllDomains(prev => ({
          ...prev,
          [activeAccount.id]: prev[activeAccount.id].map(d =>
            selectedRows.has(d.id) ? { ...d, status: 'delete_failed', message: "Client-side error." } : d
          )
        }));
    } finally {
        setIsProcessing(false);
        setSelectedRows(new Set());
        setIsDeleteAlertOpen(false);
    }
  };


  const handleRowSelect = (id: number, checked: boolean) => {
    const newSelectedRows = new Set(selectedRows);
    if (checked) {
      newSelectedRows.add(id);
    } else {
      newSelectedRows.delete(id);
    }
    setSelectedRows(newSelectedRows);
  };
  
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
        const allIds = domains.map(d => d.id);
        setSelectedRows(new Set(allIds));
    } else {
        setSelectedRows(new Set());
    }
  }
  
  const handleRemoveFromList = () => {
    if (!selectedAccountId) return;
      setAllDomains(prev => ({
        ...prev,
        [selectedAccountId]: prev[selectedAccountId]?.filter(d => !selectedRows.has(d.id)) || []
      }));
      setSelectedRows(new Set());
  }

  const groupedResults = useMemo(() => {
    const successfulDomains = domains.filter(d => d.status === 'success' && d.nameservers);
    if (successfulDomains.length === 0) return [];
    
    const groups = new Map<string, DomainEntry[]>();
    
    successfulDomains.forEach(domain => {
      const key = domain.nameservers!.sort().join(', ');
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(domain);
    });
    
    return Array.from(groups.entries());
  }, [domains]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Nameservers copied to clipboard.' });
  };

  const allRowsSelected = domains.length > 0 && selectedRows.size === domains.length;
  const isActionDisabled = isProcessing || !isAccountSelected;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <CardTitle>Active Cloudflare Account</CardTitle>
            <CardDescription>Select an account for all operations. Manage accounts on the Cloudflare Accounts page.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                <div className="space-y-2 flex-grow max-w-md">
                    <Label htmlFor="active-account-select">Active Account</Label>
                    <Select value={selectedAccountId || ''} onValueChange={(value) => { setSelectedRows(new Set()); setSelectedAccountId(value); }}>
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
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={['item-add-domains']} className="w-full space-y-4">
        <AccordionItem value="item-add-domains" className="border-b-0 rounded-lg bg-card text-card-foreground shadow-sm">
           <AccordionTrigger className="p-6 hover:no-underline" disabled={!isAccountSelected}>
               <div className="text-left space-y-1.5">
                    <h3 className="text-2xl font-semibold leading-none tracking-tight">1. Add & Configure Domains</h3>
                    <p className="text-sm text-muted-foreground">
                        Choose IP, enter domains, and select which DNS records to create.
                    </p>
                </div>
           </AccordionTrigger>
            <AccordionContent>
                <div className="p-6 pt-0 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 sm:col-span-1">
                        <Label>IP Address</Label>
                        <Select value={selectedIp} onValueChange={setSelectedIp}>
                        <SelectTrigger aria-label="Select IP Address">
                            <SelectValue placeholder="Select an IP" />
                        </SelectTrigger>
                        <SelectContent>
                            {IP_OPTIONS.map(ip => (
                            <SelectItem key={ip} value={ip}>{ip}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="domain-input">Domain Names</Label>
                        <Textarea
                            id="domain-input"
                            placeholder="domain1.com, domain2.com"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                            disabled={isProcessing}
                            className="min-h-24"
                        />
                        <p className="text-xs text-muted-foreground">You can enter multiple domains separated by space, comma, or new line.</p>
                    </div>
                    </div>
                    <div className="space-y-3 pt-4">
                    <Label>DNS Records to Create</Label>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="record-root" checked={recordsToCreate.root} onCheckedChange={(checked) => setRecordsToCreate((prev) => ({ ...prev, root: !!checked }))} disabled={isProcessing} />
                            <Label htmlFor="record-root" className="text-sm font-normal cursor-pointer"><code>@</code> (root)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="record-www" checked={recordsToCreate.www} onCheckedChange={(checked) => setRecordsToCreate((prev) => ({ ...prev, www: !!checked }))} disabled={isProcessing}/>
                            <Label htmlFor="record-www" className="text-sm font-normal cursor-pointer"><code>www</code></Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="record-m" checked={recordsToCreate.m} onCheckedChange={(checked) => setRecordsToCreate((prev) => ({ ...prev, m: !!checked }))} disabled={isProcessing}/>
                            <Label htmlFor="record-m" className="text-sm font-normal cursor-pointer"><code>m</code></Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="record-wildcard" checked={recordsToCreate.wildcard} onCheckedChange={(checked) => setRecordsToCreate((prev) => ({ ...prev, wildcard: !!checked }))} disabled={isProcessing}/>
                            <Label htmlFor="record-wildcard" className="text-sm font-normal cursor-pointer"><code>*.</code> (wildcard)</Label>
                        </div>
                    </div>
                    <div className="space-y-2 pt-2">
                        <Label htmlFor="custom-records">Custom Subdomains</Label>
                        <Input id="custom-records" placeholder="e.g., blog, mail, shop" value={customRecords} onChange={(e) => setCustomRecords(e.target.value)} disabled={isProcessing}/>
                        <p className="text-xs text-muted-foreground">Enter comma or space-separated subdomains.</p>
                    </div>
                    </div>
                    <div className="space-y-3 pt-4">
                    <Label>SSL/TLS Encryption Mode</Label>
                    <RadioGroup value={sslMode} onValueChange={(value: 'full' | 'flexible') => setSslMode(value)} className="flex items-center gap-6" disabled={isProcessing}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="full" id="ssl-full" />
                            <Label htmlFor="ssl-full" className="cursor-pointer font-normal">Full</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="flexible" id="ssl-flexible" />
                            <Label htmlFor="ssl-flexible" className="cursor-pointer font-normal">Flexible</Label>
                        </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">'Full' encrypts end-to-end (requires a certificate on your server). 'Flexible' encrypts browser-to-Cloudflare only.</p>
                    </div>
                </div>
                <div className="flex items-center p-6 pt-0">
                    <Button onClick={handleAddDomain} disabled={isProcessing || !domainInput.trim()}>
                        <PlusCircle className="mr-2" /> Add to List
                    </Button>
                </div>
            </AccordionContent>
          </AccordionItem>

          {domains.length > 0 && (
            <AccordionItem value="item-process-queue" className="border-b-0 rounded-lg bg-card text-card-foreground shadow-sm" defaultOpen>
              <AccordionTrigger className="p-6 hover:no-underline">
                 <div className="text-left space-y-1.5">
                    <h3 className="text-2xl font-semibold leading-none tracking-tight">2. Process Queue</h3>
                    <p className="text-sm text-muted-foreground">
                      Select domains from the list and perform actions using the active account. Your list is saved in your browser.
                    </p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="px-6 pb-6 space-y-4">
                  <div className="flex flex-wrap items-center gap-2 pt-4">
                      <Button onClick={handleProcessSelected} disabled={isActionDisabled || selectedRows.size === 0}>
                          {isProcessing && domains.some(d => selectedRows.has(d.id) && d.status === 'processing') ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                          Add to Cloudflare
                      </Button>
                      <Button onClick={handleManageDns} disabled={isActionDisabled || selectedRows.size !== 1} variant="outline">
                          <Settings className="mr-2 h-4 w-4" />
                          Manage DNS
                      </Button>
                      <Button onClick={() => setIsBulkDnsDialogOpen(true)} disabled={isActionDisabled || selectedRows.size < 2} variant="outline">
                          <Settings className="mr-2 h-4 w-4" />
                          Bulk Manage DNS
                      </Button>
                      <Button onClick={handleCheckStatus} disabled={isActionDisabled || selectedRows.size === 0} variant="outline">
                          {isProcessing && domains.some(d => selectedRows.has(d.id) && d.status === 'checking') ? <Loader2 className="mr-2 animate-spin" /> : <RefreshCw className="mr-2" />}
                          Check Status
                      </Button>
                      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                          <AlertDialogTrigger asChild>
                              <Button variant="destructive" disabled={isActionDisabled || selectedRows.size === 0}>
                                {isProcessing && domains.some(d => selectedRows.has(d.id) && d.status === 'deleting') ? <Loader2 className="mr-2 animate-spin" /> : <Trash2 className="mr-2" />}
                                  Delete from Cloudflare
                              </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      This action is irreversible. You are about to permanently delete {' '}
                                      <strong>{selectedRows.size}</strong> domain(s) from your Cloudflare account.
                                      This will remove all associated DNS records and settings.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteFromCloudflare} className="bg-destructive hover:bg-destructive/90">
                                      Yes, delete domain(s)
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                      </AlertDialog>
                      <Button variant="outline" onClick={handleRemoveFromList} disabled={isProcessing || selectedRows.size === 0}>
                          <ListX className="mr-2" />
                          Remove from List
                      </Button>
                  </div>
                  {!isAccountSelected && <Alert variant="destructive" className="mt-4"><ShieldAlert className="h-4 w-4" /><AlertTitle>No Active Account</AlertTitle><AlertDescription>Please select or add a Cloudflare account to enable actions.</AlertDescription></Alert>}
                  
                  <div className="max-h-[600px] overflow-auto border rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox 
                              onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                              checked={allRowsSelected}
                              aria-label="Select all rows"
                              />
                          </TableHead>
                          <TableHead>Domain</TableHead>
                          <TableHead>IP Address</TableHead>
                          <TableHead>Cloudflare Status</TableHead>
                          <TableHead>Last Operation</TableHead>
                          <TableHead>Result / Message</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {domains.map(domain => (
                          <TableRow key={domain.id} data-state={selectedRows.has(domain.id) ? "selected" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRows.has(domain.id)}
                                onCheckedChange={(checked) => handleRowSelect(domain.id, Boolean(checked))}
                                aria-label={`Select domain ${domain.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{domain.name}</TableCell>
                            <TableCell className="font-mono text-xs">{domain.ip}</TableCell>
                            <TableCell>
                              <CloudflareStatusBadge status={domain.cloudflareStatus} />
                            </TableCell>
                            <TableCell>
                              <OperationStatusBadge status={domain.status} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{domain.message}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {groupedResults.length > 0 && (
             <AccordionItem value="item-results" className="border-b-0 rounded-lg bg-card text-card-foreground shadow-sm">
              <AccordionTrigger className="p-6 hover:no-underline">
                  <div className="text-left space-y-1.5">
                    <h3 className="text-2xl font-semibold leading-none tracking-tight">3. Nameserver Groups</h3>
                    <p className="text-sm text-muted-foreground">
                      Successfully added domains are grouped by their assigned Cloudflare nameservers.
                    </p>
                  </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="p-6 pt-0 space-y-4">
                  {groupedResults.map(([nsKey, domainsInGroup]) => (
                      <Card key={nsKey} className="bg-muted/50">
                          <CardHeader className="pb-2">
                              <div className="flex justify-between items-start">
                                  <div>
                                      <CardTitle className="text-lg flex items-center gap-2">
                                          <Server className="h-5 w-5"/>
                                          Nameservers
                                      </CardTitle>
                                      <div className="font-mono text-sm text-muted-foreground pt-2 space-y-1">
                                          {nsKey.split(', ').map(ns => <p key={ns}>{ns}</p>)}
                                      </div>
                                  </div>
                                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(nsKey.split(', ').join('\n'))}>
                                      <Copy className="h-4 w-4" />
                                  </Button>
                              </div>
                          </CardHeader>
                          <CardContent>
                              <p className="text-sm font-medium mb-2">Domains in this group ({domainsInGroup.length}):</p>
                              <div className="flex flex-wrap gap-2">
                                  {domainsInGroup.map(d => (
                                      <Badge key={d.id} variant="secondary">{d.name}</Badge>
                                  ))}
                              </div>
                          </CardContent>
                      </Card>
                  ))}
                </div>
              </AccordionContent>
             </AccordionItem>
          )}
      </Accordion>

      {managingDomain && activeAccount && (
        <DnsManagerDialog 
          key={managingDomain.id}
          domain={managingDomain}
          onOpenChange={() => setManagingDomain(null)}
          apiToken={activeAccount.apiToken}
          authEmail={activeAccount.authEmail}
          globalApiKey={activeAccount.globalApiKey}
        />
      )}

      {isBulkDnsDialogOpen && activeAccount && selectedDomainObjects.length > 0 && (
        <BulkDnsDialog
            domains={selectedDomainObjects}
            open={isBulkDnsDialogOpen}
            onOpenChange={setIsBulkDnsDialogOpen}
            apiToken={activeAccount.apiToken}
            authEmail={activeAccount.authEmail}
            globalApiKey={activeAccount.globalApiKey}
        />
      )}

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How it Works</AlertTitle>
        <AlertDescription>
          1. Select an active account (or add one on the Accounts page). 2. Add domains to the queue. 3. Select domains and perform actions. Your accounts and domain list are saved in your browser.
        </AlertDescription>
      </Alert>
    </div>
  );
}
