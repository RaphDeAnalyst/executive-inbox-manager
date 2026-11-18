export const categories = [
  'Urgent',
  'Important',
  'Finance',
  'Meetings',
  'Operations',
  'Client Communication',
  'Personal',
  'General',
] as const

export const priorities = ['Critical', 'High', 'Medium', 'Low'] as const
export const followUpStatuses = ['Pending', 'In Progress', 'Completed'] as const
export const tones = ['Professional', 'Friendly', 'Formal', 'Concise'] as const

export type Category = (typeof categories)[number]
export type Priority = (typeof priorities)[number]
export type FollowUpStatus = (typeof followUpStatuses)[number]
export type DraftTone = (typeof tones)[number]
export type ViewName = 'Overview' | 'Inbox' | 'Needs Attention' | 'Follow-ups' | 'Drafts' | 'Archived'

export interface EmailMessage {
  id: string
  senderName: string
  senderEmail: string
  recipient: string
  subject: string
  preview: string
  body: string
  receivedAt: string
  isRead: boolean
  priority: Priority
  category: Category
  needsResponse: boolean
  archived: boolean
  deleted: boolean
  actions: string[]
}

export interface FollowUp {
  id: string
  messageId: string
  description: string
  owner: string
  dueDate: string | null
  status: FollowUpStatus
  priority: Priority
  notes: string
  createdAt: string
}

export interface ReplyDraft {
  id: string
  messageId: string | null
  to: string
  subject: string
  body: string
  tone: DraftTone
  savedAt: string
}

export interface ActivityEntry {
  id: string
  message: string
  at: string
}

export interface AppData {
  messages: EmailMessage[]
  followUps: FollowUp[]
  drafts: ReplyDraft[]
  activity: ActivityEntry[]
}

export interface DetectedCommitment {
  action: string
  responsible: string
  deadline: string | null
  sourceText: string
}
