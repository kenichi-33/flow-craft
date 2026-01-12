import { useParams } from 'react-router-dom';
import { ReactFlowProvider } from '@xyflow/react';
import FlowDesigner from '@/components/designer/flow/FlowDesigner';

export default function FlowEditorPage() {
    const { id } = useParams();
    if (!id) return <div>App ID not found</div>;
    return (
        <ReactFlowProvider>
            <FlowDesigner appId={id} />
        </ReactFlowProvider>
    );
}
