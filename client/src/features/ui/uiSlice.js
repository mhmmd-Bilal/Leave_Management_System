import { createSlice, nanoid } from "@reduxjs/toolkit";

const uiSlice = createSlice({
  name: "ui",
  initialState: { toasts: [] },
  reducers: {
    pushToast: {
      reducer: (state, { payload }) => {
        state.toasts.push(payload);
      },
      prepare: (type, message) => ({ payload: { id: nanoid(), type, message } }),
    },
    dismissToast: (state, { payload }) => {
      state.toasts = state.toasts.filter((t) => t.id !== payload);
    },
  },
});

export const { pushToast, dismissToast } = uiSlice.actions;
export default uiSlice.reducer;
