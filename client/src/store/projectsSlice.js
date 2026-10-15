import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  projects: [],
  activeProjectId: null,
  activeApplicationId: null,
  loading: false,
  error: null
};

export const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload;
      if (!state.activeProjectId && action.payload.length > 0) {
        state.activeProjectId = action.payload[0].id;
      }
    },
    setActiveProject: (state, action) => {
      state.activeProjectId = action.payload;
      state.activeApplicationId = null;
    },
    setActiveApplication: (state, action) => {
      state.activeApplicationId = action.payload;
    },
    addProject: (state, action) => {
      state.projects.unshift(action.payload);
      state.activeProjectId = action.payload.id;
    },
    updateProject: (state, action) => {
      const idx = state.projects.findIndex(p => p.id === action.payload.id);
      if (idx !== -1) {
        state.projects[idx] = { ...state.projects[idx], ...action.payload };
      }
    },
    deleteProject: (state, action) => {
      state.projects = state.projects.filter(p => p.id !== action.payload);
      if (state.activeProjectId === action.payload) {
        state.activeProjectId = state.projects[0]?.id || null;
        state.activeApplicationId = null;
      }
    },
    updateApplicationInState: (state, action) => {
      state.projects.forEach(p => {
        if (Array.isArray(p.applications)) {
          const aIdx = p.applications.findIndex(a => a.id === action.payload.id);
          if (aIdx !== -1) {
            p.applications[aIdx] = { ...p.applications[aIdx], ...action.payload };
          }
        }
      });
    },
    deleteApplicationFromState: (state, action) => {
      state.projects.forEach(p => {
        if (Array.isArray(p.applications)) {
          p.applications = p.applications.filter(a => a.id !== action.payload);
        }
      });
      if (state.activeApplicationId === action.payload) {
        state.activeApplicationId = null;
      }
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    }
  }
});

export const {
  setProjects,
  setActiveProject,
  setActiveApplication,
  addProject,
  updateProject,
  deleteProject,
  updateApplicationInState,
  deleteApplicationFromState,
  setLoading
} = projectsSlice.actions;

export default projectsSlice.reducer;
