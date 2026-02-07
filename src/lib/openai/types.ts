export interface SuggestedQuestion {
  field: string;
  question: string;
}

export interface AnswerSuggestion {
  topic: string;
  answer: string;
  citations: string[];
}

export interface AgentAction {
  type: string;
  message: string;
}

export interface CopilotOutput {
  detected_product_id?: string;
  suggested_questions: SuggestedQuestion[];
  extracted_fields_updates: Record<string, string>;
  missing_required_fields: string[];
  answer_suggestions?: AnswerSuggestion[];
  agent_actions?: AgentAction[];
}

export interface TranscriptUtterance {
  speaker: 'lead' | 'agent';
  text: string;
  timestamp: string;
}

export interface ProductConfig {
  product_id: string;
  product_name: string;
  eligibility: { states_allowed: string[]; notes: string };
  required_fields: Array<{ key: string; label: string; question: string }>;
  common_objections?: Array<{ topic: string; suggested_clarifiers: string[] }>;
}

export interface CallSummary {
  product_id: string;
  lead_summary: string;
  collected_fields: Record<string, string>;
  missing_fields: string[];
  recommended_next_steps: string[];
}
