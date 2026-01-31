import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

interface MasterConnectorDataTableProps {
    connectorId: string;
    uploadTrigger: boolean;
}

export function MasterConnectorDataTable({ connectorId, uploadTrigger }: MasterConnectorDataTableProps) {
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['master-connector-data', connectorId, uploadTrigger], // Refetch when upload finishes
        queryFn: async () => {
            return api.get<any[]>(`/master-connectors/${connectorId}/data`);
        },
        enabled: !!connectorId
    });

    if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted-foreground" /></div>;

    if (!data || data.length === 0) {
        return <div className="text-center text-muted-foreground p-4">データがありません</div>;
    }

    // Infer headers from first item keys
    const headers = Object.keys(data[0]);

    return (
        <div className="border rounded-md max-h-[400px] overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        {headers.map(header => (
                            <TableHead key={header} className="whitespace-nowrap">{header}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, i) => (
                        <TableRow key={i}>
                            {headers.map(header => (
                                <TableCell key={`${i}-${header}`} className="whitespace-nowrap">
                                    {row[header]}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            <div className="p-2 text-xs text-center text-muted-foreground border-t bg-muted/10">
                最新の50件を表示しています
            </div>
        </div>
    );
}
