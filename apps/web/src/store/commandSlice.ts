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
}

const initialState: CommandState = { conversationId: undefined, messages: [], status: 'idle' }

export const sendCommand = createAsyncThunk<CommandResponse, string, { state: { command: CommandState }; rejectValue: string }>(
  'command/send',
  async (message, { getState, rejectWithValue }) => {
    try {
      return await api.sendCommand(message, getState().command.conversationId)
    } catch (e) {
      return rejectWithValue(e instanceof Error ? e.message : 'Something went wrong')
    }
  },
)

const commandSlice = createSlice({
  name: 'command',
  initialState,
  reducers: {
    clearConversation: () => initialState,
  },
  extraReducers: (b) => {
    b.addCase(sendCommand.pending, (s, a) => {
      s.status = 'loading'
      s.messages.push({ id: a.meta.requestId, role: 'user', text: a.meta.arg })
    })
    b.addCase(sendCommand.fulfilled, (s, a) => {
      s.status = 'idle'
      s.conversationId = a.payload.conversation_id
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
  },
})

export const { clearConversation } = commandSlice.actions
export default commandSlice.reducer
