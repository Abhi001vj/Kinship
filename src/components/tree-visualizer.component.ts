
import { Component, ElementRef, ViewChild, effect, input, output, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { Person, Relationship } from '../types';
import { FamilyService } from '../services/family.service';

declare const d3: any;

@Component({
  selector: 'app-tree-visualizer',
  standalone: true,
  template: `
    <div #chartContainer class="w-full h-full bg-stone-50 relative overflow-hidden rounded-xl border border-stone-200 shadow-inner">
       @if (nodes().length === 0) {
         <div class="absolute inset-0 flex items-center justify-center text-stone-400">
            <p>Loading tree...</p>
         </div>
       }
       
       <!-- Legend -->
       <div class="absolute top-4 left-4 bg-white/80 backdrop-blur rounded-lg p-2 text-xs border border-stone-200 shadow-sm pointer-events-none z-10">
          <div class="flex items-center gap-2 mb-1">
             <span class="w-3 h-3 rounded-full bg-blue-500"></span>
             <span class="text-stone-600 font-medium">Groom's Side</span>
          </div>
          <div class="flex items-center gap-2">
             <span class="w-3 h-3 rounded-full bg-pink-500"></span>
             <span class="text-stone-600 font-medium">Bride's Side</span>
          </div>
       </div>
    </div>
  `
})
export class TreeVisualizerComponent implements OnDestroy, AfterViewInit {
  nodes = input.required<Person[]>();
  links = input.required<Relationship[]>();
  highlightPath = input<string[]>([]);
  
  nodeSelected = output<string>();
  addRelative = output<string>(); 

  @ViewChild('chartContainer') private chartContainer!: ElementRef;
  
  private simulation: any;
  private svg: any;
  private resizeObserver: ResizeObserver | null = null;
  
  private familyService = inject(FamilyService);

  constructor() {
    effect(() => {
      const n = this.nodes();
      const l = this.links();
      const h = this.highlightPath();
      setTimeout(() => this.renderGraph(n, l, h), 10);
    });
  }

  ngAfterViewInit() {
    this.resizeObserver = new ResizeObserver(() => {
        if (this.nodes().length > 0) {
             this.renderGraph(this.nodes(), this.links(), this.highlightPath());
        }
    });
    this.resizeObserver.observe(this.chartContainer.nativeElement);
  }

  ngOnDestroy() {
    if (this.simulation) this.simulation.stop();
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  private renderGraph(people: Person[], relationships: Relationship[], highlights: string[]) {
    if (!this.chartContainer) return;
    const element = this.chartContainer.nativeElement;
    const width = element.clientWidth || 300; 
    const height = element.clientHeight || 300; 

    if (width === 0 || height === 0) return; 

    d3.select(element).selectAll('*').remove();

    this.svg = d3.select(element)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');

    // Deep clone nodes to prevent D3 mutation issues on re-renders,
    // but ensure we carry over the 'side' property correctly from the immutable service source
    const nodes = people.map(p => ({ ...p }));
    const links = relationships.map(r => ({ source: r.source, target: r.target, type: r.type }));

    // --- HIERARCHY CALCULATION ---
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const queue: string[] = [];

    const anchors = nodes.filter(n => n.role === 'groom' || n.role === 'bride');
    anchors.forEach(n => {
        levels.set(n.id, 0);
        queue.push(n.id);
        visited.add(n.id);
    });

    while(queue.length > 0) {
        const currId = queue.shift()!;
        const currentLevel = levels.get(currId) || 0;
        
        relationships.forEach(r => {
            let neighborId: string | null = null;
            let nextLevel = currentLevel;

            if (r.type === 'friend') {
                 if (r.source === currId) neighborId = r.target;
                 if (r.target === currId) neighborId = r.source;
            } else {
                if (r.source === currId) { 
                    neighborId = r.target;
                    if (r.type === 'parent') nextLevel = currentLevel + 1; 
                } else if (r.target === currId) {
                    neighborId = r.source;
                    if (r.type === 'parent') nextLevel = currentLevel - 1;
                }
            }

            if (neighborId && !visited.has(neighborId)) {
                levels.set(neighborId, nextLevel);
                visited.add(neighborId);
                queue.push(neighborId);
            }
        });
    }

    nodes.forEach((n: any) => {
        n.level = levels.get(n.id) || 0;
    });

    // Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event: any) => {
            g.attr('transform', event.transform);
        });
    this.svg.call(zoom);

    const g = this.svg.append('g');

    // Simulation
    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance((d: any) => d.type === 'friend' ? 150 : 120))
      .force('charge', d3.forceManyBody().strength(-800))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(70))
      // Force Y: Groups by generation (Parents high, Kids low)
      .force('y', d3.forceY((d: any) => d.level * 150).strength(1.2))
      // Force X: Separates Groom side (Left) vs Bride side (Right)
      .force('x', d3.forceX((d: any) => {
          if (d.side === 'groom') return -300;
          if (d.side === 'bride') return 300;
          return 0;
      }).strength(0.3));

    // Markers
    const defs = this.svg.append('defs');
    
    // Normal Arrow
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 34) 
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#a8a29e')
      .attr('d', 'M0,-5L10,0L0,5');

    // Images
    nodes.forEach((d: any) => {
        const imageUrl = d.photoUrl || this.familyService.getDefaultAvatar(d.gender, d.name);
        defs.append('pattern')
            .attr('id', 'img-' + d.id)
            .attr('height', '100%')
            .attr('width', '100%')
            .attr('patternContentUnits', 'objectBoundingBox')
            .append('image')
            .attr('height', 1)
            .attr('width', 1)
            .attr('preserveAspectRatio', 'xMidYMid slice')
            .attr('href', imageUrl);
    });

    // Draw Links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', (d: any) => highlights.includes(d.source.id) && highlights.includes(d.target.id) ? 3 : 2)
      .attr('stroke', (d: any) => {
         // Highlight Path Logic
         if (highlights.includes(d.source.id) && highlights.includes(d.target.id)) return '#f43f5e'; 
         
         // Side Color Logic
         // If both are groom side -> blueish
         if (d.source.side === 'groom' && d.target.side === 'groom') return '#bfdbfe'; // Blue 200
         // If both are bride side -> pinkish
         if (d.source.side === 'bride' && d.target.side === 'bride') return '#fbcfe8'; // Pink 200
         
         return '#d6d3d1'; // Default Grey
      })
      .attr('stroke-dasharray', (d: any) => d.type === 'friend' ? '5,5' : null)
      .attr('marker-end', (d: any) => d.type === 'parent' ? 'url(#arrow)' : null);

    // Draw Nodes
    const node = g.append('g')
      .selectAll('.node-group')
      .data(nodes)
      .join('g')
      .attr('class', 'node-group')
      .call(this.drag(this.simulation))
      .on('click', (event: any, d: any) => {
        this.nodeSelected.emit(d.id);
        event.stopPropagation();
      });

    // Circle Border (Colored by Side)
    node.append('circle')
      .attr('r', 32)
      .attr('fill', '#ffffff')
      .attr('stroke', (d: any) => {
        if (highlights.includes(d.id)) return '#f43f5e'; // Highlight Red
        
        // Strict Side Logic
        if (d.role === 'groom' || d.side === 'groom') return '#3b82f6'; // Blue
        if (d.role === 'bride' || d.side === 'bride') return '#ec4899'; // Pink
        
        return '#d6d3d1'; // Grey for unknown/mutual if logic fails, but should be caught by bfs
      })
      .attr('stroke-width', (d: any) => highlights.includes(d.id) ? 4 : 3)
      .style('filter', 'drop-shadow(0px 2px 3px rgba(0,0,0,0.08))');

    // Avatar
    node.append('circle')
        .attr('r', 30)
        .attr('fill', (d: any) => `url(#img-${d.id})`)
        .attr('pointer-events', 'none'); 

    // Name
    node.append('text')
      .text((d: any) => d.name)
      .attr('y', 50)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#44403c')
      .style('text-shadow', '0 1px 2px rgba(255,255,255,0.8)')
      .attr('pointer-events', 'none');

    // Role Label
    node.append('rect')
      .attr('x', -24)
      .attr('y', -45)
      .attr('width', 48)
      .attr('height', 14)
      .attr('rx', 7)
      .attr('fill', (d: any) => {
          if (d.role === 'groom') return '#3b82f6';
          if (d.role === 'bride') return '#ec4899';
          if (d.inferredRole) return '#64748b'; 
          return 'transparent';
      })
      .attr('opacity', (d: any) => {
          if (d.role === 'groom' || d.role === 'bride') return 1;
          if (d.inferredRole && (d.inferredRole.includes('Father') || d.inferredRole.includes('Mother') || d.inferredRole.includes('Spouse'))) return 1;
          return 0;
      });

    node.append('text')
      .text((d: any) => {
          if (d.role === 'groom') return 'GROOM';
          if (d.role === 'bride') return 'BRIDE';
          if (d.inferredRole?.includes('Father')) return 'FATHER';
          if (d.inferredRole?.includes('Mother')) return 'MOTHER';
          if (d.inferredRole?.includes('Sister')) return 'SISTER';
          if (d.inferredRole?.includes('Brother')) return 'BROTHER';
          if (d.inferredRole?.includes('Spouse')) return 'SPOUSE';
          return '';
      })
      .attr('y', -35)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('fill', '#ffffff')
      .attr('pointer-events', 'none')
      .attr('opacity', (d: any) => {
          if (d.role === 'groom' || d.role === 'bride') return 1;
          if (d.inferredRole && (d.inferredRole.includes('Father') || d.inferredRole.includes('Mother') || d.inferredRole.includes('Spouse'))) return 1;
          return 0;
      });


    // Quick Add Button
    const actionGroup = node.append('g')
       .attr('transform', 'translate(18, 18)')
       .style('cursor', 'pointer')
       .on('click', (event: any, d: any) => {
           event.stopPropagation(); 
           this.addRelative.emit(d.id);
       })
       .on('mouseenter', function() {
          d3.select(this).select('circle').attr('fill', '#ea580c').attr('r', 12);
       })
       .on('mouseleave', function() {
          d3.select(this).select('circle').attr('fill', '#f97316').attr('r', 10);
       });

    actionGroup.append('circle')
       .attr('r', 10)
       .attr('fill', '#f97316')
       .attr('stroke', '#fff')
       .attr('stroke-width', 2);

    actionGroup.append('text')
       .text('+')
       .attr('text-anchor', 'middle')
       .attr('dy', 4)
       .attr('fill', 'white')
       .attr('font-weight', 'bold')
       .attr('font-size', '14px')
       .attr('pointer-events', 'none');

    this.simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
  }

  drag(simulation: any) {
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
  }
}
