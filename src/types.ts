
export type GenderIdentity = 'male' | 'female' | 'non-binary' | 'genderqueer' | 'agender' | 'two-spirit' | 'other';

export interface Person {
  id: string;
  name: string;
  // 'role' is the manual override or base role. 
  // 'inferredRole' is calculated by the graph (e.g. "Father of Groom")
  role: 'groom' | 'bride' | 'relative' | 'friend'; 
  inferredRole?: string;
  side?: 'groom' | 'bride' | 'mutual'; 
  gender: GenderIdentity;
  photoUrl?: string; // This will be a URL (cloud or blob)
  notes?: string;
  occupation?: string;
  location?: string;
  x?: number; // D3 coord
  y?: number; // D3 coord
}

export interface Relationship {
  source: string; // ID
  target: string; // ID
  type: 'parent' | 'spouse' | 'friend';
}

export interface PathNode {
  person: Person;
  relationshipDescription: string;
}

export interface GraphData {
  nodes: Person[];
  links: Relationship[];
}

export interface PathResult {
  path: string[]; // Array of ID strings
  description: string;
}
