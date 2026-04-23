/**
 * DistroLearn — Redux Store
 *
 * Uses Redux Toolkit. Currently minimal — provides a store shell
 * that App.tsx wraps around the component tree via <Provider>.
 *
 * Slices to add as needed:
 *   - sessionSlice  : current flash-card session state
 *   - cardQueueSlice: deck management, priority queue
 *   - uiSlice       : modal visibility, toasts
 */
import { configureStore, createSlice } from '@reduxjs/toolkit';

// Placeholder slice — Redux requires at least one reducer
const appSlice = createSlice({
  name: 'app',
  initialState: { ready: false },
  reducers: {},
});

export const store = configureStore({
  reducer: {
    app: appSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // SQLite rows contain non-serialisable dates
    }),
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
