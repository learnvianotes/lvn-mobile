import type { Href } from 'expo-router'
import type { RecommendationsQuery } from '@/graphql/generated/graphql'

type Rec = RecommendationsQuery['recommendations'][number]

/** A core subject's topic key as words: core:dsa/binary-trees → "dsa / binary trees". */
export const coreName = (key: string) => key.replace(/^core:/, '').replace('/', ' / ').replace(/-/g, ' ')

/**
 * Where a recommendation leads (lvn-backend ADR-0071, ADR-0076): its note or resource; an exam's topic to the exams;
 * a topic to revise or be quizzed on to its notes in Explore (by the topic, or by its name for a core subject's).
 */
export function recommendationHref(r: Rec): Href {
  if (r.note) return `/notes/${r.note.id}`
  if (r.resource) return `/resources/${r.resource.id}`
  if (r.kind === 'EXAM_TOPIC') return '/exams'
  if (r.topic) return { pathname: '/explore', params: { topic: r.topic.id, topicTitle: r.topicTitle ?? '' } }
  return { pathname: '/explore', params: { q: r.topicTitle || coreName(r.topicKey ?? '') } }
}
