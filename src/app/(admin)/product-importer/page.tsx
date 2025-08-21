
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Download, Wand2, LinkIcon, BrainCircuit } from 'lucide-react';
import { extractProductData, generateProductDataFromName } from '@/lib/server-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


function downloadFile(filename: string, content: string, mimeType: string) {
    const element = document.createElement("a");
    const file = new Blob([content], {type: mimeType});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function UrlImporter() {
    const [url, setUrl] = useState('https://zenmarket.jp/en/yahoo.aspx?c=23640&p=1');
    const [isLoading, setIsLoading] = useState(false);
    const [resultCsv, setResultCsv] = useState('');
    const { toast } = useToast();

    const handleProcessUrl = async () => {
        if (!url.trim()) {
            toast({ title: 'URL is missing', description: 'Please provide a product URL to process.', variant: 'destructive'});
            return;
        }

        setIsLoading(true);
        setResultCsv('');

        try {
            const result = await extractProductData(url);
            if (result.success && result.csvData) {
                setResultCsv(result.csvData);
                toast({ title: 'Processing Complete', description: 'Product data has been extracted and converted to CSV.' });
            } else {
                toast({ title: 'Processing Failed', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'An unexpected error occurred', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = () => {
        if (!resultCsv) {
            toast({ title: 'No data to download', variant: 'destructive' });
            return;
        }
        downloadFile('product_data_from_url.csv', resultCsv, 'text/csv;charset=utf-8;');
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>1. Enter URL</CardTitle>
                    <CardDescription>
                        Enter a product listing URL from a supported Japanese e-commerce site (like ZenMarket/Yahoo Auctions).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-1.5">
                        <Label htmlFor="product-url">Product Listing URL</Label>
                        <div className="flex gap-2">
                           <Input
                                id="product-url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://zenmarket.jp/en/yahoo.aspx?c=..."
                                disabled={isLoading}
                            />
                            <Button onClick={handleProcessUrl} disabled={isLoading || !url.trim()}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                {isLoading ? 'Processing...' : 'Process URL'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {resultCsv && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. Result (CSV Format)</CardTitle>
                        <CardDescription>
                            Review the extracted data below. You can download it as a CSV file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            readOnly
                            value={resultCsv}
                            className="h-96 font-mono text-xs"
                        />
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleDownload} variant="secondary">
                            <Download className="mr-2 h-4 w-4" />
                            Download CSV
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}

function NameGenerator() {
    const [productName, setProductName] = useState('Sony A7 IV Mirrorless Camera');
    const [isLoading, setIsLoading] = useState(false);
    const [resultCsv, setResultCsv] = useState('');
    const { toast } = useToast();

    const handleGenerate = async () => {
        if (!productName.trim()) {
            toast({ title: 'Product name is missing', description: 'Please provide a product name to generate data.', variant: 'destructive'});
            return;
        }

        setIsLoading(true);
        setResultCsv('');

        try {
            const result = await generateProductDataFromName(productName);
            if (result.success && result.csvData) {
                setResultCsv(result.csvData);
                toast({ title: 'Generation Complete', description: 'Product data has been generated by AI.' });
            } else {
                toast({ title: 'Generation Failed', description: result.message, variant: 'destructive' });
            }
        } catch (error: any) {
            toast({ title: 'An unexpected error occurred', description: error.message, variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleDownload = () => {
        if (!resultCsv) {
            toast({ title: 'No data to download', variant: 'destructive' });
            return;
        }
        downloadFile('product_data_from_name.csv', resultCsv, 'text/csv;charset=utf-8;');
    }
    
    return (
         <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>1. Enter Product Name</CardTitle>
                    <CardDescription>
                        Provide a product name in English. The AI will generate all other details in Japanese.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-1.5">
                        <Label htmlFor="product-name">Product Name</Label>
                        <div className="flex gap-2">
                           <Input
                                id="product-name"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                placeholder="e.g., Sony A7 IV Mirrorless Camera"
                                disabled={isLoading}
                            />
                            <Button onClick={handleGenerate} disabled={isLoading || !productName.trim()}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
                                {isLoading ? 'Generating...' : 'Generate Data'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {resultCsv && (
                <Card>
                    <CardHeader>
                        <CardTitle>2. AI-Generated Result (CSV Format)</CardTitle>
                        <CardDescription>
                            Review the generated data below. You can download it as a CSV file.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Textarea
                            readOnly
                            value={resultCsv}
                            className="h-96 font-mono text-xs"
                        />
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleDownload} variant="secondary">
                            <Download className="mr-2 h-4 w-4" />
                            Download CSV
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </div>
    )
}

export default function ProductImporterPage() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Product Data Importer & Generator</CardTitle>
                    <CardDescription>
                        Choose a method to get your product data. Extract from a live URL or generate from a product name using AI.
                    </CardDescription>
                </CardHeader>
            </Card>
            <Tabs defaultValue="importer">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="importer"><LinkIcon className="mr-2"/> Import from URL</TabsTrigger>
                    <TabsTrigger value="generator"><BrainCircuit className="mr-2"/> Generate from Name</TabsTrigger>
                </TabsList>
                <TabsContent value="importer" className="mt-6">
                    <UrlImporter />
                </TabsContent>
                <TabsContent value="generator" className="mt-6">
                    <NameGenerator />
                </TabsContent>
            </Tabs>
        </div>
    );
}
