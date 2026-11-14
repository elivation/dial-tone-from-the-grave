// Operator definitions: single source of truth for all ghost operators.
// See design.md "Operator Design" for full spec.
// Populated in task 21.

export const EMERGENCY_NUMBERS = new Set<string>(['10111', '10177', '107', '112', '911', '999']);

export type VoiceConfig = {
  pitch: number;
  rate: number;
  voiceHint: string;
};

export type OperatorDefinition = {
  number: string;
  name: string;
  systemPrompt: string;
  voiceConfig: VoiceConfig;
  ringCount: 2 | 3;
  tools: Array<'search_businesses' | 'search_residents'>;
  greeting: string;
};

// Populated in task 21
export const OPERATORS: Record<string, OperatorDefinition> = {};
