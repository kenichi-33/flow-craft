
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FlowVisualization from './FlowVisualization';

// Mock dependencies
vi.mock('@xyflow/react', async () => {
    return {
        ReactFlow: ({ nodes, edges }: any) => (
            <div data-testid="react-flow-mock">
                <script type="application/json" data-testid="nodes-json">
                    {JSON.stringify(nodes)}
                </script>
                <script type="application/json" data-testid="edges-json">
                    {JSON.stringify(edges)}
                </script>
            </div>
        ),
        MarkerType: { ArrowClosed: 'arrowclosed' },
        Background: () => <div>Background</div>,
        Controls: () => <div>Controls</div>,
        Handle: () => <div>Handle</div>,
        Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
    };
});

// Mock UI components
vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: any) => <span>{children}</span>
}));
vi.mock('@/constants/node-labels', () => ({
    getNodeLabel: (key: string) => key
}));

describe('FlowVisualization', () => {
    const rawNodes = [
        { id: 'start', type: 'start', position: { x: 0, y: 0 } },
        { id: 'step1', type: 'approval', position: { x: 100, y: 0 } },
        { id: 'end', type: 'end', position: { x: 200, y: 0 } },
    ];
    const rawEdges = [
        { id: 'e1', source: 'start', target: 'step1' },
        { id: 'e2', source: 'step1', target: 'end' },
    ];

    const getRenderedData = () => {
        const nodes = JSON.parse(screen.getByTestId('nodes-json').textContent || '[]');
        const edges = JSON.parse(screen.getByTestId('edges-json').textContent || '[]');
        return { nodes, edges };
    };

    it('should render nodes and edges', () => {
        render(<FlowVisualization nodes={rawNodes} edges={rawEdges} />);
        
        const { nodes, edges } = getRenderedData();
        expect(nodes).toHaveLength(3);
        expect(edges).toHaveLength(2);
    });

    it('should highlight current step', () => {
        render(<FlowVisualization nodes={rawNodes} edges={rawEdges} currentNodeId="step1" completedStepIds={['start']} />);
        
        const { nodes } = getRenderedData();
        const step1 = nodes.find((n: any) => n.id === 'step1');
        
        // Check inferred style/data
        expect(step1.data.isCurrent).toBe(true);
        expect(step1.style.background).toBe('#e3f2fd'); // Blue-ish for current
    });

    it('should highlight completed steps', () => {
        render(<FlowVisualization nodes={rawNodes} edges={rawEdges} currentNodeId="end" completedStepIds={['start', 'step1']} />);
        
        const { nodes, edges } = getRenderedData();
        const step1 = nodes.find((n: any) => n.id === 'step1');
        const edge1 = edges.find((e: any) => e.id === 'e1');
        
        expect(step1.data.isCompleted).toBe(true);
        expect(step1.style.background).toBe('#e8f5e9'); // Green-ish for completed
        
        // Edge should be colored as traversed
        expect(edge1.style.stroke).not.toBe('#999');
    });

    it('should highlight failed steps', () => {
        render(<FlowVisualization nodes={rawNodes} edges={rawEdges} currentNodeId="step1" failedStepIds={['step1']} />);
        
        const { nodes } = getRenderedData();
        const step1 = nodes.find((n: any) => n.id === 'step1');
        
        expect(step1.data.isFailed).toBe(true);
        expect(step1.style.background).toBe('#fee2e2'); // Red-ish
    });

    it('should animate edge to current step', () => {
         render(<FlowVisualization nodes={rawNodes} edges={rawEdges} currentNodeId="step1" completedStepIds={['start']} />);
         
         const { edges } = getRenderedData();
         const e1 = edges.find((e: any) => e.id === 'e1');
         
         // e1 leads to current step1 from completed start
         expect(e1.animated).toBe(true);
    });
});
