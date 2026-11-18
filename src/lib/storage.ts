import {
  categories, followUpStatuses, priorities, tones,
  type ActivityEntry, type AppData, type EmailMessage, type FollowUp, type ReplyDraft,
} from '../types'
import { initialDemoData } from '../data/demoData'

const STORAGE_KEY = 'executive-inbox-manager:v1'

export function loadAppData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return structuredClone(initialDemoData)
  const parsed: unknown = JSON.parse(raw)
  if (!isAppData(parsed)) {
    throw new Error('Saved inbox data is not in a recognised format. Reset the workspace to restore the sample data.')
  }
  return parsed
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetAppData(): AppData {
  localStorage.removeItem(STORAGE_KEY)
  return structuredClone(initialDemoData)
}

function isAppData(value: unknown): value is AppData {
  if (!isRecord(value)) return false
  return Array.isArray(value.messages) && value.messages.every(isMessage)
    && Array.isArray(value.followUps) && value.followUps.every(isFollowUp)
    && Array.isArray(value.drafts) && value.drafts.every(isDraft)
    && Array.isArray(value.activity) && value.activity.every(isActivity)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isPriority(value: unknown): value is EmailMessage['priority'] {
  return priorities.some(priority => priority === value)
}

function isCategory(value: unknown): value is EmailMessage['category'] {
  return categories.some(category => category === value)
}

function isMessage(value: unknown): value is EmailMessage {
  if (!isRecord(value)) return false
  return ['id', 'senderName', 'senderEmail', 'recipient', 'subject', 'preview', 'body', 'receivedAt'].every(key => isString(value[key]))
    && ['isRead', 'needsResponse', 'archived', 'deleted'].every(key => typeof value[key] === 'boolean')
    && isPriority(value.priority) && isCategory(value.category)
    && Array.isArray(value.actions) && value.actions.every(isString)
}

function isFollowUp(value: unknown): value is FollowUp {
  if (!isRecord(value)) return false
  return ['id', 'messageId', 'description', 'owner', 'notes', 'createdAt'].every(key => isString(value[key]))
    && isNullableString(value.dueDate)
    && followUpStatuses.some(status => status === value.status)
    && isPriority(value.priority)
}

function isDraft(value: unknown): value is ReplyDraft {
  if (!isRecord(value)) return false
  return ['id', 'to', 'subject', 'body', 'savedAt'].every(key => isString(value[key]))
    && isNullableString(value.messageId)
    && tones.some(tone => tone === value.tone)
}

function isActivity(value: unknown): value is ActivityEntry {
  return isRecord(value) && isString(value.id) && isString(value.message) && isString(value.at)
}
