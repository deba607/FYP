import { type RouteSummary } from './directions';

export function compileRouteSpeechSummary(museumName: string, route: RouteSummary): string {
  return `Route found to ${museumName}. Total distance is ${route.distance}. Estimated travel time is ${route.duration}.`;
}

export function compileStepVoiceInstruction(index: number, step: { instruction: string; distance: string }): string {
  const sanitizedInstruction = step.instruction.replace(/<[^>]*>/g, '');
  return `Step ${index + 1}: In ${step.distance}, ${sanitizedInstruction}.`;
}
