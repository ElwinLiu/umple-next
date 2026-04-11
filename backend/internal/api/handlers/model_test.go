package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	backendmodel "github.com/umple/umpleonline/backend/internal/model"
)

func newTestModelHandler(t *testing.T) (*ModelHandler, *backendmodel.Store) {
	t.Helper()

	store, err := backendmodel.NewStore(filepath.Join(t.TempDir(), "models"))
	if err != nil {
		t.Fatal(err)
	}

	return NewModelHandler(store), store
}

func TestModelHandlerGet_StripsHiddenLayoutFromTabbedActiveFile(t *testing.T) {
	h, store := newTestModelHandler(t)

	activeCode := strings.Join([]string{
		"class Main {}",
		"",
		modelDelimiter,
		"class Main {",
		"  position 10 20 30 40;",
		"}",
		"",
	}, "\n")

	m, err := store.Create(activeCode)
	if err != nil {
		t.Fatal(err)
	}

	if err := store.SaveTabs(m.ID, &backendmodel.TabsData{
		ActiveTabID: "main",
		Tabs: []backendmodel.TabMeta{
			{ID: "main", Name: "Model.ump"},
			{ID: "other", Name: "Other.ump"},
		},
	}); err != nil {
		t.Fatal(err)
	}

	if err := store.SaveTabFiles(m.ID, map[string]string{
		"Model.ump": activeCode,
		"Other.ump": "use Model.ump;\nclass Other {}",
	}, "Model.ump"); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/api/models/"+m.ID, nil)
	req = addChiParam(req, "id", m.ID)
	rec := httptest.NewRecorder()

	h.Get(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}

	var resp struct {
		ModelID     string `json:"modelId"`
		Code        string `json:"code"`
		ActiveTabID string `json:"activeTabId"`
		Tabs        []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Code string `json:"code"`
		} `json:"tabs"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}

	if resp.ModelID != m.ID {
		t.Fatalf("modelId = %q, want %q", resp.ModelID, m.ID)
	}
	if resp.ActiveTabID != "main" {
		t.Fatalf("activeTabId = %q, want %q", resp.ActiveTabID, "main")
	}
	if len(resp.Tabs) != 2 {
		t.Fatalf("len(tabs) = %d, want 2", len(resp.Tabs))
	}

	if strings.Contains(resp.Code, modelDelimiter) || strings.Contains(resp.Code, "position 10 20 30 40;") {
		t.Fatalf("top-level code should hide stored layout, got %q", resp.Code)
	}
	if resp.Tabs[0].Code != "class Main {}" {
		t.Fatalf("active tab code = %q, want %q", resp.Tabs[0].Code, "class Main {}")
	}
	if strings.Contains(resp.Tabs[0].Code, modelDelimiter) || strings.Contains(resp.Tabs[0].Code, "position 10 20 30 40;") {
		t.Fatalf("active tab should hide stored layout, got %q", resp.Tabs[0].Code)
	}
	if resp.Tabs[1].Code != "use Model.ump;\nclass Other {}" {
		t.Fatalf("secondary tab code = %q", resp.Tabs[1].Code)
	}
}
