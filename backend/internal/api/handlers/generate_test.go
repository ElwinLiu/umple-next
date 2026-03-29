package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/umple/umpleonline/backend/internal/compiler"
	"github.com/umple/umpleonline/backend/internal/config"
	"github.com/umple/umpleonline/backend/internal/model"
)

func newIntegrationGenerateHandler(t *testing.T) (*GenerateHandler, *model.Store) {
	t.Helper()

	store, err := model.NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create store: %v", err)
	}

	jarPath := os.Getenv("UMPLE_SYNC_JAR")
	if jarPath == "" {
		jarPath = "/jars/umplesync.jar"
	}
	if _, err := os.Stat(jarPath); err != nil {
		t.Skipf("umplesync.jar not available: %v", err)
	}

	pool, err := compiler.NewPool(jarPath, reserveTCPPort(t))
	if err != nil {
		t.Fatalf("create compiler pool: %v", err)
	}
	t.Cleanup(pool.Shutdown)

	cfg := &config.Config{UmpleSyncJar: jarPath}
	return NewGenerateHandler(pool, store, cfg), store
}

func postGenerate(t *testing.T, handler *GenerateHandler, req GenerateRequest) GenerateResponse {
	t.Helper()

	body, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	httpReq := httptest.NewRequest(http.MethodPost, "/generate", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.Generate(rec, httpReq)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected status %d:\n%s", rec.Code, rec.Body.String())
	}

	var resp GenerateResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return resp
}

func TestGenerateJavaClearsStaleSourcesBetweenModels(t *testing.T) {
	handler, store := newIntegrationGenerateHandler(t)

	first := postGenerate(t, handler, GenerateRequest{
		Code:     readExampleFixture(t, "2DShapes.ump"),
		Language: "Java",
	})
	if !strings.Contains(first.Output, "package Shapes.core;") {
		t.Fatalf("expected first generation to include Shapes.core package:\n%s", first.Output)
	}

	second := postGenerate(t, handler, GenerateRequest{
		Code:     readExampleFixture(t, "AccessControl2.ump"),
		Language: "Java",
		ModelID:  first.ModelID,
	})
	if !strings.Contains(second.Output, "package accessControlSystem;") {
		t.Fatalf("expected second generation to include accessControlSystem package:\n%s", second.Output)
	}
	if strings.Contains(second.Output, "package Shapes.core;") {
		t.Fatalf("second generation should not include stale Shapes.core output:\n%s", second.Output)
	}

	modelDir := store.ModelDir(second.ModelID)
	javaRoot := filepath.Join(modelDir, "Java") + string(os.PathSeparator)
	var stray []string
	filepath.WalkDir(modelDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if filepath.Ext(path) == ".java" && !strings.HasPrefix(path, javaRoot) {
			stray = append(stray, path)
		}
		return nil
	})
	if len(stray) > 0 {
		t.Fatalf("expected Java sources to stay inside %s, found stray files: %v", javaRoot, stray)
	}
}
