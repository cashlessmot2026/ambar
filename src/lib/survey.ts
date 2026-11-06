import type { Settings, Survey } from './types'

export const DEFAULT_SURVEY: Survey = {
  title: 'Cuéntanos tu experiencia',
  intro: 'Tu opinión nos ayuda a mejorar. Toma menos de un minuto.',
  comment_enabled: true,
  questions: [
    { id: 'atencion', text: 'Atención del personal' },
    { id: 'comida', text: 'Calidad de la comida' },
    { id: 'rapidez', text: 'Rapidez del servicio' },
    { id: 'ambiente', text: 'Ambiente y limpieza' },
  ],
}

/** Encuesta configurada por el admin; si no hay o no tiene preguntas válidas, la de por defecto. */
export function getSurvey(settings: Settings | undefined | null): Survey {
  const s = settings?.survey
  const questions = (s?.questions ?? []).filter((q) => q && q.id && q.text?.trim())
  if (!s || questions.length === 0) return DEFAULT_SURVEY
  return {
    title: s.title?.trim() || DEFAULT_SURVEY.title,
    intro: s.intro ?? DEFAULT_SURVEY.intro,
    comment_enabled: s.comment_enabled !== false,
    questions,
  }
}

export function newQuestionId(): string {
  return 'q' + Math.random().toString(36).slice(2, 9)
}

/** Todas las preguntas con calificación 1–5. */
export function isComplete(survey: Survey, ratings: Record<string, number>): boolean {
  return survey.questions.every((q) => ratings[q.id] >= 1 && ratings[q.id] <= 5)
}
