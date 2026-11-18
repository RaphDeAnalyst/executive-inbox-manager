import type { DetectedCommitment, EmailMessage } from '../types'

const actionPattern = /\b(?:please\s+(?:send|share|provide|review|confirm|approve|complete|submit|check|forward|prepare|arrange|schedule)|could you\s+(?:send|share|provide|review|confirm|approve|complete|submit|check|forward|prepare|arrange|schedule|let us know)|we are still waiting for|i am waiting for|payment should be completed|i will\s+(?:send|share|provide|review|confirm|prepare|forward)|please let me know|kindly\s+(?:send|share|confirm|review|approve))\b/i

const datePattern = /\b(?:by\s+)?(today|tomorrow|this\s+friday|next\s+week|within\s+\d+\s+days|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i

function toLocalDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function detectCommitments(message: EmailMessage, now = new Date()): DetectedCommitment[] {
  const sentences = message.body
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean)

  return sentences.flatMap(sourceText => {
    const actionMatch = sourceText.match(actionPattern)
    if (!actionMatch) return []

    const dateMatch = sourceText.match(datePattern)
    const phrase = actionMatch[0].toLowerCase()
    const recipientName = message.recipient.replace(/<[^>]*>/g, '').replace(/["']/g, '').trim()
    const responsible = phrase.startsWith('i will')
      ? message.senderName
      : recipientName && !recipientName.includes('@') ? recipientName : 'Unassigned'
    const action = sourceText.replace(/^(?:[-*]\s*)/, '').replace(/[.!?]+$/, '')

    return [{
      action,
      responsible,
      deadline: dateMatch ? resolveDeadline(dateMatch[1], now) : null,
      sourceText,
    }]
  })
}

export function resolveDeadline(text: string, now = new Date()): string | null {
  const normalized = text.toLowerCase().trim()
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  if (normalized === 'today') return toLocalDateKey(date)
  if (normalized === 'tomorrow') {
    date.setDate(date.getDate() + 1)
    return toLocalDateKey(date)
  }
  if (normalized === 'next week') {
    date.setDate(date.getDate() + 7)
    return toLocalDateKey(date)
  }
  const withinDays = normalized.match(/within\s+(\d+)\s+days/)
  if (withinDays) {
    date.setDate(date.getDate() + Number(withinDays[1]))
    return toLocalDateKey(date)
  }
  const dayName = normalized.replace(/^this\s+/, '')
  const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(dayName)
  if (dayIndex < 0) return null
  const difference = (dayIndex - date.getDay() + 7) % 7 || 7
  date.setDate(date.getDate() + difference)
  return toLocalDateKey(date)
}
