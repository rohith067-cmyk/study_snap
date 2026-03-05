import { GoogleGenAI, Type } from "@google/genai";
import { Summary, Question, MCQ, ConceptMapData } from "../types";

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY
});

export class AIService {
  private static model = "models/gemini-2.5-flash";

  private static parseJSON(text: string | undefined) {
    if (!text) throw new Error("AI returned empty response");
    try {
      // Remove markdown code blocks if present
      let cleaned = text.replace(/```json\n?|```/g, '').trim();
      // Sometimes AI adds text before or after the JSON block
      const jsonStart = cleaned.indexOf('[');
      const jsonStartObj = cleaned.indexOf('{');

      let start = -1;
      if (jsonStart !== -1 && jsonStartObj !== -1) start = Math.min(jsonStart, jsonStartObj);
      else if (jsonStart !== -1) start = jsonStart;
      else if (jsonStartObj !== -1) start = jsonStartObj;

      if (start !== -1) {
        const jsonEnd = cleaned.lastIndexOf(']');
        const jsonEndObj = cleaned.lastIndexOf('}');
        let end = -1;
        if (jsonEnd !== -1 && jsonEndObj !== -1) end = Math.max(jsonEnd, jsonEndObj);
        else if (jsonEnd !== -1) end = jsonEnd;
        else if (jsonEndObj !== -1) end = jsonEndObj;

        if (end !== -1) {
          cleaned = cleaned.substring(start, end + 1);
        }
      }

      return JSON.parse(cleaned);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", text);
      throw new Error("Invalid response format from AI. Please try again.");
    }
  }

  static async generateSummary(text: string): Promise<Summary> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Summarize the following text in three modes: short (1-2 sentences), medium (1 paragraph), and detailed (multiple paragraphs). 
      IMPORTANT: Use plain text or simple markdown only. DO NOT use LaTeX, mathematical notation like $\\rightarrow$, or complex symbols. 
      Return as JSON. Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            short: { type: Type.STRING },
            medium: { type: Type.STRING },
            detailed: { type: Type.STRING },
          },
          required: ["short", "medium", "detailed"],
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateKeyPoints(text: string): Promise<string[]> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Extract key learning points from the following text as a list of strings. 
      IMPORTANT: Use plain text only. DO NOT use LaTeX or complex symbols. 
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateDoubts(text: string): Promise<string[]> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Analyze the following text and identify common student doubts, confusing concepts, and potential pitfalls. Return them as a list of strings. 
      IMPORTANT: Use plain text only. DO NOT use LaTeX. 
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateVisualSteps(text: string): Promise<any[]> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Break down the main concept in the following text into a step-by-step logical explanation for a visual animation. Each step should have a title and a brief description. 
      IMPORTANT: Use plain text only. DO NOT use LaTeX. 
      Return as JSON array of objects with 'title' and 'description'. Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["title", "description"],
          },
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateConceptEvolution(text: string): Promise<any[]> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Analyze the concept in the following text and describe its historical evolution or how it progressed from simpler ideas to its current form. 
      Include stages with 'period', 'concept', 'explanation', and 'change' (what improved or corrected). 
      IMPORTANT: Use plain text only. DO NOT use LaTeX. 
      Return as JSON array of objects. Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              period: { type: Type.STRING },
              concept: { type: Type.STRING },
              explanation: { type: Type.STRING },
              change: { type: Type.STRING },
            },
            required: ["period", "concept", "explanation", "change"],
          },
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateQuestions(text: string, count: number, difficulty: string): Promise<Question[]> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Generate ${count} 2-mark questions with answers from the following text. Difficulty: ${difficulty}. 
      IMPORTANT: Use plain text only. DO NOT use LaTeX or complex symbols. 
      Return as JSON array. Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              topic: { type: Type.STRING },
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              difficulty: { type: Type.STRING },
            },
            required: ["id", "topic", "question", "answer", "difficulty"],
          },
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateMCQs(text: string, count: number, difficulty: string): Promise<MCQ[]> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Generate ${count} MCQs with 4 options (A, B, C, D) and the correct answer from the following text. Difficulty: ${difficulty}. 
      IMPORTANT: Use plain text only. DO NOT use LaTeX or complex symbols. 
      Return as JSON array. Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              topic: { type: Type.STRING },
              question: { type: Type.STRING },
              options: {
                type: Type.OBJECT,
                properties: {
                  A: { type: Type.STRING },
                  B: { type: Type.STRING },
                  C: { type: Type.STRING },
                  D: { type: Type.STRING },
                },
                required: ["A", "B", "C", "D"],
              },
              answer: { type: Type.STRING },
              difficulty: { type: Type.STRING },
            },
            required: ["id", "topic", "question", "options", "answer", "difficulty"],
          },
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateConceptMap(text: string): Promise<ConceptMapData> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Analyze the following text and create a concept map structure with nodes (id, name, type) and links (source, target, label). Types: topic, subtopic, micro, formula, example. 
      IMPORTANT: Use plain text for names and labels. DO NOT use LaTeX. 
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                },
                required: ["id", "name", "type"],
              },
            },
            links: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  target: { type: Type.STRING },
                  label: { type: Type.STRING },
                },
                required: ["source", "target"],
              },
            },
          },
          required: ["nodes", "links"],
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateExplanation(text: string): Promise<string> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Explain the following text in simple terms. Use real-life analogies and simple examples. 
      IMPORTANT: Use plain text only. DO NOT use LaTeX, mathematical notation like $\\rightarrow$, or complex symbols. 
      Text: ${text}`,
    });
    return response.text || "Failed to generate explanation.";
  }

  static async detectConfusion(userAnswer: string, correctAnswer: string): Promise<{ correction: string; feedback: string }> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `The user provided this answer: "${userAnswer}". The correct answer is: "${correctAnswer}". Detect concept misunderstanding or logic patterns. Provide a clear correction and brutal but helpful feedback. 
      IMPORTANT: Use plain text only. DO NOT use LaTeX. 
      Return as JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            correction: { type: Type.STRING },
            feedback: { type: Type.STRING },
          },
          required: ["correction", "feedback"],
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateAll(text: string): Promise<any> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Analyze the following study text and generate a complete learning package in ONE JSON response.

REQUIRED SECTIONS:
1. summary: short (1-2 sentences), medium (1 paragraph), detailed (multiple paragraphs)
2. keyPoints: at least 12 key learning points as strings
3. questions: exactly 15 two-mark Q&A pairs (id, topic, question, answer, difficulty: Easy/Medium/Hard)
4. mcqs: exactly 25 MCQs with 4 options A/B/C/D (id, topic, question, options, answer, difficulty) — mix of Easy/Medium difficulties for MCQ Practice & Interactive Quiz
5. examMCQs: exactly 15 MCQs, all difficulty:"Hard", unique from mcqs above — for Exam Mode timed test
6. conceptMap: nodes (id, name, type: topic/subtopic/micro/formula/example) and links (source, target, label)
7. eli10: a fun analogy-based simple explanation (1-2 paragraphs)
8. doubts: exactly 8 common student doubts or confusing misconceptions about this topic as strings
9. visualSteps: exactly 6-8 step-by-step logical breakdown items (title, description) for visual animation
10. evolution: exactly 5-7 historical evolution stages (period, concept, explanation, change) showing how this concept developed over time
11. predictions: at least 9 predicted exam questions — mix of marks 2, 5, 10 — each has: marks, question, answer, topic, probability (High/Medium/Low)
12. conceptLinks: for the MAIN topic derived from the text — identify prerequisites (name, reason, importance: Essential/Helpful/Optional), relatedConcepts (name, connection), leadsTo (name, description), studyOrder as string array

CRITICAL RULES:
- Use plain text ONLY. NO LaTeX, NO special symbols, NO markdown in string values
- Generate exactly the counts specified above
- All content must be relevant to the provided text

Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.OBJECT,
              properties: {
                short: { type: Type.STRING },
                medium: { type: Type.STRING },
                detailed: { type: Type.STRING },
              },
              required: ["short", "medium", "detailed"],
            },
            keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                },
                required: ["id", "topic", "question", "answer", "difficulty"],
              },
            },
            mcqs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.OBJECT,
                    properties: {
                      A: { type: Type.STRING },
                      B: { type: Type.STRING },
                      C: { type: Type.STRING },
                      D: { type: Type.STRING },
                    },
                    required: ["A", "B", "C", "D"],
                  },
                  answer: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                },
                required: ["id", "topic", "question", "options", "answer", "difficulty"],
              },
            },
            examMCQs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.OBJECT,
                    properties: {
                      A: { type: Type.STRING },
                      B: { type: Type.STRING },
                      C: { type: Type.STRING },
                      D: { type: Type.STRING },
                    },
                    required: ["A", "B", "C", "D"],
                  },
                  answer: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                },
                required: ["id", "topic", "question", "options", "answer", "difficulty"],
              },
            },
            conceptMap: {
              type: Type.OBJECT,
              properties: {
                nodes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      type: { type: Type.STRING },
                    },
                    required: ["id", "name", "type"],
                  },
                },
                links: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      source: { type: Type.STRING },
                      target: { type: Type.STRING },
                      label: { type: Type.STRING },
                    },
                    required: ["source", "target"],
                  },
                },
              },
              required: ["nodes", "links"],
            },
            eli10: { type: Type.STRING },
            doubts: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["title", "description"],
              },
            },
            evolution: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  period: { type: Type.STRING },
                  concept: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  change: { type: Type.STRING },
                },
                required: ["period", "concept", "explanation", "change"],
              },
            },
            predictions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  marks: { type: Type.NUMBER },
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING },
                  topic: { type: Type.STRING },
                  probability: { type: Type.STRING },
                },
                required: ["marks", "question", "answer", "topic", "probability"],
              },
            },
            conceptLinks: {
              type: Type.OBJECT,
              properties: {
                prerequisites: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      reason: { type: Type.STRING },
                      importance: { type: Type.STRING },
                    },
                    required: ["name", "reason", "importance"],
                  },
                },
                relatedConcepts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      connection: { type: Type.STRING },
                    },
                    required: ["name", "connection"],
                  },
                },
                leadsTo: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                    required: ["name", "description"],
                  },
                },
                studyOrder: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["prerequisites", "relatedConcepts", "leadsTo", "studyOrder"],
            },
          },
          required: ["summary", "keyPoints", "questions", "mcqs", "examMCQs", "conceptMap", "eli10", "doubts", "visualSteps", "evolution", "predictions", "conceptLinks"],
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async predictExamQuestions(syllabus: string): Promise<{
    marks: number;
    question: string;
    answer: string;
    topic: string;
    probability: string;
  }[]> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Based on the following study content, generate probable exam questions with complete model answers.
      Generate a good mix of:
      - 2-mark questions: short answer (2-3 sentences)
      - 5-mark questions: medium answer (1-2 paragraphs)
      - 10-mark questions: detailed essay/long answer (multiple paragraphs)

      For each question provide:
      - marks: the mark value (2, 5, or 10 only)
      - question: the full exam question as it would appear in a paper
      - answer: a complete model answer appropriate for the marks allotted
      - topic: the topic or chapter this question belongs to
      - probability: likelihood of appearing in exam (High / Medium / Low)

      Generate at least 3 questions per mark type (minimum 9 total).
      IMPORTANT: Use plain text only. DO NOT use LaTeX or special symbols.
      Content: ${syllabus}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              marks: { type: Type.NUMBER },
              question: { type: Type.STRING },
              answer: { type: Type.STRING },
              topic: { type: Type.STRING },
              probability: { type: Type.STRING },
            },
            required: ["marks", "question", "answer", "topic", "probability"],
          },
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async analyzePastPapers(papersText: string): Promise<{
    repeatedPatterns: { question: string; frequency: number; years: string[] }[];
    hotTopics: { topic: string; importance: string; frequency: number; tip: string }[];
    conceptFrequency: { concept: string; count: number; category: string }[];
    examStrategy: string[];
  }> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Analyze these previous year question papers and extract:
      1. Repeated question patterns (questions that appear frequently)
      2. Hot topics (most frequently examined topics with importance level: High/Medium/Low)
      3. Concept frequency (how often each concept appears)
      4. Exam strategy tips based on patterns
      
      IMPORTANT: Use plain text only. DO NOT use LaTeX.
      Papers Content: ${papersText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            repeatedPatterns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  frequency: { type: Type.NUMBER },
                  years: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["question", "frequency", "years"],
              },
            },
            hotTopics: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  importance: { type: Type.STRING },
                  frequency: { type: Type.NUMBER },
                  tip: { type: Type.STRING },
                },
                required: ["topic", "importance", "frequency", "tip"],
              },
            },
            conceptFrequency: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  concept: { type: Type.STRING },
                  count: { type: Type.NUMBER },
                  category: { type: Type.STRING },
                },
                required: ["concept", "count", "category"],
              },
            },
            examStrategy: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["repeatedPatterns", "hotTopics", "conceptFrequency", "examStrategy"],
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateConceptLinks(topic: string, fullText: string): Promise<{
    prerequisites: { name: string; reason: string; importance: string }[];
    relatedConcepts: { name: string; connection: string }[];
    leadsTo: { name: string; description: string }[];
    studyOrder: string[];
  }> {
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `For the concept "${topic}" in the context of this text:
      
      Identify:
      1. Prerequisites - concepts you must know BEFORE studying this topic (with reason and importance: Essential/Helpful/Optional)
      2. Related concepts - parallel concepts that connect to this one
      3. Leads to - advanced concepts this topic unlocks
      4. Recommended study order for all related concepts
      
      IMPORTANT: Use plain text only. DO NOT use LaTeX.
      Context: ${fullText.substring(0, 2000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prerequisites: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  importance: { type: Type.STRING },
                },
                required: ["name", "reason", "importance"],
              },
            },
            relatedConcepts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  connection: { type: Type.STRING },
                },
                required: ["name", "connection"],
              },
            },
            leadsTo: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                },
                required: ["name", "description"],
              },
            },
            studyOrder: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["prerequisites", "relatedConcepts", "leadsTo", "studyOrder"],
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async generateAudioScript(text: string, summary?: string): Promise<{
    title: string;
    segments: { type: string; text: string; pause: number }[];
    totalDuration: number;
  }> {
    const inputText = summary || text;
    const response = await ai.models.generateContent({
      model: this.model,
      contents: `Convert this study content into an engaging podcast-style audio revision script.
      
      Format it as segments with types: 'intro', 'topic', 'key-point', 'example', 'recap', 'outro'
      Each segment should have a short pause duration in seconds (0.3 to 1.5).
      Make it conversational, energetic, and revision-friendly. Use phrases like "Now let's talk about...", "Here's the key thing...", "Remember this: ...", "Quick recap..."
      Keep each segment concise (1-3 sentences max).
      
      IMPORTANT: Use plain text only. DO NOT use LaTeX or special symbols.
      Content: ${inputText.substring(0, 3000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            segments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  text: { type: Type.STRING },
                  pause: { type: Type.NUMBER },
                },
                required: ["type", "text", "pause"],
              },
            },
            totalDuration: { type: Type.NUMBER },
          },
          required: ["title", "segments", "totalDuration"],
        },
      },
    });
    return this.parseJSON(response.text);
  }

  static async evaluateViva(vivaData: { question: string; spokenAnswer: string; expectedAnswer: string }[]): Promise<{
    evaluations: { question: string; spokenAnswer: string; isCorrect: boolean; score: number; feedback: string; correction: string }[];
    totalScore: number;
    maxScore: number;
    grade: string;
    advice: string[];
    appreciation: string;
  }> {
    const formattedData = vivaData.map((v, i) =>
      `Q${i + 1}: ${v.question}\nStudent answer: ${v.spokenAnswer}\nExpected answer: ${v.expectedAnswer}`
    ).join('\n\n');

    const response = await ai.models.generateContent({
      model: this.model,
      contents: `You are a viva examiner. Evaluate the student's spoken answers compared to the expected answers.
      
      For each question:
      - isCorrect: true if the student's answer is substantially correct (covers key concepts), false otherwise
      - score: 0-10 based on accuracy, completeness, and clarity
      - feedback: brief constructive feedback (1-2 sentences)
      - correction: what the correct answer should include (if wrong or incomplete)
      
      Then provide:
      - totalScore: sum of all scores
      - maxScore: total possible (10 per question)
      - grade: "Excellent" (>=85%), "Good" (>=70%), "Satisfactory" (>=50%), "Needs Improvement" (<50%)
      - advice: 3-5 practical study tips based on the weak areas
      - appreciation: a warm, encouraging message acknowledging their effort
      
      IMPORTANT: Be fair but honest. Use plain text only.
      
      Viva Data:
      ${formattedData}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            evaluations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  spokenAnswer: { type: Type.STRING },
                  isCorrect: { type: Type.BOOLEAN },
                  score: { type: Type.NUMBER },
                  feedback: { type: Type.STRING },
                  correction: { type: Type.STRING },
                },
                required: ["question", "spokenAnswer", "isCorrect", "score", "feedback", "correction"],
              },
            },
            totalScore: { type: Type.NUMBER },
            maxScore: { type: Type.NUMBER },
            grade: { type: Type.STRING },
            advice: { type: Type.ARRAY, items: { type: Type.STRING } },
            appreciation: { type: Type.STRING },
          },
          required: ["evaluations", "totalScore", "maxScore", "grade", "advice", "appreciation"],
        },
      },
    });
    return this.parseJSON(response.text);
  }
}
