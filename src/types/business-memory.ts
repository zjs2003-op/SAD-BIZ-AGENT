export interface BusinessMemory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface AskQuestionRequest {
  question: string;
}

export interface AskQuestionResponse {
  answer: string;
  sources: Pick<BusinessMemory, "id" | "title">[];
}
