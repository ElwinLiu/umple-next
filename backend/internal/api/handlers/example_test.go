package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/umple/umpleonline/backend/internal/config"
	"github.com/umple/umpleonline/backend/internal/model"
)

func TestBuildManifestFromBundledFiles(t *testing.T) {
	handler := newTestExampleHandler(t)

	manifest, err := handler.buildManifest()
	if err != nil {
		t.Fatalf("build manifest: %v", err)
	}

	if len(manifest.sets) == 0 {
		t.Fatal("expected at least one example set")
	}

	for _, set := range manifest.sets {
		if set.ID == "" {
			t.Fatal("expected each example set to expose an id")
		}
		if set.CategoryID == "" {
			t.Fatalf("expected set %q to expose a category id", set.ID)
		}
		if len(set.Examples) == 0 {
			t.Fatalf("expected set %q to contain examples", set.ID)
		}

		for _, example := range set.Examples {
			if example.ID == "" {
				t.Fatalf("expected example in set %q to expose a stable id", set.ID)
			}
			if example.Filename == "" {
				t.Fatalf("expected example %q to expose a filename", example.ID)
			}
			if _, ok := manifest.byID[example.ID]; !ok {
				t.Fatalf("expected example %q to be present in byID lookup", example.ID)
			}

			legacyKey := normalizeLegacyExample(example.Filename)
			if legacyKey == "" {
				t.Fatalf("expected example %q to produce a legacy lookup key", example.ID)
			}
			if got := manifest.byLegacyExample[legacyKey]; got != example.ID {
				t.Fatalf("expected legacy key %q to resolve to %q, got %q", legacyKey, example.ID, got)
			}
		}
	}
}

func TestGetExample(t *testing.T) {
	handler := newTestExampleHandler(t)

	manifest, err := handler.loadManifest()
	if err != nil {
		t.Fatalf("load manifest: %v", err)
	}

	layoutSet, layoutExample := mustFindExample(t, manifest, func(set ExampleSet, example ExampleEntry) bool {
		spec := manifest.byID[example.ID]
		code, err := handler.exampleCode(spec)
		if err != nil {
			t.Fatalf("read example code for %q: %v", example.ID, err)
		}
		return strings.Contains(code, modelDelimiter)
	})
	assertGetExample(t, handler, layoutExample.ID, func(resp ExampleResponse) {
		if resp.ID != layoutExample.ID {
			t.Fatalf("unexpected example id: %q", resp.ID)
		}
		if resp.Name != layoutExample.Name {
			t.Fatalf("unexpected example name: %q", resp.Name)
		}
		if resp.SetID != layoutSet.ID {
			t.Fatalf("unexpected set id: %q", resp.SetID)
		}
		if resp.DefaultCategoryID != layoutSet.CategoryID {
			t.Fatalf("unexpected default category id: %q", resp.DefaultCategoryID)
		}
		if resp.Code == "" {
			t.Fatal("expected example code to be returned")
		}
		if resp.ModelID == "" {
			t.Fatal("expected layout-backed example to pre-create a temp model")
		}
	})

	pathSet, pathExample := mustFindExample(t, manifest, func(set ExampleSet, example ExampleEntry) bool {
		return strings.Contains(example.Filename, "/")
	})
	assertGetExample(t, handler, pathExample.ID, func(resp ExampleResponse) {
		if resp.ID != pathExample.ID {
			t.Fatalf("unexpected example id: %q", resp.ID)
		}
		if resp.Name != pathExample.Name {
			t.Fatalf("unexpected example name: %q", resp.Name)
		}
		if resp.SetID != pathSet.ID {
			t.Fatalf("unexpected extra example set id: %q", resp.SetID)
		}
	})
}

func TestResolveExample(t *testing.T) {
	handler := newTestExampleHandler(t)
	manifest, err := handler.loadManifest()
	if err != nil {
		t.Fatalf("load manifest: %v", err)
	}

	rootSet, rootExample := mustFindExample(t, manifest, func(set ExampleSet, example ExampleEntry) bool {
		return !strings.Contains(example.Filename, "/")
	})
	req := httptest.NewRequest(http.MethodGet, "/api/examples/resolve?example="+normalizeLegacyExample(rootExample.Filename), nil)
	res := httptest.NewRecorder()
	handler.Resolve(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("resolve example status = %d, body = %s", res.Code, res.Body.String())
	}

	var resp ExampleResponse
	if err := json.Unmarshal(res.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode resolve response: %v", err)
	}
	if resp.ID != rootExample.ID {
		t.Fatalf("unexpected resolved example id: %q", resp.ID)
	}
	if resp.Name != rootExample.Name {
		t.Fatalf("unexpected resolved example name: %q", resp.Name)
	}
	if resp.SetID != rootSet.ID {
		t.Fatalf("unexpected resolved set id: %q", resp.SetID)
	}

	pathSet, pathExample := mustFindExample(t, manifest, func(set ExampleSet, example ExampleEntry) bool {
		return strings.Contains(example.Filename, "/")
	})
	req = httptest.NewRequest(http.MethodGet, "/api/examples/resolve?example="+normalizeLegacyExample(pathExample.Filename), nil)
	res = httptest.NewRecorder()
	handler.Resolve(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("resolve path example status = %d, body = %s", res.Code, res.Body.String())
	}

	if err := json.Unmarshal(res.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode path resolve response: %v", err)
	}
	if resp.ID != pathExample.ID {
		t.Fatalf("unexpected path resolved example id: %q", resp.ID)
	}
	if resp.Name != pathExample.Name {
		t.Fatalf("unexpected path resolved example name: %q", resp.Name)
	}
	if resp.SetID != pathSet.ID {
		t.Fatalf("unexpected path resolved set id: %q", resp.SetID)
	}
}

func TestLoadManifestReflectsUpdatedManifestFile(t *testing.T) {
	handler := newTestExampleHandler(t)

	firstManifest, err := handler.loadManifest()
	if err != nil {
		t.Fatalf("load initial manifest: %v", err)
	}
	if firstManifest.sets[0].Label != "Class Diagrams" {
		t.Fatalf("unexpected initial label: %q", firstManifest.sets[0].Label)
	}

	updated := exampleManifestFile{
		Sets: []exampleManifestSet{
			{
					ID:         ExampleSet1,
				Label:      "Updated Class Diagrams",
				CategoryID: ExampleCategoryClass,
				Examples: []exampleManifestEntry{
					{Filename: "2DShapes.ump", Label: "2DShapes *"},
				},
			},
		},
	}
	writeJSONFixture(t, filepath.Join(handler.examplePath, exampleManifestFileName), updated)

	secondManifest, err := handler.loadManifest()
	if err != nil {
		t.Fatalf("reload manifest: %v", err)
	}
	if secondManifest.sets[0].Label != "Updated Class Diagrams" {
		t.Fatalf("expected updated label after manifest rewrite, got %q", secondManifest.sets[0].Label)
	}
	if got := len(secondManifest.sets[0].Examples); got != 1 {
		t.Fatalf("expected updated manifest example count, got %d", got)
	}
}

func TestBundledManifestReferencesExistingExamples(t *testing.T) {
	root := bundledExamplesRoot()
	raw, err := os.ReadFile(filepath.Join(root, exampleManifestFileName))
	if err != nil {
		t.Fatalf("read bundled manifest: %v", err)
	}

	var manifest exampleManifestFile
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatalf("decode bundled manifest: %v", err)
	}

	count := 0
	for _, set := range manifest.Sets {
		for _, example := range set.Examples {
			count++
			target := filepath.Join(root, filepath.FromSlash(example.Filename))
			if _, err := os.Stat(target); err != nil {
				t.Fatalf("bundled example %q missing at %s: %v", example.Filename, target, err)
			}
		}
	}

	if count == 0 {
		t.Fatal("expected bundled manifest to reference at least one example")
	}
}

func TestResolveBundledPathBasedLegacyExample(t *testing.T) {
	store, err := model.NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create model store: %v", err)
	}

	handler := NewExampleHandler(&config.Config{ExamplePath: bundledExamplesRoot()}, store)
	manifest, err := handler.loadManifest()
	if err != nil {
		t.Fatalf("load bundled manifest: %v", err)
	}

	_, example := mustFindExample(t, manifest, func(set ExampleSet, example ExampleEntry) bool {
		return strings.Contains(example.Filename, "/")
	})

	legacyExample := normalizeLegacyExample(example.Filename)
	req := httptest.NewRequest(http.MethodGet, "/api/examples/resolve?example="+legacyExample, nil)
	res := httptest.NewRecorder()
	handler.Resolve(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("resolve bundled path example status = %d, body = %s", res.Code, res.Body.String())
	}

	var resp ExampleResponse
	if err := json.Unmarshal(res.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode bundled resolve response: %v", err)
	}
	if resp.ID == "" {
		t.Fatal("expected bundled resolve response to include an example id")
	}
	if _, ok := manifest.byID[resp.ID]; !ok {
		t.Fatalf("expected bundled resolve response id %q to exist in manifest", resp.ID)
	}
}

func newTestExampleHandler(t *testing.T) *ExampleHandler {
	t.Helper()

	store, err := model.NewStore(t.TempDir())
	if err != nil {
		t.Fatalf("create model store: %v", err)
	}

	exampleRoot := newTestExampleRoot(t)
	cfg := &config.Config{
		ExamplePath: exampleRoot,
	}
	return NewExampleHandler(cfg, store)
}

func newTestExampleRoot(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "extraExamples1"), 0o755); err != nil {
		t.Fatalf("create extra examples dir: %v", err)
	}

	manifest := exampleManifestFile{
		Sets: []exampleManifestSet{
			{
					ID:         ExampleSet1,
				Label:      "Class Diagrams",
				CategoryID: ExampleCategoryClass,
				Examples: []exampleManifestEntry{
					{Filename: "2DShapes.ump", Label: "2DShapes *"},
					{Filename: "BankingSystemA.ump", Label: "Banking System A"},
				},
			},
			{
					ID:         ExampleSet2,
				Label:      "Extra Class Diagrams",
				CategoryID: ExampleCategoryClass,
				Examples: []exampleManifestEntry{
					{Filename: "extraExamples1/ATOM.ecore.ump", Label: "ATOM Web Syndication"},
				},
			},
			{
					ID:         ExampleSet3,
				Label:      "State Machines",
				CategoryID: ExampleCategoryState,
				Examples: []exampleManifestEntry{
					{Filename: "DigitalWatchFlat.ump", Label: "Digital Watch (Flat) *"},
				},
			},
			{
					ID:         ExampleSet4,
					Label:      "Feature Diagrams",
				CategoryID: ExampleCategoryFeature,
				Examples: []exampleManifestEntry{
					{Filename: "BerkeleyDB_SPL.ump", Label: "BerkeleyDB SPL"},
				},
			},
			{
					ID:         ExampleSet5,
				Label:      "Composite Structure",
				CategoryID: ExampleCategoryStructure,
				Examples: []exampleManifestEntry{
					{Filename: "PingPong.ump", Label: "Ping Pong"},
				},
			},
		},
	}

	writeJSONFixture(t, filepath.Join(root, exampleManifestFileName), manifest)
	writeTextFixture(t, filepath.Join(root, "2DShapes.ump"), "class Shape {}\n\n"+modelDelimiter+"\nclass Shape {\n  position 1 2 3 4;\n}\n")
	writeTextFixture(t, filepath.Join(root, "BankingSystemA.ump"), "class Account {}")
	writeTextFixture(t, filepath.Join(root, "extraExamples1", "ATOM.ecore.ump"), "class Atom {}")
	writeTextFixture(t, filepath.Join(root, "DigitalWatchFlat.ump"), "class Watch {}")
	writeTextFixture(t, filepath.Join(root, "BerkeleyDB_SPL.ump"), "class FeatureFlag {}")
	writeTextFixture(t, filepath.Join(root, "PingPong.ump"), "class Ping {}")

	return root
}

func writeJSONFixture(t *testing.T, target string, value any) {
	t.Helper()

	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	if err := os.WriteFile(target, data, 0o644); err != nil {
		t.Fatalf("write json fixture: %v", err)
	}
}

func writeTextFixture(t *testing.T, target, value string) {
	t.Helper()

	if err := os.WriteFile(target, []byte(value), 0o644); err != nil {
		t.Fatalf("write text fixture: %v", err)
	}
}

func assertGetExample(t *testing.T, handler *ExampleHandler, id string, check func(ExampleResponse)) {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/api/examples/"+id, nil)
	req = withExampleRouteID(req, id)
	res := httptest.NewRecorder()
	handler.Get(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("get example status = %d, body = %s", res.Code, res.Body.String())
	}

	var resp ExampleResponse
	if err := json.Unmarshal(res.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	check(resp)
}

func mustFindExample(
	t *testing.T,
	manifest *exampleManifest,
	match func(ExampleSet, ExampleEntry) bool,
) (ExampleSet, ExampleEntry) {
	t.Helper()

	for _, set := range manifest.sets {
		for _, example := range set.Examples {
			if match(set, example) {
				return set, example
			}
		}
	}

	t.Fatal("expected to find matching example")
	return ExampleSet{}, ExampleEntry{}
}

func withExampleRouteID(req *http.Request, id string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("id", id)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func bundledExamplesRoot() string {
	return filepath.Join("..", "..", "..", "..", "examples")
}
