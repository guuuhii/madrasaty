export interface Question {
  id: string;
  question_text: string;
  options: string[]; // Usually 4 options, e.g. ["أ) الأولى", "ب) الثانية", "ج) الثالثة", "د) الرابعة"]
  correct_answer: string; // Must be 'أ' or 'ب' or 'ج' or 'د'
  subject: string;
  difficulty: "سهل" | "متوسط" | "صعب";
  created_at: string;
  userId?: string;
  creatorEmail?: string; // Optional field populated for admin viewing
}

export interface Exam {
  id: string;
  title: string;
  subject: string;
  difficulty: string;
  duration: string;
  questions: Question[];
  created_at: string;
  userId?: string;
}

export type ViewType = "questions" | "generate" | "import" | "settings" | "admin";
