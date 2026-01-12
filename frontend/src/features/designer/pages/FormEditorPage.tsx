import { useParams } from 'react-router-dom';
import FormDesigner from '@/components/designer/form/FormDesigner';

export default function FormEditorPage() {
    const { id } = useParams();
    if (!id) return <div>App ID not found</div>;
    return <FormDesigner appId={id} />;
}
