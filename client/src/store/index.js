import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice.js';
import projectsReducer from './projectsSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    projects: projectsReducer
  }
});

export default store;
