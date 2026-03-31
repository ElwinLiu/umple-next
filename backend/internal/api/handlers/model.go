package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/umple/umpleonline/backend/internal/model"
)

type ModelHandler struct {
	store *model.Store
}

func NewModelHandler(store *model.Store) *ModelHandler {
	return &ModelHandler{store: store}
}

func (h *ModelHandler) Get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	m, err := h.store.Get(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "model not found")
		return
	}

	userCode, _, _ := splitModelSections(m.Code)

	// Try to load tabs (nil means no tabs.json / old model)
	tabsData, _ := h.store.LoadTabs(id)

	resp := map[string]any{
		"modelId": m.ID,
		"code":    userCode,
	}
	if tabsData != nil {
		resp["tabs"] = tabsData.Tabs
		resp["activeTabId"] = tabsData.ActiveTabID
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
