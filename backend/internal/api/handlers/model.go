package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/umple/umple-next/backend/internal/model"
)

type ModelHandler struct {
	store *model.Store
}

func NewModelHandler(store *model.Store) *ModelHandler {
	return &ModelHandler{store: store}
}

type CreateModelRequest struct {
	Code string `json:"code"`
}

func (h *ModelHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateModelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	m, err := h.store.Create(req.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create model")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(m)
}

func (h *ModelHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	m, err := h.store.Get(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "model not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(m)
}

func (h *ModelHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req CreateModelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.store.Update(id, req.Code); err != nil {
		writeError(w, http.StatusNotFound, "model not found")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
}
