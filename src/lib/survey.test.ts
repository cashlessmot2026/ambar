import { describe, expect, it } from 'vitest'
import { DEFAULT_SURVEY, getSurvey, isComplete } from './survey'
import type { Settings } from './types'

describe('getSurvey', () => {
  it('usa la encuesta por defecto si no hay configuración', () => {
    expect(getSurvey(undefined)).toBe(DEFAULT_SURVEY)
    expect(getSurvey({} as Settings)).toBe(DEFAULT_SURVEY)
  })
  it('cae al valor por defecto si no queda ninguna pregunta válida', () => {
    const s = { survey: { title: '', intro: '', comment_enabled: true, questions: [{ id: 'a', text: '  ' }] } } as Settings
    expect(getSurvey(s)).toBe(DEFAULT_SURVEY)
  })
  it('respeta las preguntas del admin', () => {
    const s = { survey: { title: 'Hola', intro: 'x', comment_enabled: false, questions: [{ id: 'a', text: 'Sabor' }] } } as Settings
    const r = getSurvey(s)
    expect(r.title).toBe('Hola')
    expect(r.comment_enabled).toBe(false)
    expect(r.questions).toHaveLength(1)
  })
})

describe('isComplete', () => {
  it('exige calificar todas las preguntas', () => {
    expect(isComplete(DEFAULT_SURVEY, {})).toBe(false)
    const all = Object.fromEntries(DEFAULT_SURVEY.questions.map((q) => [q.id, 5]))
    expect(isComplete(DEFAULT_SURVEY, all)).toBe(true)
    expect(isComplete(DEFAULT_SURVEY, { ...all, atencion: 0 })).toBe(false)
  })
})
