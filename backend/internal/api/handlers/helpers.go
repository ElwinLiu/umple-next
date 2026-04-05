package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"

	"github.com/umple/umpleonline/backend/internal/model"
)

// apiTab is the JSON representation of an editor tab sent to/from the frontend.
// Used by both CompileRequest and the GET /models/{id} response.
type apiTab struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Code string `json:"code"`
}

// resolveEntryFile returns the entry-point filename for a model. If
// activeTabID is provided, its name is looked up from tabs.json; otherwise we
// fall back to the persisted active tab (or DefaultEntryFile).
func resolveEntryFile(store *model.Store, modelID, activeTabID string) string {
	if activeTabID != "" {
		if name := store.TabNameByID(modelID, activeTabID); name != "" {
			if safe, err := model.SafeTabName(name); err == nil {
				return safe
			}
		}
	}
	return store.ResolveEntryFile(modelID)
}

// resolveModel ensures a model directory exists with the given code written to
// entryFile. If modelID is empty a new model is created; otherwise the
// existing directory is reused. Returns the resolved model ID and directory.
func resolveModel(store *model.Store, modelID, code, entryFile string) (string, string, error) {
	var existing string
	if modelID != "" {
		if data, err := os.ReadFile(filepath.Join(store.ModelDir(modelID), entryFile)); err == nil {
			existing = string(data)
		}
		// If the entry file doesn't exist yet (e.g. tab was renamed), check
		// the previously persisted entry file so layout metadata is preserved.
		if existing == "" {
			if prev := store.ResolveEntryFile(modelID); prev != entryFile {
				if data, err := os.ReadFile(filepath.Join(store.ModelDir(modelID), prev)); err == nil {
					existing = string(data)
				}
			}
		}
	}

	mergedCode := mergeModelCodeWithStoredLayout(code, existing)

	if modelID == "" {
		m, err := store.Create(mergedCode)
		if err != nil {
			return "", "", err
		}
		dir := store.ModelDir(m.ID)
		// store.Create writes to DefaultEntryFile; if the caller needs a
		// different filename, move it so the compiler finds it.
		if entryFile != model.DefaultEntryFile {
			if err := os.Rename(filepath.Join(dir, model.DefaultEntryFile), filepath.Join(dir, entryFile)); err != nil {
				return "", "", err
			}
		}
		return m.ID, dir, nil
	}

	dir := store.ModelDir(modelID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", "", err
	}
	if err := os.WriteFile(filepath.Join(dir, entryFile), []byte(mergedCode), 0644); err != nil {
		return "", "", err
	}
	return modelID, dir, nil
}

func writeError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
