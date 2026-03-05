# StudySnap: Project Features & Tech Stack

This document provides a comprehensive overview of the features, technologies, and tools used in the StudySnap application.

## 🛠 Technology Stack

### Core Frameworks & Languages
- **Frontend**: [React 19](https://react.dev/) (Functional components with Hooks)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Backend**: [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- **Database**: [SQLite](https://www.sqlite.org/index.html) (via `better-sqlite3`)

### AI & Machine Learning
- **AI Model**: [Google Gemini 2.5 Flash](https://ai.google.dev/)
- **Integration**: `@google/genai` (Official Google AI SDK)
- **Voice Intelligence**: Web Speech API for Viva voice recording and transcription.

### UI & Styling
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Animations**: [Motion](https://motion.dev/) (formerly Framer Motion)
- **Markdown Rendering**: `react-markdown`

### Data Visualization
- **Visualization Engine**: [D3.js](https://d3js.org/)
- **Visuals**: Dynamic Concept Maps, Concept DNA, and Hierarchical Flowcharts.

### File & Document Processing
- **PDF Extraction**: `pdf-parse`
- **Word (.docx) Extraction**: `mammoth`
- **PDF Generation**: `jspdf`
- **Image Capture**: `html2canvas` (for exporting visual components)

### Utilities
- **Date Management**: `date-fns`
- **Styling Helpers**: `clsx`, `tailwind-merge`
- **File Uploads**: `multer`
- **TypeScript Runner**: `tsx` (for the dev server)

---

## � Application Tabs & Usage

The StudySnap interface is organized into specialized tabs, each designed for a different stage of the learning process:

### Phase 1: Content Input
- **Dashboard**: The entry point. Upload PDF, DOCX, or TXT files, or paste raw text. Includes a **Similarity Detector** to compare two different texts.

### Phase 2: Knowledge Synthesis
- **Summary**: Provides three levels of summarization (Short, Medium, Detailed) and an **ELI10 (Explain Like I'm 10)** simplified version.
- **Key Points**: Highlights the core pillars and essential takeaways from the material.
- **Q & A Bank**: A collection of 2-mark conceptual questions with toggleable answers for self-review.
- **MCQ Practice**: A dedicated space to practice multiple-choice questions with instant correct/incorrect feedback.

### Phase 3: Visual Learning
- **Concept Map**: An interactive D3-powered graph visualizing how different concepts link together.
- **Concept DNA**: A unique structural visualization of concept relationships.
- **Flowchart**: Generates logical process diagrams and step-by-step workflows from text.
- **Visual Explainer**: Provides interactive visual breakdowns of complex systems or processes.
- **Concept Evolution**: Tracks the history or development stages of a concept over time.

### Phase 4: Assessment & Mastery
- **Interactive Quiz**: A gamified testing environment where students can test their knowledge under pressure.
- **Viva Simulator**: Uses voice recording to simulate an oral exam. AI evaluates spoken answers for accuracy and confusion.
- **Exam Mode**: A formal assessment environment with a countdown timer and professional scoring.
- **Exam Predictor**: Analyzes a provided syllabus to predict high-probability questions for upcoming tests.
- **PYQ Analyzer**: Digs through Past Year Questions (PYQs) to identify recurring patterns and "hot topics."

### Phase 5: Deep Linking & Audio
- **Doubt Analyzer**: An AI assistant specifically tuned to resolve complex student doubts and "why" questions.
- **Concept Linker**: Recommends the optimal study order by identifying prerequisites and related topics.
- **Audio Revision**: Generates specialized scripts and audio segments designed for listening-based revision.

### Phase 6: Management
- **Export**: Allows users to download their generated study notes, summaries, and assessments as professional PDF documents.
- **Settings**: Manage application state, clear cache, or reset the study session.
