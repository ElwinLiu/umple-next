package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/umple/umpleonline/backend/internal/task"
)

// addChiParam injects a chi URL parameter into the request context.
func addChiParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}

func newTestTaskHandler(t *testing.T) (*TaskHandler, *task.Store) {
	t.Helper()
	store, err := task.NewStore(filepath.Join(t.TempDir(), "tasks"))
	if err != nil {
		t.Fatal(err)
	}
	return NewTaskHandler(store), store
}

// createTaskViaStore is a test helper that creates a task directly through the store.
func createTaskViaStore(t *testing.T, store *task.Store, name string) *task.TaskOwnerView {
	t.Helper()
	view, err := store.CreateTask(task.CreateTaskRequest{
		TaskName:      name,
		RequestorName: "Prof",
		Instructions:  "test instructions",
		ModelCode:     "class Test {}",
	})
	if err != nil {
		t.Fatal(err)
	}
	return view
}

func TestTaskHandler_Create_Success(t *testing.T) {
	h, _ := newTestTaskHandler(t)

	body, _ := json.Marshal(map[string]any{
		"taskName":      "hw1",
		"requestorName": "Prof Smith",
		"instructions":  "do this",
		"modelCode":     "class A {}",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["editKey"] == nil || resp["editKey"] == "" {
		t.Error("editKey should be present")
	}
	if resp["taskName"] != "hw1" {
		t.Errorf("taskName = %v", resp["taskName"])
	}
}

func TestTaskHandler_Create_InvalidName(t *testing.T) {
	h, _ := newTestTaskHandler(t)

	body, _ := json.Marshal(map[string]string{"taskName": ""})
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", rec.Code)
	}
}

func TestTaskHandler_Create_Duplicate(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")

	body, _ := json.Marshal(map[string]string{
		"taskName": "hw1", "requestorName": "Other",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Create(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
}

func TestTaskHandler_Get_PublicView(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")

	req := httptest.NewRequest(http.MethodGet, "/api/tasks/hw1", nil)
	req = addChiParam(req, "name", "hw1")
	rec := httptest.NewRecorder()

	h.Get(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["editKey"] != nil {
		t.Error("editKey should NOT be in public view")
	}
	if resp["taskName"] != "hw1" {
		t.Errorf("taskName = %v", resp["taskName"])
	}
}

func TestTaskHandler_Get_OwnerView(t *testing.T) {
	h, store := newTestTaskHandler(t)
	created := createTaskViaStore(t, store, "hw1")

	req := httptest.NewRequest(http.MethodGet, "/api/tasks/hw1?editKey="+created.EditKey, nil)
	req = addChiParam(req, "name", "hw1")
	rec := httptest.NewRecorder()

	h.Get(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["editKey"] == nil || resp["editKey"] == "" {
		t.Error("editKey should be in owner view")
	}
}

func TestTaskHandler_Get_WrongKey(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")

	req := httptest.NewRequest(http.MethodGet, "/api/tasks/hw1?editKey=wrongkey", nil)
	req = addChiParam(req, "name", "hw1")
	rec := httptest.NewRecorder()

	h.Get(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}

func TestTaskHandler_Get_NotFound(t *testing.T) {
	h, _ := newTestTaskHandler(t)

	req := httptest.NewRequest(http.MethodGet, "/api/tasks/nope", nil)
	req = addChiParam(req, "name", "nope")
	rec := httptest.NewRecorder()

	h.Get(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestTaskHandler_Update_Success(t *testing.T) {
	h, store := newTestTaskHandler(t)
	created := createTaskViaStore(t, store, "hw1")

	body, _ := json.Marshal(map[string]any{
		"editKey":       created.EditKey,
		"requestorName": "Prof",
		"instructions":  "updated instructions",
		"modelCode":     "class Test {}",
	})
	req := httptest.NewRequest(http.MethodPut, "/api/tasks/hw1", bytes.NewReader(body))
	req = addChiParam(req, "name", "hw1")
	rec := httptest.NewRecorder()

	h.Update(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["instructions"] != "updated instructions" {
		t.Errorf("instructions = %v", resp["instructions"])
	}
}

func TestTaskHandler_CreateResponse_Success(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")

	req := httptest.NewRequest(http.MethodPost, "/api/tasks/hw1/responses", nil)
	req = addChiParam(req, "name", "hw1")
	rec := httptest.NewRecorder()

	h.CreateResponse(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["responseId"] == nil || resp["responseId"] == "" {
		t.Error("responseId should be present")
	}
}

func TestTaskHandler_GetResponse_Success(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")
	respView, _ := store.CreateResponse("hw1")

	req := httptest.NewRequest(http.MethodGet, "/api/tasks/responses/"+respView.ResponseID, nil)
	req = addChiParam(req, "id", respView.ResponseID)
	rec := httptest.NewRecorder()

	h.GetResponse(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["responseId"] != respView.ResponseID {
		t.Errorf("responseId = %v", resp["responseId"])
	}
}

func TestTaskHandler_SubmitResponse_Success(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")
	respView, _ := store.CreateResponse("hw1")

	req := httptest.NewRequest(http.MethodPost, "/api/tasks/responses/"+respView.ResponseID+"/submit", nil)
	req = addChiParam(req, "id", respView.ResponseID)
	rec := httptest.NewRecorder()

	h.SubmitResponse(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var resp map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if resp["submittedAt"] == nil || resp["submittedAt"] == "" {
		t.Error("submittedAt should be set")
	}
}

func TestTaskHandler_SubmitResponse_AlreadySubmitted(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")
	respView, _ := store.CreateResponse("hw1")
	store.SubmitResponse(respView.ResponseID)

	req := httptest.NewRequest(http.MethodPost, "/api/tasks/responses/"+respView.ResponseID+"/submit", nil)
	req = addChiParam(req, "id", respView.ResponseID)
	rec := httptest.NewRecorder()

	h.SubmitResponse(rec, req)

	if rec.Code != http.StatusConflict {
		t.Errorf("status = %d, want 409", rec.Code)
	}
}

func TestTaskHandler_ListResponses_Success(t *testing.T) {
	h, store := newTestTaskHandler(t)
	created := createTaskViaStore(t, store, "hw1")
	store.CreateResponse("hw1")
	store.CreateResponse("hw1")

	req := httptest.NewRequest(http.MethodGet, "/api/tasks/hw1/responses?editKey="+created.EditKey, nil)
	req = addChiParam(req, "name", "hw1")
	rec := httptest.NewRecorder()

	h.ListResponses(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var resp []map[string]any
	json.NewDecoder(rec.Body).Decode(&resp)
	if len(resp) != 2 {
		t.Errorf("expected 2 responses, got %d", len(resp))
	}
}

func TestTaskHandler_ListResponses_NoKey(t *testing.T) {
	h, store := newTestTaskHandler(t)
	createTaskViaStore(t, store, "hw1")

	req := httptest.NewRequest(http.MethodGet, "/api/tasks/hw1/responses", nil)
	req = addChiParam(req, "name", "hw1")
	rec := httptest.NewRecorder()

	h.ListResponses(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", rec.Code)
	}
}
