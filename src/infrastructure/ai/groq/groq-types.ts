export type GroqChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

export type GroqJsonRequest = {
  systemPrompt: string;
  userPrompt: string;
  /** JSON Schema para Structured Outputs; si el modelo no lo soporta se degrada a json_object. */
  jsonSchema?: Record<string, unknown>;
  schemaName?: string;
};

export type GroqJsonResponse = {
  /** Contenido crudo (string JSON) devuelto por el modelo. */
  content: string;
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  /** true si la peticion degrado de json_schema a json_object. */
  usedJsonObjectFallback: boolean;
};
