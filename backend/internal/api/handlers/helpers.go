package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umpleonline/backend/internal/model"
)

// resolveModel ensures a model directory exists with the given code written to
// model.ump. If modelID is empty a new model is created; otherwise the
// existing directory is reused. Returns the resolved model ID and directory.
func resolveModel(store *model.Store, modelID, code string) (string, string, error) {
	var existing string
	if modelID != "" {
		if data, err := os.ReadFile(filepath.Join(store.ModelDir(modelID), "model.ump")); err == nil {
			existing = string(data)
		}
	}

	mergedCode := mergeModelCodeWithStoredLayout(code, existing)

	if modelID == "" {
		m, err := store.Create(mergedCode)
		if err != nil {
			return "", "", err
		}
		return m.ID, store.ModelDir(m.ID), nil
	}

	dir := store.ModelDir(modelID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", "", err
	}
	if err := os.WriteFile(filepath.Join(dir, "model.ump"), []byte(mergedCode), 0644); err != nil {
		return "", "", err
	}
	return modelID, dir, nil
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
