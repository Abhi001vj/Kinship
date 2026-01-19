
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type } from '@google/genai';
import { Person } from '../types';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    try {
      // Assuming API KEY is available in the environment context or injected
      const apiKey = process.env['API_KEY'] || '';
      if (apiKey) {
        this.ai = new GoogleGenAI({ apiKey });
      }
    } catch (e) {
      console.warn('Gemini API Key not found or invalid environment.');
    }
  }

  // New structured method for the sidebar
  async determineRelationship(pathDescription: string, startName: string, endName: string): Promise<{ title: string, explanation: string }> {
    if (!this.ai) return { title: "Relationship Found", explanation: "AI unavailable to analyze details." };

    const prompt = `
      Context: A family tree path traversal.
      Path Traversed: "${pathDescription}"
      
      Task: Determine the genealogical relationship of ${endName} TO ${startName}.
      (Example: If path says "${startName} is son of ${endName}", then ${endName} is the "Father" of ${startName}).
      
      Return JSON:
      {
        "title": "The specific relationship term (e.g. Paternal Grandfather, Mother-in-law, Sister, Friend)",
        "explanation": "A short, natural sentence explaining the connection."
      }
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              explanation: { type: Type.STRING }
            }
          }
        }
      });
      
      return JSON.parse(response.text);
    } catch (error) {
      console.error('Gemini API Error:', error);
      return { title: "Connection Found", explanation: "Could not analyze relationship specifics." };
    }
  }

  // Legacy method (optional, kept for compatibility if needed, or removed if unused)
  async generateRelationshipNarrative(pathDescription: string, startName: string, endName: string): Promise<string> {
     const result = await this.determineRelationship(pathDescription, startName, endName);
     return result.explanation;
  }

  async analyzeFaceDemographics(imageBase64: string): Promise<{ ageGroup: string, gender: string }> {
    if (!this.ai) throw new Error("AI not initialized");

    const prompt = "Analyze this face. Estimate the likely age group (e.g., '20s', 'Child', 'Senior') and gender presentation. Return JSON.";
    
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ageGroup: { type: Type.STRING },
              gender: { type: Type.STRING, enum: ['Male', 'Female', 'Non-binary', 'Unknown'] }
            }
          }
        }
      });
      
      const json = JSON.parse(response.text);
      return {
        ageGroup: json.ageGroup || 'Unknown',
        gender: (json.gender || 'Unknown').toLowerCase()
      };
    } catch (e) {
      console.error('Face analysis failed', e);
      return { ageGroup: 'Unknown', gender: 'other' };
    }
  }

  async parseNaturalLanguageEntry(
    description: string, 
    existingPeople: Person[]
  ): Promise<{ 
    name: string;
    gender: 'male' | 'female' | 'other';
    occupation: string;
    location: string;
    targetId: string;
    relationshipType: 'parent' | 'child' | 'spouse' | 'sibling' | '';
  }> {
    if (!this.ai) throw new Error("AI not initialized");

    // Simplify context to save tokens and avoid confusion
    const contextList = existingPeople.map(p => ({ id: p.id, name: p.name, role: p.role }));
    
    const prompt = `
      Current Family Tree Members: ${JSON.stringify(contextList)}
      
      User Description of New Person: "${description}"
      
      Task: Extract details about the new person and determine specifically WHO they connect to in the existing tree and HOW.
      1. Match names in description to existing IDs (e.g., "Arthur's dad" -> targetId: [Arthur's ID]).
      2. Determine relationship type from the perspective of the NEW person relative to the EXISTING target (e.g., if "Arthur's dad", type is "parent").
      3. Extract metadata (Occupation, Location).
      
      Return JSON only.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the new person" },
              gender: { type: Type.STRING, enum: ['male', 'female', 'other'] },
              occupation: { type: Type.STRING },
              location: { type: Type.STRING },
              targetId: { type: Type.STRING, description: "The ID of the existing person they are related to" },
              relationshipType: { type: Type.STRING, enum: ['parent', 'child', 'spouse', 'sibling'] }
            }
          }
        }
      });

      return JSON.parse(response.text);
    } catch (e) {
      console.error('NLP Parse failed', e);
      return {
        name: '',
        gender: 'other',
        occupation: '',
        location: '',
        targetId: '',
        relationshipType: ''
      };
    }
  }
}
