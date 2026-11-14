import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import { api } from '@/services/api'
import type { CommandResponse, ToolActivity, UiBlock } from '@/types/api'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  text: string
  blocks?: UiBlock[]
  tools?: ToolActivity[]
}

interface CommandState {
  conversationId: string | undefined
  messages: ChatMessage[]
  status: 'idle' | 'loading'
  /** Bumped whenever the server-side conversation list changes, so the history panel refetches. */
  revision: number
}

const initialState: CommandState = { conversationId: undefined, messages: [], status: 'idle', revision: 0 }

type ThunkConfig = { state: { command: CommandState }; rejectValue: string }

const messageOf = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export const sendCommand = createAsyncThunk<CommandResponse, string, ThunkConfig>(
  'command/send',
  async (message, { getState, rejectWithValue }) => {
    try {
      return await api.sendCommand(message, getState().command.conversationId)
    } catch (e) {
      return rejectWithValue(messageOf(e))
    }
  },
)

export const openConversation = createAsyncThunk<{ id: string; messages: ChatMessage[] }, string, ThunkConfig>(
  'command/open',
  async (id, { rejectWithValue }) => {
    try {
      const rows = await api.getConversationMessages(id)
      return { id, messages: rows.map((m) => ({ id: m.id, role: m.role, text: m.content, blocks: m.ui_blocks })) }
    } catch (e) {
      return rejectWithValue(messageOf(e))
    }
  },
)

const commandSlice = createSlice({
  name: 'command',
  initialState,
  reducers: {
    clearConversation: (s) => ({ ...initialState, revision: s.revision }),
  },
  extraReducers: (b) => {
    b.addCase(sendCommand.pending, (s, a) => {
      s.status = 'loading'
      s.messages.push({ id: a.meta.requestId, role: 'user', text: a.meta.arg })
    })
    b.addCase(sendCommand.fulfilled, (s, a) => {
      s.status = 'idle'
      s.conversationId = a.payload.conversation_id
      s.revision += 1
      s.messages.push({
        id: a.payload.message_id,
        role: 'assistant',
        text: a.payload.answer,
        blocks: a.payload.ui_blocks,
        tools: a.payload.tool_activity,
      })
    })
    b.addCase(sendCommand.rejected, (s, a) => {
      s.status = 'idle'
      s.messages.push({ id: a.meta.requestId + '-err', role: 'error', text: a.payload ?? 'Request failed' })
    })
    b.addCase(openConversation.pending, (s) => {
      s.status = 'loading'
    })
    b.addCase(openConversation.fulfilled, (s, a) => {
      s.status = 'idle'
      s.conversationId = a.payload.id
      s.messages = a.payload.messages
    })
    b.addCase(openConversation.rejected, (s, a) => {
      s.status = 'idle'
      s.messages.push({ id: a.meta.requestId + '-err', role: 'error', text: a.payload ?? 'Could not open that conversation' })
    })
  },
})

export const { clearConversation } = commandSlice.actions
export default commandSlice.reducer
