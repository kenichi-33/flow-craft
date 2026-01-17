import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ValidationPanelProps {
    errors: string[];
    warnings?: string[];
}

export default function ValidationPanel({ errors, warnings = [] }: ValidationPanelProps) {
    if (errors.length === 0 && warnings.length === 0) return null;

    return (
        <Card className="w-64 max-h-60 overflow-y-auto shadow-lg border-red-200">
            <CardHeader className="p-3 pb-2 bg-muted/50">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                         検証エラー
                    </span>
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{errors.length}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ul className="text-xs divide-y">
                    {errors.map((error, index) => (
                        <li key={`err-${index}`} className="p-2 text-destructive bg-red-50/50 flex gap-2 items-start">
                            <span className="mt-0.5">•</span>
                            <span>{error}</span>
                        </li>
                    ))}
                    {warnings.map((warning, index) => (
                        <li key={`warn-${index}`} className="p-2 text-yellow-600 bg-yellow-50/50 flex gap-2 items-start">
                             <span className="mt-0.5">•</span>
                            <span>{warning}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
