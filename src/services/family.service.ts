
import { Injectable, signal, computed, effect } from '@angular/core';
import { Person, Relationship, PathResult, GenderIdentity } from '../types';

@Injectable({
  providedIn: 'root'
})
export class FamilyService {
  people = signal<Person[]>([]);
  relationships = signal<Relationship[]>([]);
  
  // derived state for faster lookups
  peopleMap = computed(() => {
    const map = new Map<string, Person>();
    this.people().forEach(p => map.set(p.id, p));
    return map;
  });

  constructor() {
    this.loadFromStorage();
    
    // Auto-save effect
    effect(() => {
      const data = {
        people: this.people(),
        relationships: this.relationships()
      };
      localStorage.setItem('kinship_db_v1', JSON.stringify(data));
    });
  }

  private loadFromStorage() {
    const raw = localStorage.getItem('kinship_db_v1');
    let hasData = false;
    
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data.people) && data.people.length > 0) {
          this.people.set(data.people);
          this.relationships.set(data.relationships || []);
          hasData = true;
          this.recalculateInferredRoles();
        }
      } catch (e) {
        console.error('Failed to load local data', e);
      }
    }

    if (!hasData) {
      this.seedDefaultData();
    }
  }

  private seedDefaultData() {
    const groomId = crypto.randomUUID();
    const brideId = crypto.randomUUID();
    
    this.people.set([
      { id: groomId, name: 'Arthur', role: 'groom', inferredRole: 'The Groom', side: 'groom', gender: 'male', x: 0, y: 0 },
      { id: brideId, name: 'Molly', role: 'bride', inferredRole: 'The Bride', side: 'bride', gender: 'female', x: 100, y: 0 }
    ]);
    
    this.relationships.set([
      { source: groomId, target: brideId, type: 'spouse' }
    ]);
  }

  addPerson(person: Person) {
    this.people.update(list => [...list, person]);
    this.recalculateInferredRoles();
  }

  updatePerson(updated: Person) {
    this.people.update(list => list.map(p => p.id === updated.id ? updated : p));
    this.recalculateInferredRoles();
  }

  deletePerson(id: string) {
    this.people.update(list => list.filter(p => p.id !== id));
    this.relationships.update(rels => rels.filter(r => r.source !== id && r.target !== id));
    this.recalculateInferredRoles();
  }

  addRelationship(sourceId: string, targetId: string, type: 'parent' | 'spouse' | 'friend') {
    const exists = this.relationships().some(
      r => (r.source === sourceId && r.target === targetId && r.type === type)
    );
    if (!exists) {
      this.relationships.update(rels => [...rels, { source: sourceId, target: targetId, type }]);
      this.recalculateInferredRoles();
    }
  }

  removeRelationship(sourceId: string, targetId: string) {
    this.relationships.update(rels => rels.filter(
      r => !(r.source === sourceId && r.target === targetId)
    ));
    this.recalculateInferredRoles();
  }

  // --- AUTOMATIC ROLE INFERENCE ENGINE ---
  private recalculateInferredRoles() {
    // CLONE the array and objects to ensure we don't mutate signal state in place, 
    // which can cause change detection to miss updates in the visualizer.
    const currentPeople = this.people().map(p => ({ ...p }));
    const currentRels = this.relationships();

    const groom = currentPeople.find(p => p.role === 'groom');
    const bride = currentPeople.find(p => p.role === 'bride');

    // Reset Inferred properties
    currentPeople.forEach(p => {
        if (p.role === 'groom') { p.inferredRole = 'The Groom'; p.side = 'groom'; }
        else if (p.role === 'bride') { p.inferredRole = 'The Bride'; p.side = 'bride'; }
        else { p.inferredRole = undefined; p.side = undefined; }
    });

    if (groom) this.bfsLabeling(groom.id, 'groom', currentPeople, currentRels);
    if (bride) this.bfsLabeling(bride.id, 'bride', currentPeople, currentRels);

    this.people.set(currentPeople);
  }

  private bfsLabeling(startId: string, side: 'groom' | 'bride', people: Person[], relationships: Relationship[]) {
     const queue: Array<{id: string, depth: number}> = [{id: startId, depth: 0}];
     const visited = new Set<string>([startId]);

     while (queue.length > 0) {
         const {id, depth} = queue.shift()!;
         const person = people.find(p => p.id === id);
         
         if (person && person.id !== startId) {
             // Assign Side
             if (!person.side) person.side = side;
             else if (person.side !== side) person.side = 'mutual';

             // Assign Label (Heuristics)
             if (!person.inferredRole) { 
                 // 1. Is Parent of Start?
                 if (relationships.some(r => r.source === person.id && r.target === startId && r.type === 'parent')) {
                     person.inferredRole = person.gender === 'female' ? `Mother of ${side === 'groom' ? 'Groom' : 'Bride'}` : 
                                           person.gender === 'male' ? `Father of ${side === 'groom' ? 'Groom' : 'Bride'}` : `Parent of ${side === 'groom' ? 'Groom' : 'Bride'}`;
                 }
                 // 2. Is Child of Start?
                 else if (relationships.some(r => r.source === startId && r.target === person.id && r.type === 'parent')) {
                     person.inferredRole = person.gender === 'female' ? `Daughter of ${side === 'groom' ? 'Groom' : 'Bride'}` : 
                                           person.gender === 'male' ? `Son of ${side === 'groom' ? 'Groom' : 'Bride'}` : `Child of ${side === 'groom' ? 'Groom' : 'Bride'}`;
                 }
                 // 3. Is Sibling of Start?
                 else if (this.areSiblings(person.id, startId, relationships)) {
                     person.inferredRole = person.gender === 'female' ? `Sister of ${side === 'groom' ? 'Groom' : 'Bride'}` : 
                                           person.gender === 'male' ? `Brother of ${side === 'groom' ? 'Groom' : 'Bride'}` : `Sibling of ${side === 'groom' ? 'Groom' : 'Bride'}`;
                 }
                 // 4. Is Spouse?
                 else if (relationships.some(r => ((r.source === startId && r.target === person.id) || (r.target === startId && r.source === person.id)) && r.type === 'spouse')) {
                     if (person.role !== 'bride' && person.role !== 'groom') {
                         person.inferredRole = `Spouse of ${side === 'groom' ? 'Groom' : 'Bride'}`;
                     }
                 }
                 // 5. Is In-Law? (Spouse of Sibling OR Sibling of Spouse)
                 else {
                     const siblings = this.getSiblings(startId, relationships);
                     const isSpouseOfSibling = siblings.some(sibId => 
                        relationships.some(r => 
                            ((r.source === sibId && r.target === person.id) || (r.target === sibId && r.source === person.id)) && r.type === 'spouse'
                        )
                     );
                     
                     if (isSpouseOfSibling) {
                         person.inferredRole = person.gender === 'female' ? `Sister-in-law of ${side === 'groom' ? 'Groom' : 'Bride'}` : 
                                               person.gender === 'male' ? `Brother-in-law of ${side === 'groom' ? 'Groom' : 'Bride'}` : `In-law of ${side === 'groom' ? 'Groom' : 'Bride'}`;
                     }
                 }
             }
         }

         const neighbors = relationships
            .filter(r => r.source === id || r.target === id)
            .map(r => r.source === id ? r.target : r.source);
         
         for (const nid of neighbors) {
             if (!visited.has(nid)) {
                 visited.add(nid);
                 if (depth < 4) {
                    queue.push({id: nid, depth: depth + 1});
                 }
             }
         }
     }
  }

  private getSiblings(id: string, rels: Relationship[]): string[] {
      const parentIds = rels.filter(r => r.target === id && r.type === 'parent').map(r => r.source);
      if (parentIds.length === 0) return [];
      
      const siblingIds = new Set<string>();
      parentIds.forEach(pid => {
          rels.filter(r => r.source === pid && r.type === 'parent').forEach(r => {
              if (r.target !== id) siblingIds.add(r.target);
          });
      });
      return Array.from(siblingIds);
  }

  private areSiblings(id1: string, id2: string, rels: Relationship[]): boolean {
      const parents1 = rels.filter(r => r.target === id1 && r.type === 'parent').map(r => r.source);
      const parents2 = rels.filter(r => r.target === id2 && r.type === 'parent').map(r => r.source);
      return parents1.some(p => parents2.includes(p));
  }


  // BFS Pathfinding with Natural Language Generation
  findPath(startId: string, endId: string): PathResult | null {
    if (startId === endId) return { path: [startId], description: 'Self' };

    const adj = new Map<string, string[]>(); 
    const people = this.peopleMap();

    this.people().forEach(p => adj.set(p.id, []));
    this.relationships().forEach(r => {
      adj.get(r.source)?.push(r.target);
      adj.get(r.target)?.push(r.source);
    });

    const queue: Array<{id: string, path: string[]}> = [{ id: startId, path: [startId] }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      if (id === endId) {
        // Generate Description on the fly
        const descParts: string[] = [];
        
        for (let i = 0; i < path.length - 1; i++) {
            const currId = path[i];
            const nextId = path[i+1];
            const currPerson = people.get(currId);
            const nextPerson = people.get(nextId);
            
            if (!currPerson || !nextPerson) continue;

            const rel = this.relationships().find(r => 
                (r.source === currId && r.target === nextId) || 
                (r.source === nextId && r.target === currId)
            );

            if (!rel) continue;

            if (rel.type === 'spouse') {
                const term = currPerson.gender === 'male' ? 'husband' : (currPerson.gender === 'female' ? 'wife' : 'spouse');
                descParts.push(`${currPerson.name} is ${term} of`);
            } else if (rel.type === 'friend') {
                descParts.push(`${currPerson.name} is friend of`);
            } else if (rel.type === 'parent') {
                if (rel.source === currId) {
                    // Current is Parent of Next
                    const term = currPerson.gender === 'male' ? 'father' : (currPerson.gender === 'female' ? 'mother' : 'parent');
                    descParts.push(`${currPerson.name} is ${term} of`);
                } else {
                    // Current is Child of Next
                    const term = currPerson.gender === 'male' ? 'son' : (currPerson.gender === 'female' ? 'daughter' : 'child');
                    descParts.push(`${currPerson.name} is ${term} of`);
                }
            }
        }
        
        const lastPerson = people.get(path[path.length-1]);
        const arrowDesc = descParts.map((part, idx) => {
            if (idx === 0) return part; 
            return part.replace(people.get(path[idx])?.name + ' ', '');
        }).join(' -> ') + ' ' + (lastPerson?.name || '');

        return { path, description: arrowDesc };
      }

      const neighbors = adj.get(id) || [];
      for (const nid of neighbors) {
        if (!visited.has(nid)) {
          visited.add(nid);
          queue.push({
            id: nid,
            path: [...path, nid]
          });
        }
      }
    }

    return null;
  }
  
  resetData() {
     this.people.set([]);
     this.relationships.set([]);
     this.seedDefaultData();
  }

  // Helper for consistent avatars
  getDefaultAvatar(gender: GenderIdentity, seed: string): string {
     const bg = '#e2e8f0'; 
     const fg = '#94a3b8'; 

     let path = '';
     
     if (gender === 'female') {
         path = `
            <path fill="${fg}" d="M12 4a4 4 0 0 1 4 4c0 2.21-1.79 4-4 4s-4-1.79-4-4a4 4 0 0 1 4-4z"/>
            <path fill="${fg}" d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z"/>
         `;
     } else {
         path = `
            <circle cx="12" cy="8" r="4" fill="${fg}"/>
            <path d="M12 14c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z" fill="${fg}"/>
         `;
     }

     const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="${bg}"/>${path}</svg>`;
     return `data:image/svg+xml;base64,${btoa(svg)}`;
  }
}
