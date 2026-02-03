import { useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Code, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Editor from '@monaco-editor/react';

export default function ScriptNode({ id, data }: { id: string; data: any }) {
    const [dialogOpen, setDialogOpen] = useState(false);
    
    // State
    const [scriptContent, setScriptContent] = useState(data.scriptContent || '// Write JavaScript here\n// inputData is available globally\n// return value will be stored if outputVariable is set\n\nreturn 1 + 1;');
    const [outputVariable, setOutputVariable] = useState(data.outputVariable || 'scriptResult');
    const [timeout, setTimeout] = useState(data.timeout || '5000');

    const { setNodes } = useReactFlow();
    const isReadOnly = data.readOnly === true;

    useEffect(() => {
        if (dialogOpen) {
            setScriptContent(data.scriptContent || '// Write JavaScript here\n// inputData is available globally\n// return value will be stored if outputVariable is set\n\nreturn 1 + 1;');
            setOutputVariable(data.outputVariable || 'scriptResult');
            setTimeout(data.timeout || '5000');
        }
    }, [dialogOpen, data]);

    const handleSave = () => {
        if (isReadOnly) { setDialogOpen(false); return; }
        setNodes((nds) => nds.map((node) => node.id === id ? { 
            ...node, 
            data: { 
                ...node.data, 
                scriptContent,
                outputVariable,
                timeout
            } 
        } : node));
        setDialogOpen(false);
    };

    return (
        <>
            <div
                className={`min-w-[140px] min-h-[60px] px-4 py-2 rounded-lg flex flex-col items-center justify-center shadow-lg border-2 relative transition-all duration-300
                    ${data.isFailed ? 'bg-red-50 to-red-100 border-red-500 shadow-red-200' : 
                      data.isCurrent ? 'bg-gradient-to-br from-yellow-500 to-yellow-700 border-yellow-400 ring-4 ring-yellow-400/30' : 
                      'bg-gradient-to-br from-yellow-500 to-yellow-700 border-white/50'}
                `}
                style={{ cursor: isReadOnly ? 'pointer' : 'default' }}
                onClick={isReadOnly ? () => setDialogOpen(true) : undefined}
            >
                {data.isCurrent && !data.isFailed && <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-yellow-600 border-white hover:bg-yellow-600 z-50 shadow-sm whitespace-nowrap">現在</Badge>}
                {data.isFailed && <Badge variant="destructive" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 border-white z-50 shadow-sm whitespace-nowrap">失敗</Badge>}
                {data.isCompleted && !data.isCurrent && !data.isFailed && <Badge variant="secondary" className="absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 text-[10px] px-2 bg-emerald-100 text-emerald-700 border-emerald-200 border hover:bg-emerald-100 z-50 shadow-sm whitespace-nowrap">完了</Badge>}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    isConnectableStart={false}
                    className="!bg-white !border-2 !border-yellow-800 !w-2.5 !h-2.5 !rounded-none" 
                />
                <div className="flex items-center gap-1">
                    <Code className="h-4 w-4 text-white" />
                    <span className="text-sm text-white font-bold drop-shadow-sm">{data.label || 'スクリプト'}</span>
                    {!isReadOnly && (
                        <button className="p-0.5 text-white hover:bg-white/20 rounded" onClick={() => setDialogOpen(true)} onMouseDown={(e) => e.stopPropagation()}>
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
                <div className="text-[9px] text-white/80 mt-1 max-w-[120px] truncate">
                    Var: {data.outputVariable || 'None'}
                </div>
                <Handle 
                    type="source" 
                    position={Position.Right} 
                    className="!bg-yellow-800 !w-2.5 !h-2.5 !border-2 !border-white !rounded-full" 
                />
                
                {data.statCount !== undefined && data.statCount > 0 && (
                    <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border border-white shadow-sm z-10 animate-pulse">
                        {data.statCount}
                    </div>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>{isReadOnly ? 'スクリプト (読取専用)' : 'スクリプト設定'}</DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 flex flex-col gap-4 py-4 overflow-hidden">
                         <div className="flex gap-4">
                            <div className="space-y-2 flex-1">
                                <Label>出力変数名</Label>
                                <Input value={outputVariable} onChange={(e) => setOutputVariable(e.target.value)} placeholder="result" disabled={isReadOnly} />
                                <p className="text-xs text-muted-foreground">実行結果を格納する変数名</p>
                            </div>
                            <div className="space-y-2 w-[150px]">
                                <Label>タイムアウト (ms)</Label>
                                <Input type="number" value={timeout} onChange={(e) => setTimeout(e.target.value)} min="1000" disabled={isReadOnly} />
                            </div>
                         </div>

                         <div 
                             className="border rounded-md overflow-hidden"
                             style={{ height: '400px' }}
                             onKeyDown={(e) => e.stopPropagation()}
                         >
                            <Editor
                                height="400px"
                                defaultLanguage="javascript"
                                value={scriptContent}
                                onChange={(value) => setScriptContent(value || '')}
                                theme="vs-dark"
                                onMount={(editor, monaco) => {
                                    // Set Compiler Options
                                    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
                                        target: monaco.languages.typescript.ScriptTarget.ES2020,
                                        allowNonTsExtensions: true,
                                        noLib: true, // Disable standard lib (browser globals like window)
                                        checkJs: true, // Enable JS checking
                                        strict: true, // Strict mode
                                    });

                                    // Enable Validation
                                    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                                        noSemanticValidation: false,
                                        noSyntaxValidation: false,
                                        diagnosticCodesToIgnore: [1108], // A 'return' statement can only be used within a function body
                                    });

                                    // Add definitions for our environment
                                    monaco.languages.typescript.javascriptDefaults.addExtraLib(`
                                        /**
                                         * Input data from previous nodes
                                         */
                                        declare const inputData: Record<string, any>;
                                        
                                        /**
                                         * Console for logging (only log is supported)
                                         */
                                        declare const console: { 
                                            log: (...args: any[]) => void; 
                                        };

                                        /**
                                         * Standard JSON object
                                         */
                                        declare const JSON: {
                                            parse(text: string): any;
                                            stringify(value: any, replacer?: (key: string, value: any) => any, space?: string | number): string;
                                        };
                                        
                                        // Basic Math
                                        declare const Math: any;
                                        declare const Date: any;
                                        declare const parseInt: any;
                                        declare const parseFloat: any;
                                        declare const String: any;
                                        declare const Number: any;
                                        declare const Boolean: any;
                                        declare const Array: any;
                                        declare const Object: any;
                                    `, 'ts:flow-craft-script.d.ts');
                                }}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 14,
                                    readOnly: isReadOnly,
                                    scrollBeyondLastLine: false,
                                    fixedOverflowWidgets: true,
                                }}
                            />
                         </div>
                         <div className="p-2 bg-muted rounded text-xs space-y-1">
                             <p className="font-bold">利用可能な変数:</p>
                             <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => !isReadOnly && setScriptContent(scriptContent + '\ninputData')} disabled={isReadOnly}>inputData (Insert)</Button>
                                <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => !isReadOnly && setScriptContent(scriptContent + '\nconsole.log(variable)')} disabled={isReadOnly}>console.log()</Button>
                             </div>
                             <div className="mt-2 text-muted-foreground space-y-2">
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded p-2">
                                    <p className="font-bold mb-1">仕様・制限事項:</p>
                                    <ul className="list-disc pl-4 space-y-0.5">
                                        <li><strong>ES2020相当</strong>のJavaScriptが利用可能です (Array, Object, JSON, Date, Mathなど)。</li>
                                        <li><code>window</code>, <code>document</code>, <code>fetch</code> 等のブラウザ/ネットワーク機能は利用できません。</li>
                                        <li><code>inputData</code> 変数で前のノードのデータを参照できます。</li>
                                        <li><code>console.log()</code> の出力はサーバーログに記録されます。</li>
                                    </ul>
                                </div>
                             </div>
                         </div>
                    </div>

                    <DialogFooter>
                        {isReadOnly ? <Button onClick={() => setDialogOpen(false)}>閉じる</Button> : (
                            <><Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button><Button onClick={handleSave}>保存</Button></>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
