import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type FormEvent, type ReactNode } from 'react'
import {
  Archive, ArrowDown, ArrowUpRight, Bell, CalendarDays, Check, CheckCheck,
  ChevronDown, CircleAlert, ClipboardList, Clock3, Copy, FileDown, FileText, Inbox,
  LayoutDashboard, Mail, Menu, MoreHorizontal, PenLine, Plus, Printer, RotateCcw,
  Search, Settings2, Sparkles, Trash2, TriangleAlert, X,
} from 'lucide-react'
import { initialDemoData } from './data/demoData'
import { detectCommitments } from './lib/commitmentEngine'
import { loadAppData, resetAppData, saveAppData } from './lib/storage'
import {
  categories, followUpStatuses, priorities, tones,
  type ActivityEntry, type AppData, type Category, type DraftTone, type EmailMessage,
  type FollowUp, type FollowUpStatus, type Priority, type ReplyDraft, type ViewName,
} from './types'

const navigation: { name: ViewName; icon: typeof Inbox }[] = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Inbox', icon: Inbox },
  { name: 'Needs Attention', icon: CircleAlert },
  { name: 'Follow-ups', icon: ClipboardList },
  { name: 'Drafts', icon: PenLine },
  { name: 'Archived', icon: Archive },
]

const emptyMessageForm = {
  senderName: '', senderEmail: '', recipient: 'Alex Morgan <alex.morgan@example.test>',
  subject: '', body: '', priority: 'Medium' as Priority, category: 'General' as Category,
  needsResponse: false,
}

const emptyFollowUpForm = {
  messageId: '', description: '', owner: 'Alex Morgan', dueDate: '',
  status: 'Pending' as FollowUpStatus, priority: 'Medium' as Priority, notes: '',
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function parseDateOnly(value: string): Date | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day, 12)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
}

function isOverdue(followUp: FollowUp, now = new Date()): boolean {
  if (followUp.status === 'Completed' || !followUp.dueDate) return false
  const due = parseDateOnly(followUp.dueDate)
  if (!due) return false
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return due < today
}

function formatDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!value) return 'Deadline not specified'
  const date = value.length === 10 ? parseDateOnly(value) : new Date(value)
  if (!date) return 'Invalid date'
  if (Number.isNaN(date.getTime())) return 'Invalid date'
  return new Intl.DateTimeFormat('en', options).format(date)
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  const sameDay = new Date().toDateString() === date.toDateString()
  return sameDay ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date) : formatDate(value)
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'
}

function draftTemplate(message: EmailMessage, tone: DraftTone): string {
  const firstName = message.senderName.split(/\s+/)[0] || 'there'
  const subject = `“${message.subject}”`
  const greetings: Record<DraftTone, string> = {
    Professional: `Hello ${firstName},`,
    Friendly: `Hi ${firstName},`,
    Formal: `Dear ${firstName},`,
    Concise: `Hello ${firstName},`,
  }
  const openings: Record<DraftTone, string> = {
    Professional: `Thank you for your message regarding ${subject}. I appreciate you sharing the details.`,
    Friendly: `Thanks for reaching out about ${subject}. I appreciate the context.`,
    Formal: `Thank you for your correspondence regarding ${subject}. I acknowledge receipt of the information.`,
    Concise: `Thank you for your message about ${subject}.`,
  }
  const closings: Record<DraftTone, string> = {
    Professional: 'Kind regards,',
    Friendly: 'Best,',
    Formal: 'Yours sincerely,',
    Concise: 'Regards,',
  }
  return `${greetings[tone]}\n\n${openings[tone]}\n\n[Add your response or next step here.]\n\n${closings[tone]}\n[Your name]`
}

function parsePastedEmail(raw: string): Partial<typeof emptyMessageForm> {
  const lines = raw.replace(/\r/g, '').split('\n')
  const fields: Record<string, string> = {}
  let bodyStart = -1
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim()) {
      bodyStart = index + 1
      break
    }
    const match = lines[index].match(/^(from|to|subject)\s*:\s*(.*)$/i)
    if (match) fields[match[1].toLowerCase()] = match[2].trim()
  }
  const from = fields.from || ''
  const addressMatch = from.match(/<?([^<>\s]+@[^<>\s]+)>?/)
  const senderName = from.replace(/<[^>]+>/, '').replace(addressMatch?.[0] ?? '', '').replace(/[<>"]/g, '').trim()
  const senderEmail = addressMatch?.[1] || ''
  const rawBody = bodyStart >= 0 ? lines.slice(bodyStart).join('\n').trim() : raw.trim()
  return {
    senderName: senderName || (senderEmail ? senderEmail.split('@')[0] : ''),
    senderEmail,
    recipient: fields.to || emptyMessageForm.recipient,
    subject: fields.subject || '',
    body: rawBody,
  }
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        {children}
      </section>
    </div>
  )
}

function Button({ children, variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone.toLowerCase().replaceAll(' ', '-')}`}>{children}</span>
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>
}

function App() {
  const [toast, setToast] = useState('')
  const storageErrorNotified = useRef(false)
  const [data, setData] = useState<AppData>(() => {
    try {
      return loadAppData()
    } catch (error) {
      window.setTimeout(() => setToast(error instanceof Error ? error.message : 'Unable to load saved inbox data.'), 0)
      return structuredClone(initialDemoData)
    }
  })
  const [view, setView] = useState<ViewName>('Overview')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [priorityFilter, setPriorityFilter] = useState('All priorities')
  const [statusFilter, setStatusFilter] = useState('All messages')
  const [followFilter, setFollowFilter] = useState('All follow-ups')
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<'delete' | 'reset' | null>(null)
  const [modal, setModal] = useState<'message' | 'paste' | 'follow-up' | 'draft' | null>(null)
  const [messageForm, setMessageForm] = useState(emptyMessageForm)
  const [pasteContent, setPasteContent] = useState('')
  const [followUpForm, setFollowUpForm] = useState(emptyFollowUpForm)
  const [draftForm, setDraftForm] = useState<{ messageId: string | null; to: string; subject: string; body: string; tone: DraftTone; draftId: string | null }>({
    messageId: null, to: '', subject: '', body: '', tone: 'Professional', draftId: null,
  })
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      saveAppData(data)
      storageErrorNotified.current = false
    } catch {
      if (!storageErrorNotified.current) {
        setToast('Your browser could not save this change. Check available local storage and try again.')
        storageErrorNotified.current = true
      }
    }
  }, [data])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const visibleMessages = useMemo(() => data.messages.filter(message => !message.deleted), [data.messages])
  const activeMessages = useMemo(() => visibleMessages.filter(message => !message.archived), [visibleMessages])
  const followUpsWithStatus = useMemo(() => data.followUps.map(followUp => ({
    ...followUp,
    overdue: isOverdue(followUp),
  })), [data.followUps])
  const overdueFollowUps = followUpsWithStatus.filter(followUp => followUp.overdue)
  const upcomingFollowUps = followUpsWithStatus.filter(followUp => !followUp.overdue && followUp.status !== 'Completed' && followUp.dueDate)
  const unreadCount = activeMessages.filter(message => !message.isRead).length
  const highPriorityCount = activeMessages.filter(message => message.priority === 'Critical' || message.priority === 'High').length
  const responseCount = activeMessages.filter(message => message.needsResponse).length
  const currentMessage = selectedMessageId ? visibleMessages.find(message => message.id === selectedMessageId) ?? null : null
  const messagesForView = useMemo(() => {
    let records = view === 'Archived'
      ? visibleMessages.filter(message => message.archived)
      : view === 'Needs Attention'
        ? activeMessages.filter(message => message.priority === 'Critical' || message.priority === 'High' || message.needsResponse || overdueFollowUps.some(item => item.messageId === message.id))
        : activeMessages
    if (view === 'Inbox' || view === 'Archived' || view === 'Needs Attention') {
      const query = search.trim().toLowerCase()
      if (query) records = records.filter(message => [message.senderName, message.senderEmail, message.subject, message.preview, message.body, message.category].some(value => value.toLowerCase().includes(query)))
      if (categoryFilter !== 'All categories') records = records.filter(message => message.category === categoryFilter)
      if (priorityFilter !== 'All priorities') records = records.filter(message => message.priority === priorityFilter)
      if (statusFilter === 'Unread') records = records.filter(message => !message.isRead)
      if (statusFilter === 'Read') records = records.filter(message => message.isRead)
      if (statusFilter === 'Needs response') records = records.filter(message => message.needsResponse)
    }
    return [...records].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
  }, [activeMessages, categoryFilter, overdueFollowUps, priorityFilter, search, statusFilter, view, visibleMessages])

  function updateData(updater: (current: AppData) => AppData): void {
    setData(current => updater(current))
  }

  function recordActivity(message: string): ActivityEntry {
    return { id: makeId('activity'), message, at: new Date().toISOString() }
  }

  function updateMessage(id: string, changes: Partial<EmailMessage>, activityMessage?: string): void {
    updateData(current => ({
      ...current,
      messages: current.messages.map(message => message.id === id ? { ...message, ...changes } : message),
      activity: activityMessage ? [recordActivity(activityMessage), ...current.activity].slice(0, 30) : current.activity,
    }))
  }

  function openMessage(message: EmailMessage): void {
    setSelectedMessageId(message.id)
    if (!message.isRead) updateMessage(message.id, { isRead: true }, `Opened message from ${message.senderName}`)
  }

  function toggleRead(message: EmailMessage): void {
    updateMessage(message.id, { isRead: !message.isRead }, `Marked “${message.subject}” ${message.isRead ? 'unread' : 'read'}`)
    setToast(message.isRead ? 'Message marked unread' : 'Message marked read')
  }

  function createFollowUpFromMessage(message: EmailMessage): void {
    const existing = data.followUps.find(item => item.messageId === message.id && item.status !== 'Completed')
    if (existing) {
      setModal(null)
      setEditingFollowUpId(existing.id)
      setFollowUpForm({
        messageId: existing.messageId, description: existing.description, owner: existing.owner,
        dueDate: existing.dueDate ?? '', status: existing.status, priority: existing.priority, notes: existing.notes,
      })
      setModal('follow-up')
      setToast('An open follow-up already exists for this message. You can update it here.')
      return
    }
    const detected = detectCommitments(message)[0]
    setEditingFollowUpId(null)
    setFollowUpForm({
      ...emptyFollowUpForm,
      messageId: message.id,
      description: detected?.action ?? `Follow up: ${message.subject}`,
      owner: detected ? detected.responsible : 'Alex Morgan',
      dueDate: detected?.deadline ?? '',
      priority: message.priority,
      notes: detected ? 'Detected from message content. Confirm the owner and deadline before treating as a commitment.' : '',
    })
    setModal('follow-up')
  }

  function openNewMessage(): void {
    setMessageForm(emptyMessageForm)
    setModal('message')
  }

  function openDraft(message: EmailMessage): void {
    setDraftForm({
      messageId: message.id,
      to: `${message.senderName} <${message.senderEmail}>`,
      subject: `Re: ${message.subject.replace(/^re:\s*/i, '')}`,
      body: draftTemplate(message, 'Professional'),
      tone: 'Professional',
      draftId: null,
    })
    setModal('draft')
  }

  function openSavedDraft(draft: ReplyDraft): void {
    setDraftForm({ ...draft, draftId: draft.id })
    setModal('draft')
  }

  function saveFollowUp(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!followUpForm.description.trim() || !followUpForm.messageId) {
      setToast('Choose a related message and add a follow-up description.')
      return
    }
    const existing = editingFollowUpId ? data.followUps.find(item => item.id === editingFollowUpId) : undefined
    if (!existing) {
      const duplicate = data.followUps.find(item => item.messageId === followUpForm.messageId && item.status !== 'Completed')
      if (duplicate) {
        setToast('An open follow-up already exists for this message. Edit that record instead.')
        return
      }
    }
    const followUp: FollowUp = {
      id: existing?.id ?? makeId('follow-up'),
      messageId: followUpForm.messageId,
      description: followUpForm.description.trim(),
      owner: followUpForm.owner.trim() || 'Unassigned',
      dueDate: followUpForm.dueDate || null,
      status: followUpForm.status,
      priority: followUpForm.priority,
      notes: followUpForm.notes.trim(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    updateData(current => ({
      ...current,
      followUps: existing
        ? current.followUps.map(item => item.id === existing.id ? followUp : item)
        : [followUp, ...current.followUps],
      messages: current.messages.map(message => message.id === followUp.messageId
        ? { ...message, actions: [...message.actions, existing ? 'Follow-up updated' : 'Follow-up created'] }
        : message),
      activity: [recordActivity(`${existing ? 'Updated' : 'Created'} follow-up: ${followUp.description}`), ...current.activity].slice(0, 30),
    }))
    setModal(null)
    setEditingFollowUpId(null)
    setToast(existing ? 'Follow-up updated' : 'Follow-up created')
  }

  function editFollowUp(followUp: FollowUp): void {
    setEditingFollowUpId(followUp.id)
    setFollowUpForm({
      messageId: followUp.messageId, description: followUp.description, owner: followUp.owner,
      dueDate: followUp.dueDate ?? '', status: followUp.status, priority: followUp.priority, notes: followUp.notes,
    })
    setModal('follow-up')
  }

  function completeFollowUp(followUp: FollowUp): void {
    updateData(current => ({
      ...current,
      followUps: current.followUps.map(item => item.id === followUp.id ? { ...item, status: 'Completed' } : item),
      messages: current.messages.map(message => message.id === followUp.messageId
        ? { ...message, actions: [...message.actions, 'Follow-up completed'] }
        : message),
      activity: [recordActivity(`Completed follow-up: ${followUp.description}`), ...current.activity].slice(0, 30),
    }))
    setToast('Follow-up marked complete')
  }

  function saveDraft(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    const existing = draftForm.draftId ? data.drafts.find(item => item.id === draftForm.draftId) : undefined
    const draft: ReplyDraft = {
      id: existing?.id ?? makeId('draft'),
      messageId: draftForm.messageId,
      to: draftForm.to.trim(),
      subject: draftForm.subject.trim(),
      body: draftForm.body,
      tone: draftForm.tone,
      savedAt: new Date().toISOString(),
    }
    updateData(current => ({
      ...current,
      drafts: existing ? current.drafts.map(item => item.id === existing.id ? draft : item) : [draft, ...current.drafts],
      activity: [recordActivity(`Saved reply draft: ${draft.subject || 'Untitled reply'}`), ...current.activity].slice(0, 30),
    }))
    setModal(null)
    setToast('Draft saved on this device')
  }

  function deleteDraft(draft: ReplyDraft): void {
    updateData(current => ({ ...current, drafts: current.drafts.filter(item => item.id !== draft.id) }))
    setToast('Draft discarded')
  }

  function saveMessage(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    if (!messageForm.senderName.trim() || !messageForm.senderEmail.trim() || !messageForm.subject.trim() || !messageForm.body.trim()) {
      setToast('Add a sender, sender email, subject, and message content.')
      return
    }
    const message: EmailMessage = {
      id: makeId('message'),
      ...messageForm,
      senderName: messageForm.senderName.trim(),
      senderEmail: messageForm.senderEmail.trim(),
      recipient: messageForm.recipient.trim() || 'Alex Morgan <alex.morgan@example.test>',
      subject: messageForm.subject.trim(),
      body: messageForm.body.trim(),
      preview: messageForm.body.trim().replace(/\s+/g, ' ').slice(0, 140),
      receivedAt: new Date().toISOString(),
      isRead: false,
      archived: false,
      deleted: false,
      actions: [],
    }
    updateData(current => ({
      ...current,
      messages: [message, ...current.messages],
      activity: [recordActivity(`Added message from ${message.senderName}`), ...current.activity].slice(0, 30),
    }))
    setModal(null)
    setView('Inbox')
    setToast('Message added to your inbox')
  }

  function importPastedEmail(): void {
    const parsed = parsePastedEmail(pasteContent)
    if (!parsed.body?.trim()) {
      setToast('Paste an email with message content before importing.')
      return
    }
    setMessageForm({ ...emptyMessageForm, ...parsed })
    setPasteContent('')
    setModal('message')
  }

  async function importTextFile(file: File | undefined): Promise<void> {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setToast('Choose a plain text (.txt) email file.')
      return
    }
    try {
      const content = await file.text()
      const parsed = parsePastedEmail(content)
      if (!parsed.body?.trim()) throw new Error('The selected file did not contain email text to import.')
      setMessageForm({ ...emptyMessageForm, ...parsed })
      setModal('message')
      setToast('Email content imported. Review the details before saving.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Unable to read this text file.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function exportFollowUps(): void {
    const header = ['Related email', 'Description', 'Responsible person', 'Due date', 'Status', 'Priority', 'Notes']
    const rows = data.followUps.map(item => {
      const message = visibleMessages.find(record => record.id === item.messageId)
      const status = isOverdue(item) ? 'Overdue' : item.status
      return [message?.subject ?? 'Message unavailable', item.description, item.owner, item.dueDate ?? '', status, item.priority, item.notes]
    })
    const csv = [header, ...rows].map(row => row.map(value => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'executive-follow-ups.csv'
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast('Follow-up records exported')
  }

  function confirmDelete(): void {
    if (!deleteTargetId) return
    const message = visibleMessages.find(item => item.id === deleteTargetId)
    updateData(current => ({
      ...current,
      messages: current.messages.map(item => item.id === deleteTargetId ? { ...item, deleted: true } : item),
      activity: [recordActivity(`Deleted message: ${message?.subject ?? 'Message'}`), ...current.activity].slice(0, 30),
    }))
    setConfirmAction(null)
    setDeleteTargetId(null)
    setSelectedMessageId(null)
    setToast('Message deleted')
  }

  function restoreDemoData(): void {
    try {
      setData(resetAppData())
      setView('Overview')
      setSearch('')
      setCategoryFilter('All categories')
      setPriorityFilter('All priorities')
      setStatusFilter('All messages')
      setConfirmAction(null)
      setSelectedMessageId(null)
      setToast('Sample workspace restored')
    } catch {
      setToast('Unable to reset the workspace. Check your browser storage permissions.')
    }
  }

  function startNewFollowUp(): void {
    setEditingFollowUpId(null)
    setFollowUpForm({ ...emptyFollowUpForm, messageId: activeMessages[0]?.id ?? '' })
    setModal('follow-up')
  }

  function showRelatedMessage(messageId: string): void {
    const message = visibleMessages.find(item => item.id === messageId)
    if (!message) {
      setToast('The original message is no longer available.')
      return
    }
    setSelectedMessageId(messageId)
  }

  function markArchived(message: EmailMessage): void {
    updateMessage(message.id, { archived: true }, `Archived “${message.subject}”`)
    setSelectedMessageId(null)
    setToast('Message archived')
  }

  function renderMessageList(records: EmailMessage[], emptyTitle: string, emptyText: string): ReactNode {
    if (!records.length) return <div className="empty-state"><div className="empty-icon"><Mail size={21} /></div><h3>{emptyTitle}</h3><p>{emptyText}</p></div>
    return (
      <div className="message-list">
        {records.map(message => (
          <article className={`message-row ${message.isRead ? '' : 'message-unread'}`} key={message.id}>
            <button className={`read-indicator ${message.isRead ? 'read' : ''}`} aria-label={message.isRead ? 'Mark unread' : 'Mark read'} onClick={() => toggleRead(message)}>
              {message.isRead ? <span /> : <i />}
            </button>
            <button className="message-open" onClick={() => openMessage(message)}>
              <span className="sender-avatar">{initials(message.senderName)}</span>
              <span className="message-copy">
                <span className="message-topline"><strong>{message.senderName}</strong><time>{formatTime(message.receivedAt)}</time></span>
                <span className="message-subject">{message.subject}</span>
                <span className="message-preview">{message.preview}</span>
                <span className="message-tags">
                  <Pill tone={message.priority}>{message.priority}</Pill>
                  <Pill tone="neutral">{message.category}</Pill>
                  {message.needsResponse && <span className="response-flag"><ArrowUpRight size={12} /> Reply needed</span>}
                </span>
              </span>
            </button>
            <button className="row-more" aria-label={`Open ${message.subject}`} onClick={() => openMessage(message)}><MoreHorizontal size={17} /></button>
          </article>
        ))}
      </div>
    )
  }

  function renderFollowUpList(records: FollowUp[]): ReactNode {
    if (!records.length) return <div className="empty-state compact-empty"><div className="empty-icon"><Check size={20} /></div><h3>All clear</h3><p>There are no follow-ups in this view.</p></div>
    return (
      <div className="follow-list">
        {records.map(followUp => {
          const message = visibleMessages.find(item => item.id === followUp.messageId)
          const overdue = isOverdue(followUp)
          return (
            <article className={`follow-row ${overdue ? 'follow-overdue' : ''}`} key={followUp.id}>
              <div className="follow-priority-mark" />
              <div className="follow-main">
                <div className="follow-description">{followUp.description}</div>
                <button className="related-link" onClick={() => showRelatedMessage(followUp.messageId)}>{message ? `${message.senderName} · ${message.subject}` : 'Original message unavailable'} <ArrowUpRight size={12} /></button>
                <div className="follow-meta"><span>{followUp.owner || 'Unassigned'}</span><span className="meta-dot" /><span>{followUp.dueDate ? `Due ${formatDate(followUp.dueDate)}` : 'No deadline'}</span>{overdue && <Pill tone="critical">Overdue</Pill>}</div>
              </div>
              <Pill tone={followUp.status}>{followUp.status}</Pill>
              <div className="follow-actions">
                {followUp.status !== 'Completed' && <button className="icon-button" aria-label="Mark follow-up complete" title="Mark complete" onClick={() => completeFollowUp(followUp)}><Check size={16} /></button>}
                <button className="icon-button" aria-label="Edit follow-up" title="Edit follow-up" onClick={() => editFollowUp(followUp)}><PenLine size={15} /></button>
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  function renderDashboard(): ReactNode {
    const attentionMessages = activeMessages.filter(message => message.priority === 'Critical' || message.priority === 'High' || message.needsResponse)
      .sort((a, b) => (a.priority === 'Critical' ? -1 : a.priority === 'High' ? 0 : 1) - (b.priority === 'Critical' ? -1 : b.priority === 'High' ? 0 : 1))
      .slice(0, 4)
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    const todayLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()
    return (
      <>
        <div className="page-title">
          <div><div className="eyebrow">{todayLabel}</div><h1>{greeting}, Alex</h1><p>Here’s the pulse of your inbox and what deserves your attention.</p></div>
          <div className="page-title-actions"><Button variant="primary" onClick={openNewMessage}><Plus size={16} /> Add message</Button></div>
        </div>
        <section className="stat-grid" aria-label="Inbox overview">
          <Metric icon={<Inbox size={17} />} label="Inbox messages" value={activeMessages.length} note="Across all categories" />
          <Metric icon={<Mail size={17} />} label="Unread" value={unreadCount} note="Waiting to be reviewed" tone="blue" />
          <Metric icon={<TriangleAlert size={17} />} label="High priority" value={highPriorityCount} note="Critical or high priority" tone="orange" />
          <Metric icon={<ArrowUpRight size={17} />} label="Needs a reply" value={responseCount} note="Response requested" tone="violet" />
          <Metric icon={<Clock3 size={17} />} label="Overdue follow-ups" value={overdueFollowUps.length} note="Past the due date" tone={overdueFollowUps.length ? 'red' : 'green'} />
          <Metric icon={<CalendarDays size={17} />} label="Upcoming follow-ups" value={upcomingFollowUps.length} note="Open and scheduled" tone="green" />
        </section>
        <div className="dashboard-grid">
          <section className="panel attention-panel">
            <div className="panel-heading"><div><div className="eyebrow">PRIORITY QUEUE</div><h2>Needs attention <span className="count-chip">{attentionMessages.length + overdueFollowUps.length}</span></h2></div><button className="text-link" onClick={() => setView('Needs Attention')}>View all <ArrowUpRight size={14} /></button></div>
            {overdueFollowUps.length > 0 && (
              <button className="urgent-notice" onClick={() => { setView('Follow-ups'); setFollowFilter('Overdue') }}>
                <span className="notice-icon"><TriangleAlert size={16} /></span><span><strong>{overdueFollowUps.length} overdue commitment{overdueFollowUps.length === 1 ? '' : 's'}</strong><small>{overdueFollowUps[0].description}</small></span><ArrowUpRight size={15} />
              </button>
            )}
            {attentionMessages.length ? (
              <div className="attention-list">
                {attentionMessages.map(message => (
                  <button className="attention-item" key={message.id} onClick={() => openMessage(message)}>
                    <span className="sender-avatar small-avatar">{initials(message.senderName)}</span>
                    <span className="attention-copy"><span><strong>{message.senderName}</strong><time>{formatTime(message.receivedAt)}</time></span><b>{message.subject}</b><small>{message.preview}</small></span>
                    <Pill tone={message.priority}>{message.priority}</Pill>
                  </button>
                ))}
              </div>
            ) : <div className="empty-inline"><CheckCheck size={18} /> Nothing urgent is waiting right now.</div>}
          </section>
          <section className="panel upcoming-panel">
            <div className="panel-heading"><div><div className="eyebrow">ON YOUR RADAR</div><h2>Upcoming follow-ups</h2></div><button className="text-link" onClick={() => setView('Follow-ups')}>See tracker <ArrowUpRight size={14} /></button></div>
            {upcomingFollowUps.slice(0, 4).length ? (
              <div className="upcoming-list">
                {upcomingFollowUps.slice(0, 4).map(item => (
                  <button className="upcoming-item" key={item.id} onClick={() => editFollowUp(item)}>
                    <span className="date-tile"><b>{item.dueDate ? new Date(`${item.dueDate}T12:00:00`).getDate() : '—'}</b><small>{item.dueDate ? new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(`${item.dueDate}T12:00:00`)).toUpperCase() : 'OPEN'}</small></span>
                    <span className="upcoming-copy"><strong>{item.description}</strong><small>{item.owner} · {item.status}</small></span><ArrowUpRight size={14} />
                  </button>
                ))}
              </div>
            ) : <div className="empty-inline"><CalendarDays size={17} /> No upcoming follow-ups scheduled.</div>}
          </section>
        </div>
        <section className="panel recent-panel">
          <div className="panel-heading"><div><div className="eyebrow">LATEST ACTIVITY</div><h2>Recent activity</h2></div><span className="privacy-caption"><span className="online-dot" /> Saved on this device</span></div>
          {data.activity.length ? <div className="activity-list">{data.activity.slice(0, 5).map(entry => <ActivityRow key={entry.id} entry={entry} />)}</div> : <div className="empty-inline">Your actions will appear here as you work.</div>}
        </section>
      </>
    )
  }

  function renderMessageWorkspace(): ReactNode {
    const isArchived = view === 'Archived'
    const title = view === 'Needs Attention' ? 'Needs attention' : isArchived ? 'Archived' : 'Inbox'
    const subtitle = view === 'Needs Attention' ? 'Important requests and messages that need a thoughtful response.' : isArchived ? 'Messages you have set aside for reference.' : 'A considered view of every message in your workspace.'
    return (
      <>
        <div className="page-title"><div><div className="eyebrow">COMMUNICATIONS</div><h1>{title}</h1><p>{subtitle}</p></div><div className="page-title-actions"><Button variant="secondary" onClick={() => setModal('paste')}><FileText size={15} /> Paste email</Button><Button variant="primary" onClick={openNewMessage}><Plus size={15} /> Add message</Button></div></div>
        <section className="panel list-panel">
          <div className="list-toolbar">
            <div className="list-summary"><strong>{messagesForView.length}</strong> {messagesForView.length === 1 ? 'message' : 'messages'}{view === 'Inbox' && unreadCount > 0 && <span className="unread-summary">{unreadCount} unread</span>}</div>
            <div className="filters">
              <label className="select-wrap"><span className="sr-only">Filter by category</span><select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option>All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label>
              <label className="select-wrap"><span className="sr-only">Filter by priority</span><select value={priorityFilter} onChange={event => setPriorityFilter(event.target.value)}><option>All priorities</option>{priorities.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={13} /></label>
              <label className="select-wrap"><span className="sr-only">Filter by message status</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>All messages</option><option>Unread</option><option>Read</option><option>Needs response</option></select><ChevronDown size={13} /></label>
            </div>
          </div>
          {renderMessageList(messagesForView, search || categoryFilter !== 'All categories' || priorityFilter !== 'All priorities' || statusFilter !== 'All messages' ? 'No matching messages' : isArchived ? 'No archived messages' : 'Your inbox is clear', search || categoryFilter !== 'All categories' || priorityFilter !== 'All priorities' || statusFilter !== 'All messages' ? 'Try adjusting your search or filters.' : 'Newly added messages will appear here.')}
        </section>
        <div className="import-note"><FileText size={15} /><span>Messages are stored locally on this device. No live email account is connected.</span><button onClick={() => fileInputRef.current?.click()}>Import .txt file <ArrowUpRight size={13} /></button><input ref={fileInputRef} className="sr-only" type="file" accept=".txt,text/plain" onChange={event => void importTextFile(event.target.files?.[0])} /></div>
      </>
    )
  }

  function renderFollowUps(): ReactNode {
    let records = followUpsWithStatus
    if (followFilter === 'Overdue') records = records.filter(item => item.overdue)
    if (followFilter === 'Upcoming') records = records.filter(item => !item.overdue && item.status !== 'Completed' && item.dueDate)
    if (followFilter === 'Completed') records = records.filter(item => item.status === 'Completed')
    records = [...records].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
    return (
      <>
        <div className="page-title"><div><div className="eyebrow">COMMITMENTS & ACTIONS</div><h1>Follow-ups</h1><p>Every commitment, clearly owned and easy to keep on track.</p></div><div className="page-title-actions"><Button onClick={exportFollowUps}><FileDown size={15} /> Export CSV</Button><Button onClick={() => window.print()}><Printer size={15} /> Print report</Button><Button variant="primary" onClick={startNewFollowUp}><Plus size={15} /> New follow-up</Button></div></div>
        <section className="follow-summary-grid">
          <MiniStat label="Open" value={followUpsWithStatus.filter(item => item.status !== 'Completed').length} />
          <MiniStat label="Overdue" value={overdueFollowUps.length} danger={overdueFollowUps.length > 0} />
          <MiniStat label="Upcoming" value={upcomingFollowUps.length} />
          <MiniStat label="Completed" value={followUpsWithStatus.filter(item => item.status === 'Completed').length} />
        </section>
        <section className="panel list-panel follow-panel">
          <div className="list-toolbar"><div className="list-summary"><strong>{records.length}</strong> follow-up{records.length === 1 ? '' : 's'} <span className="detected-caption"><Sparkles size={13} /> Detected items are suggestions, not confirmed commitments</span></div><div className="filters"><label className="select-wrap"><span className="sr-only">Filter follow-ups</span><select value={followFilter} onChange={event => setFollowFilter(event.target.value)}><option>All follow-ups</option><option>Overdue</option><option>Upcoming</option><option>Completed</option></select><ChevronDown size={13} /></label></div></div>
          {renderFollowUpList(records)}
        </section>
      </>
    )
  }

  function renderDrafts(): ReactNode {
    return (
      <>
        <div className="page-title"><div><div className="eyebrow">REPLIES IN PROGRESS</div><h1>Drafts</h1><p>Thoughtful first drafts, saved locally until you are ready.</p></div><div className="page-title-actions"><Pill tone="neutral"><Settings2 size={12} /> Local templates · No AI connected</Pill></div></div>
        <section className="panel draft-panel">
          {data.drafts.length ? <div className="draft-list">{[...data.drafts].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map(draft => {
            const message = visibleMessages.find(item => item.id === draft.messageId)
            return <article className="draft-row" key={draft.id}><div className="draft-icon"><PenLine size={17} /></div><button className="draft-copy" onClick={() => openSavedDraft(draft)}><strong>{draft.subject || 'Untitled reply'}</strong><span>To {draft.to || message?.senderName || 'recipient not set'} · {draft.tone} tone</span><small>{draft.body.replace(/\s+/g, ' ').slice(0, 150)}</small></button><time>{formatTime(draft.savedAt)}</time><button className="icon-button" aria-label="Discard draft" title="Discard draft" onClick={() => deleteDraft(draft)}><Trash2 size={15} /></button></article>
          })}</div> : <div className="empty-state"><div className="empty-icon"><PenLine size={20} /></div><h3>No saved drafts yet</h3><p>Open any inbox message and choose “Draft a reply” to prepare a response.</p><Button variant="secondary" onClick={() => setView('Inbox')}><Inbox size={15} /> Go to inbox</Button></div>}
        </section>
        <div className="draft-footnote"><Sparkles size={15} /><span>Drafts use local tone templates and only the message subject. Review and complete every draft yourself before sending.</span></div>
      </>
    )
  }

  function changeView(nextView: ViewName): void {
    setView(nextView)
    setMobileNavOpen(false)
    if (nextView === 'Inbox' || nextView === 'Archived' || nextView === 'Needs Attention') {
      setCategoryFilter('All categories')
      setPriorityFilter('All priorities')
      setStatusFilter('All messages')
    }
  }

  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Dismiss navigation overlay" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand"><div className="brand-mark"><Mail size={18} /></div><div className="brand-text"><strong>Northstar</strong><span>EXECUTIVE WORKSPACE</span></div><button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={17} /></button></div>
        <div className="workspace-switch"><span className="workspace-avatar">N</span><span className="workspace-info"><strong>Executive Office</strong><span>Personal workspace</span></span><ChevronDown size={14} /></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => {
            const count = name === 'Inbox' ? unreadCount : name === 'Needs Attention' ? highPriorityCount + overdueFollowUps.length : name === 'Follow-ups' ? overdueFollowUps.length : name === 'Drafts' ? data.drafts.length : null
            return <button className={`nav-item ${view === name ? 'nav-active' : ''}`} key={name} onClick={() => changeView(name)}><Icon size={17} /><span>{name}</span>{count !== null && count > 0 && <span className="nav-count">{count}</span>}</button>
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note"><span className="privacy-icon"><Settings2 size={15} /></span><span><strong>Private by design</strong><small>Data stays in this browser</small></span></div>
          <div className="profile-menu"><span className="user-avatar">AM</span><span className="profile-copy"><strong>Alex Morgan</strong><small>Executive assistant</small></span><button className="icon-button" aria-label="Restore sample workspace" title="Restore sample workspace" onClick={() => setConfirmAction('reset')}><RotateCcw size={15} /></button></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={18} /></button><div className="breadcrumb">Executive Office <span>/</span> <strong>{view}</strong></div></div><div className="topbar-actions"><label className="global-search"><Search size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search messages..." aria-label="Search messages" /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" aria-label={`${overdueFollowUps.length} overdue follow-ups`} onClick={() => changeView('Follow-ups')}><Bell size={17} />{overdueFollowUps.length > 0 && <i />}</button><span className="top-avatar">AM</span></div></header>
        <div className="content-area"><div className="page">
          {view === 'Overview' && renderDashboard()}
          {(view === 'Inbox' || view === 'Needs Attention' || view === 'Archived') && renderMessageWorkspace()}
          {view === 'Follow-ups' && renderFollowUps()}
          {view === 'Drafts' && renderDrafts()}
        </div></div>
        <footer className="app-footer"><span>Executive Inbox & Follow-up Manager</span><span>Local workspace <i /> No email account connected</span></footer>
      </main>

      {currentMessage && <Modal title="Message details" onClose={() => setSelectedMessageId(null)} wide>
        <div className="message-detail">
          <div className="detail-subject"><div><div className="eyebrow">MESSAGE</div><h2>{currentMessage.subject}</h2></div><div className="detail-badges"><Pill tone={currentMessage.priority}>{currentMessage.priority}</Pill><Pill>{currentMessage.category}</Pill>{currentMessage.needsResponse && <Pill tone="blue">Needs response</Pill>}</div></div>
          <div className="sender-card"><span className="sender-avatar detail-avatar">{initials(currentMessage.senderName)}</span><div className="sender-info"><strong>{currentMessage.senderName}</strong><span>{currentMessage.senderEmail}</span></div><div className="sender-time">To {currentMessage.recipient}<br />{formatDate(currentMessage.receivedAt, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</div></div>
          <div className="detail-body">{currentMessage.body.split(/\n{2,}/).map((paragraph, index) => <p key={`${currentMessage.id}-p-${index}`}>{paragraph}</p>)}</div>
          <section className="commitment-box"><div className="subsection-title"><span><Sparkles size={15} /> Potential commitments detected</span><small>Rule-based suggestions · confirm before acting</small></div>
            {detectCommitments(currentMessage).length ? detectCommitments(currentMessage).map((item, index) => <div className="detected-item" key={`${currentMessage.id}-detected-${index}`}><span className="detected-icon"><ClipboardList size={15} /></span><span><strong>{item.action}</strong><small>Responsible: {item.responsible || 'Unassigned'} · Deadline: {item.deadline ? formatDate(item.deadline) : 'Deadline not specified'}</small></span><Button className="small-button" onClick={() => createFollowUpFromMessage(currentMessage)}>Create follow-up</Button></div>) : <div className="no-commitment">No potential follow-up language was detected in this message.</div>}
          </section>
          {(data.followUps.filter(item => item.messageId === currentMessage.id).length > 0 || currentMessage.actions.length > 0) && <section className="history-box"><div className="subsection-title"><span><Clock3 size={15} /> Related follow-up & actions</span></div>{data.followUps.filter(item => item.messageId === currentMessage.id).map(item => <div className="history-line" key={item.id}><Pill tone={isOverdue(item) ? 'critical' : item.status}>{isOverdue(item) ? 'Overdue' : item.status}</Pill><span>{item.description}</span><button className="text-link" onClick={() => editFollowUp(item)}>Edit</button></div>)}{currentMessage.actions.map((action, index) => <div className="history-line" key={`${currentMessage.id}-action-${index}`}><span className="history-dot" /><span>{action}</span></div>)}</section>}
          <div className="detail-selects"><Field label="Priority"><select value={currentMessage.priority} onChange={event => updateMessage(currentMessage.id, { priority: event.target.value as Priority }, `Changed priority for “${currentMessage.subject}”`)}>{priorities.map(item => <option key={item}>{item}</option>)}</select></Field><Field label="Category"><select value={currentMessage.category} onChange={event => updateMessage(currentMessage.id, { category: event.target.value as Category }, `Changed category for “${currentMessage.subject}”`)}>{categories.map(item => <option key={item}>{item}</option>)}</select></Field><label className="response-toggle"><input type="checkbox" checked={currentMessage.needsResponse} onChange={event => updateMessage(currentMessage.id, { needsResponse: event.target.checked }, `${event.target.checked ? 'Flagged' : 'Cleared'} reply needed for “${currentMessage.subject}”`)} /> Requires a response</label></div>
          <div className="modal-actions detail-actions"><Button onClick={() => toggleRead(currentMessage)}>{currentMessage.isRead ? <Mail size={15} /> : <CheckCheck size={15} />}{currentMessage.isRead ? 'Mark unread' : 'Mark as read'}</Button><Button onClick={() => createFollowUpFromMessage(currentMessage)}><Plus size={15} /> Create follow-up</Button><Button variant="primary" onClick={() => openDraft(currentMessage)}><PenLine size={15} /> Draft a reply</Button><Button onClick={() => markArchived(currentMessage)}><Archive size={15} /> Archive</Button><Button variant="danger" onClick={() => { setDeleteTargetId(currentMessage.id); setConfirmAction('delete') }}><Trash2 size={15} /> Delete</Button></div>
        </div>
      </Modal>}

      {modal === 'message' && <Modal title="Add a message" onClose={() => setModal(null)} wide>
        <form className="form-grid" onSubmit={saveMessage}>
          <Field label="Sender name"><input required value={messageForm.senderName} onChange={event => setMessageForm({ ...messageForm, senderName: event.target.value })} placeholder="e.g. Taylor Morgan" /></Field>
          <Field label="Sender email"><input required type="email" value={messageForm.senderEmail} onChange={event => setMessageForm({ ...messageForm, senderEmail: event.target.value })} placeholder="name@company.example" /></Field>
          <Field label="Recipient"><input value={messageForm.recipient} onChange={event => setMessageForm({ ...messageForm, recipient: event.target.value })} /></Field>
          <Field label="Subject"><input required value={messageForm.subject} onChange={event => setMessageForm({ ...messageForm, subject: event.target.value })} placeholder="Email subject" /></Field>
          <Field label="Message content" className="span-two"><textarea required rows={7} value={messageForm.body} onChange={event => setMessageForm({ ...messageForm, body: event.target.value })} placeholder="Paste or type the complete message..." /></Field>
          <Field label="Priority"><select value={messageForm.priority} onChange={event => setMessageForm({ ...messageForm, priority: event.target.value as Priority })}>{priorities.map(item => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Category"><select value={messageForm.category} onChange={event => setMessageForm({ ...messageForm, category: event.target.value as Category })}>{categories.map(item => <option key={item}>{item}</option>)}</select></Field>
          <label className="response-toggle form-toggle"><input type="checkbox" checked={messageForm.needsResponse} onChange={event => setMessageForm({ ...messageForm, needsResponse: event.target.checked })} /> Requires a response</label>
          <div className="form-note"><Settings2 size={14} /> Manually added message · stored only in this browser</div>
          <div className="modal-actions span-two"><Button type="button" onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" type="submit"><Plus size={15} /> Add to inbox</Button></div>
        </form>
      </Modal>}

      {modal === 'paste' && <Modal title="Paste an email" onClose={() => setModal(null)}>
        <div className="paste-intro"><p>Paste a plain-text email below. Recognised From, To, and Subject headers will be prefilled for review.</p><div className="format-hint">From: sender@example.com<br />To: recipient@example.com<br />Subject: Email subject</div></div>
        <Field label="Email text"><textarea rows={10} value={pasteContent} onChange={event => setPasteContent(event.target.value)} placeholder={'From: Jordan Lee <jordan@example.com>\\nTo: Alex Morgan <alex@example.test>\\nSubject: Project update\\n\\nPaste the email body here...'} /></Field>
        <div className="modal-actions"><Button onClick={() => { setModal(null); fileInputRef.current?.click() }}><FileText size={15} /> Import .txt instead</Button><Button variant="primary" onClick={importPastedEmail}><ArrowDown size={15} /> Review message</Button></div>
      </Modal>}

      {modal === 'follow-up' && <Modal title={editingFollowUpId ? 'Edit follow-up' : 'Create follow-up'} onClose={() => { setModal(null); setEditingFollowUpId(null) }}>
        <form className="form-grid" onSubmit={saveFollowUp}>
          <Field label="Related message" className="span-two"><select required value={followUpForm.messageId} onChange={event => setFollowUpForm({ ...followUpForm, messageId: event.target.value })}><option value="">Choose a message</option>{visibleMessages.map(message => <option value={message.id} key={message.id}>{message.senderName} — {message.subject}</option>)}</select></Field>
          <Field label="Follow-up description" className="span-two"><input required value={followUpForm.description} onChange={event => setFollowUpForm({ ...followUpForm, description: event.target.value })} placeholder="What needs to happen?" /></Field>
          <Field label="Responsible person"><input value={followUpForm.owner} onChange={event => setFollowUpForm({ ...followUpForm, owner: event.target.value })} placeholder="Unassigned" /></Field>
          <Field label="Due date"><input type="date" value={followUpForm.dueDate} onChange={event => setFollowUpForm({ ...followUpForm, dueDate: event.target.value })} /></Field>
          <Field label="Status"><select value={followUpForm.status} onChange={event => setFollowUpForm({ ...followUpForm, status: event.target.value as FollowUpStatus })}>{followUpStatuses.map(item => <option key={item}>{item}</option>)}</select><small className="field-hint">Overdue is calculated from this due date.</small></Field>
          <Field label="Priority"><select value={followUpForm.priority} onChange={event => setFollowUpForm({ ...followUpForm, priority: event.target.value as Priority })}>{priorities.map(item => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Notes" className="span-two"><textarea rows={3} value={followUpForm.notes} onChange={event => setFollowUpForm({ ...followUpForm, notes: event.target.value })} placeholder="Context or next-step detail (optional)" /></Field>
          <div className="form-note span-two"><CircleAlert size={14} /> Detected items are suggestions. Confirm ownership and dates before relying on them.</div>
          <div className="modal-actions span-two"><Button type="button" onClick={() => setModal(null)}>Cancel</Button><Button variant="primary" type="submit"><Check size={15} /> {editingFollowUpId ? 'Save changes' : 'Create follow-up'}</Button></div>
        </form>
      </Modal>}

      {modal === 'draft' && <Modal title={draftForm.draftId ? 'Edit saved draft' : 'Draft a reply'} onClose={() => setModal(null)} wide>
        <form className="form-grid draft-form" onSubmit={saveDraft}>
          <div className="draft-disclaimer span-two"><Sparkles size={16} /><span><strong>Local template, not AI-generated.</strong> The reply is a starting point only. No facts, dates, or commitments have been added.</span></div>
          <Field label="To"><input value={draftForm.to} onChange={event => setDraftForm({ ...draftForm, to: event.target.value })} /></Field>
          <Field label="Subject"><input value={draftForm.subject} onChange={event => setDraftForm({ ...draftForm, subject: event.target.value })} /></Field>
          <Field label="Tone"><select value={draftForm.tone} onChange={event => {
            const tone = event.target.value as DraftTone
            const message = visibleMessages.find(item => item.id === draftForm.messageId)
            setDraftForm({ ...draftForm, tone, body: message ? draftTemplate(message, tone) : draftForm.body })
          }}>{tones.map(item => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Reply content" className="span-two"><textarea rows={12} value={draftForm.body} onChange={event => setDraftForm({ ...draftForm, body: event.target.value })} placeholder="Write your response..." /></Field>
          <div className="draft-actions span-two"><div><Button type="button" onClick={async () => { try { await navigator.clipboard.writeText(draftForm.body); setToast('Draft copied to clipboard') } catch { setToast('Clipboard access was denied by your browser.') } }}><Copy size={15} /> Copy text</Button><Button type="button" onClick={() => { setModal(null); setToast('Draft discarded without saving') }}><Trash2 size={15} /> Discard</Button></div><div><Button type="button" onClick={() => setModal(null)}>Cancel</Button><Button type="submit" variant="primary"><Check size={15} /> Save draft</Button></div></div>
        </form>
      </Modal>}

      {confirmAction && <Modal title={confirmAction === 'delete' ? 'Delete this message?' : 'Restore sample workspace?'} onClose={() => setConfirmAction(null)}>
        <div className="confirm-copy"><span className="confirm-icon">{confirmAction === 'delete' ? <Trash2 size={19} /> : <RotateCcw size={19} />}</span><p>{confirmAction === 'delete' ? 'This message will be removed from your inbox. Related follow-up records will remain available.' : 'This replaces your current local messages, follow-ups, and drafts with the original sample workspace.'}</p></div>
        <div className="modal-actions"><Button onClick={() => setConfirmAction(null)}>Cancel</Button><Button variant="danger" onClick={confirmAction === 'delete' ? confirmDelete : restoreDemoData}>{confirmAction === 'delete' ? 'Delete message' : 'Restore sample data'}</Button></div>
      </Modal>}

      {toast && <div className="toast" role="status"><span className="toast-dot"><Check size={13} /></span><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15} /></button></div>}
    </div>
  )
}

function Metric({ icon, label, value, note, tone = 'neutral' }: { icon: ReactNode; label: string; value: number; note: string; tone?: string }) {
  return <article className="metric-card"><div className={`metric-icon metric-${tone}`}>{icon}</div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>
}

function MiniStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return <div className={`mini-stat ${danger ? 'mini-stat-danger' : ''}`}><span>{label}</span><strong>{value}</strong></div>
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  return <div className="activity-row"><span className="activity-mark"><Check size={12} /></span><span>{entry.message}</span><time>{formatTime(entry.at)}</time></div>
}

export default App
