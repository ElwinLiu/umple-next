package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/umple/umpleonline/backend/internal/model"
)

type TaskHandler struct {
	store *model.Store
}

func NewTaskHandler(store *model.Store) *TaskHandler {
	return &TaskHandler{store: store}
}

type CreateTaskRequest struct {
	Code string `json:"code"`
}

type SubmitTaskRequest struct {
	Code string `json:"code"`
}

type TaskResponse struct {
	ID   string `json:"id"`
	Code string `json:"code"`
}

// Create handles POST /api/tasks — creates a new task model.
func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	m, err := h.store.CreateTask(req.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create task")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(TaskResponse{
		ID:   m.ID,
		Code: m.Code,
	})
}

// Get handles GET /api/tasks/{id} — loads a task by ID.
func (h *TaskHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	m, err := h.store.GetTask(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(TaskResponse{
		ID:   m.ID,
		Code: m.Code,
	})
}

// Submit handles POST /api/tasks/{id}/submit — submits work for a task.
func (h *TaskHandler) Submit(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req SubmitTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Verify task exists
	if _, err := h.store.GetTask(id); err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	// Update the task's code with the submission
	if err := h.store.UpdateTask(id, req.Code); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to submit task")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status": "submitted",
		"taskId": id,
	})
}
