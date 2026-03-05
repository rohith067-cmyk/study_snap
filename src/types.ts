export type LearningStyle = 'Visual' | 'Exam' | 'Revision';
export type BloomTaxonomy = 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Auto';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Summary {
  short: string;
  medium: string;
  detailed: string;
}

export interface Question {
  id: string;
  topic: string;
  question: string;
  answer: string;
  difficulty: Difficulty;
  bloomLevel?: string;
}

export interface MCQ {
  id: string;
  topic: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  answer: string;
  difficulty: Difficulty;
}

export interface ConceptNode {
  id: string;
  name: string;
  description?: string;
  type: 'topic' | 'subtopic' | 'micro' | 'formula' | 'example';
}

export interface ConceptLink {
  source: string;
  target: string;
  label?: string;
}

export interface ConceptMapData {
  nodes: ConceptNode[];
  links: ConceptLink[];
}

export interface UserStats {
  xp: number;
  rank: string;
}

export interface PerformanceReport {
  topic: string;
  avg_accuracy: number;
  total_time: number;
}
