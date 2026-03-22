package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/umple/umple-next/backend/internal/api/handlers"
	"github.com/umple/umple-next/backend/internal/compiler"
	"github.com/umple/umple-next/backend/internal/config"
	"github.com/umple/umple-next/backend/internal/execution"
	"github.com/umple/umple-next/backend/internal/model"
)

func NewRouter(cfg *config.Config, pool *compiler.Pool, store *model.Store) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Content-Type", "Authorization", "X-Api-Key", "X-Goog-Api-Key", "Anthropic-Version"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Existing handlers
	compileH := handlers.NewCompileHandler(pool, store)
	modelH := handlers.NewModelHandler(store)
	exampleH := handlers.NewExampleHandler(cfg.ExamplePath)
	healthH := handlers.NewHealthHandler()

	// New handlers
	generateH := handlers.NewGenerateHandler(pool, store, cfg)
	syncH := handlers.NewSyncHandler(pool, store)
	diagramH := handlers.NewDiagramHandler(pool, store)
	exportH := handlers.NewExportHandler(pool, store)
	execProxy := execution.NewProxy(cfg.ExecutionURL)
	executeH := handlers.NewExecuteHandler(pool, store, execProxy)
	taskH := handlers.NewTaskHandler(store)
	aiProxyH := handlers.NewAIProxyHandler()

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", healthH.Health)

		// Compile & generate
		r.Post("/compile", compileH.Compile)
		r.Post("/generate", generateH.Generate)
		r.Post("/sync", syncH.Sync)
		r.Post("/diagram", diagramH.Generate)
		r.Post("/export", exportH.Export)
		r.Post("/execute", executeH.Execute)

		// Examples
		r.Get("/examples", exampleH.List)
		r.Get("/examples/{name}", exampleH.Get)

		// Models
		r.Post("/models", modelH.Create)
		r.Get("/models/{id}", modelH.Get)
		r.Put("/models/{id}", modelH.Update)

		// Tasks
		r.Post("/tasks", taskH.Create)
		r.Get("/tasks/{id}", taskH.Get)
		r.Post("/tasks/{id}/submit", taskH.Submit)

		// AI provider proxy (browser → backend → provider)
		r.Route("/ai", aiProxyH.Routes())
	})

	return r
}
